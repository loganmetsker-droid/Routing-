"""Google OR-Tools VRP solver for route optimization."""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any, Dict, List, Tuple

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

from app.schemas import (
    OptimizeRequest,
    OptimizeResponse,
    RouteOutput,
    RouteStopOutput,
)


LatLng = Tuple[float, float]


def calculate_distance(loc1: LatLng, loc2: LatLng) -> float:
    lat1, lon1 = loc1
    lat2, lon2 = loc2
    radius_km = 6371.0
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlon = math.radians(lon2 - lon1)
    dlat = math.radians(lat2 - lat1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius_km * c


def create_distance_matrix(locations: List[LatLng]) -> List[List[int]]:
    matrix = [[0] * len(locations) for _ in locations]
    for i, origin in enumerate(locations):
        for j, destination in enumerate(locations):
            if i == j:
                continue
            matrix[i][j] = int(calculate_distance(origin, destination) * 1000)
    return matrix


def build_time_matrix(
    locations: List[LatLng], avg_speed_kph: float = 35.0
) -> List[List[int]]:
    matrix: List[List[int]] = []
    for i, origin in enumerate(locations):
        row: List[int] = []
        for j, destination in enumerate(locations):
            if i == j:
                row.append(0)
                continue
            km = calculate_distance(origin, destination)
            seconds = int((km / avg_speed_kph) * 3600)
            row.append(seconds)
        matrix.append(row)
    return matrix


def create_time_callback(manager, time_matrix, service_seconds):
    def time_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        travel = time_matrix[from_node][to_node]
        service = service_seconds[from_node]
        return travel + service

    return time_callback


def solve_optimize_request(request: OptimizeRequest) -> OptimizeResponse:
    if not request.vehicles:
        return OptimizeResponse(
            routes=[],
            unassigned_stop_ids=[stop.id for stop in request.stops],
            warnings=["No vehicles were provided."],
        )

    if not request.stops:
        return OptimizeResponse(routes=[], unassigned_stop_ids=[], warnings=[])

    num_vehicles = len(request.vehicles)
    num_stops = len(request.stops)

    start_locations = [
        (vehicle.start_lat, vehicle.start_lng) for vehicle in request.vehicles
    ]
    end_locations = [
        (
            vehicle.end_lat if vehicle.end_lat is not None else vehicle.start_lat,
            vehicle.end_lng if vehicle.end_lng is not None else vehicle.start_lng,
        )
        for vehicle in request.vehicles
    ]
    stop_locations = [(stop.lat, stop.lng) for stop in request.stops]
    locations = start_locations + stop_locations + end_locations

    starts = list(range(num_vehicles))
    ends = [num_vehicles + num_stops + idx for idx in range(num_vehicles)]

    manager = pywrapcp.RoutingIndexManager(
        len(locations),
        num_vehicles,
        starts,
        ends,
    )
    routing = pywrapcp.RoutingModel(manager)

    distance_matrix = create_distance_matrix(locations)
    time_matrix = build_time_matrix(locations)
    service_seconds = [0] * len(locations)
    demand_values = [0] * len(locations)

    for stop_idx, stop in enumerate(request.stops):
        node_idx = num_vehicles + stop_idx
        service_seconds[node_idx] = max(0, int(stop.service_minutes * 60))
        demand_values[node_idx] = max(0, int(stop.volume * 100))

    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return distance_matrix[from_node][to_node]

    distance_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(distance_callback_index)

    time_callback_index = routing.RegisterTransitCallback(
        create_time_callback(manager, time_matrix, service_seconds)
    )
    routing.AddDimension(
        time_callback_index,
        3600,
        max(vehicle.max_route_minutes for vehicle in request.vehicles) * 60,
        True,
        "Time",
    )
    time_dimension = routing.GetDimensionOrDie("Time")

    for vehicle_idx, vehicle in enumerate(request.vehicles):
        time_dimension.CumulVar(routing.End(vehicle_idx)).SetMax(
            max(0, vehicle.max_route_minutes * 60)
        )

    def demand_callback(from_index):
        from_node = manager.IndexToNode(from_index)
        return demand_values[from_node]

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index,
        0,
        [max(0, int(vehicle.capacity_volume * 100)) for vehicle in request.vehicles],
        True,
        "Capacity",
    )

    planning_epoch = request.plan_date
    for stop_idx, stop in enumerate(request.stops):
        index = manager.NodeToIndex(num_vehicles + stop_idx)
        start_window = (
            int((stop.tw_start - planning_epoch).total_seconds())
            if stop.tw_start
            else 0
        )
        end_window = (
            int((stop.tw_end - planning_epoch).total_seconds())
            if stop.tw_end
            else 24 * 3600
        )
        if end_window < start_window:
            end_window = start_window
        time_dimension.CumulVar(index).SetRange(start_window, end_window)

        penalty = {1: 100_000, 2: 50_000, 3: 10_000, 4: 5_000}.get(stop.priority, 10_000)
        routing.AddDisjunction([index], penalty)

        if stop.locked_vehicle_id:
            for vehicle_idx, vehicle in enumerate(request.vehicles):
                if vehicle.id == stop.locked_vehicle_id:
                    routing.SetAllowedVehiclesForIndex([vehicle_idx], index)
                    break

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_parameters.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_parameters.time_limit.seconds = 10

    solution = routing.SolveWithParameters(search_parameters)
    if not solution:
        return OptimizeResponse(
            routes=[],
            unassigned_stop_ids=[stop.id for stop in request.stops],
            warnings=["No feasible solution found."],
        )

    assigned_stop_ids: set[str] = set()
    routes: List[RouteOutput] = []

    for vehicle_idx, vehicle in enumerate(request.vehicles):
        ordered_stops: List[RouteStopOutput] = []
        index = routing.Start(vehicle_idx)
        total_distance_m = 0

        while not routing.IsEnd(index):
            node_index = manager.IndexToNode(index)
            previous_index = index
            next_index = solution.Value(routing.NextVar(index))

            if num_vehicles <= node_index < num_vehicles + num_stops:
                stop_idx = node_index - num_vehicles
                stop = request.stops[stop_idx]
                eta_seconds = solution.Value(time_dimension.CumulVar(index))
                ordered_stops.append(
                    RouteStopOutput(
                        stop_id=stop.id,
                        sequence=len(ordered_stops) + 1,
                        eta=planning_epoch + timedelta(seconds=eta_seconds),
                    )
                )
                assigned_stop_ids.add(stop.id)

            total_distance_m += routing.GetArcCostForVehicle(
                previous_index, next_index, vehicle_idx
            )
            index = next_index

        total_duration_s = solution.Value(time_dimension.CumulVar(routing.End(vehicle_idx)))
        routes.append(
            RouteOutput(
                vehicle_id=vehicle.id,
                ordered_stops=ordered_stops,
                total_distance_m=float(total_distance_m),
                total_duration_s=float(total_duration_s),
            )
        )

    unassigned_stop_ids = [
        stop.id for stop in request.stops if stop.id not in assigned_stop_ids
    ]
    warnings = []
    if unassigned_stop_ids:
        warnings.append(
            f"{len(unassigned_stop_ids)} stop(s) could not be assigned within current constraints."
        )

    return OptimizeResponse(
        routes=routes,
        unassigned_stop_ids=unassigned_stop_ids,
        warnings=warnings,
    )


def solve_vrp(
    vehicle_locations: List[Tuple[float, float]],
    vehicle_ids: List[str],
    vehicle_capacities: List[float],
    job_locations: List[Tuple[float, float]],
    job_ids: List[str],
    time_windows: List[Tuple[datetime, datetime]],
    priorities: List[int],
    job_volumes: List[float],
) -> Dict[str, Any]:
    request = OptimizeRequest(
        plan_date=min((window[0] for window in time_windows), default=datetime.utcnow()),
        vehicles=[
            {
                "id": vehicle_id,
                "start_lat": vehicle_locations[idx][0],
                "start_lng": vehicle_locations[idx][1],
                "capacity_volume": vehicle_capacities[idx],
                "max_route_minutes": 480,
            }
            for idx, vehicle_id in enumerate(vehicle_ids)
        ],
        stops=[
            {
                "id": job_ids[idx],
                "lat": job_locations[idx][0],
                "lng": job_locations[idx][1],
                "service_minutes": 10,
                "tw_start": time_windows[idx][0],
                "tw_end": time_windows[idx][1],
                "priority": priorities[idx],
                "volume": job_volumes[idx],
            }
            for idx in range(len(job_ids))
        ],
    )

    result = solve_optimize_request(request)
    routes: Dict[str, Any] = {}
    stop_lookup = {stop.id: stop for stop in request.stops}
    for route in result.routes:
        ordered = []
        for stop in route.ordered_stops:
            stop_input = stop_lookup[stop.stop_id]
            ordered.append(
                {
                    "job_id": stop.stop_id,
                    "sequence": stop.sequence,
                    "location": {
                        "latitude": stop_input.lat,
                        "longitude": stop_input.lng,
                    },
                    "estimated_arrival": stop.eta.isoformat() if stop.eta else None,
                    "time_window_start": stop_input.tw_start.isoformat()
                    if stop_input.tw_start
                    else None,
                    "time_window_end": stop_input.tw_end.isoformat()
                    if stop_input.tw_end
                    else None,
                    "priority": stop_input.priority,
                    "volume": stop_input.volume,
                }
            )
        routes[route.vehicle_id] = {
            "route": ordered,
            "total_distance_km": round(route.total_distance_m / 1000, 2),
            "total_duration_minutes": round(route.total_duration_s / 60, 2),
            "num_jobs": len(ordered),
            "vehicle_start_location": {
                "latitude": request.vehicles[vehicle_ids.index(route.vehicle_id)].start_lat,
                "longitude": request.vehicles[vehicle_ids.index(route.vehicle_id)].start_lng,
            },
        }

    return {
        "success": True,
        "routes": routes,
        "unassigned_jobs": result.unassigned_stop_ids,
        "warnings": result.warnings,
    }
