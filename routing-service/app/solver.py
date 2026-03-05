"""Google OR-Tools VRP solver for route optimization."""

from typing import List, Dict, Any, Tuple
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
import math
from datetime import datetime, timedelta


def calculate_distance(loc1: Tuple[float, float], loc2: Tuple[float, float]) -> float:
    """
    Calculate Haversine distance between two lat/lon points in kilometers.

    Args:
        loc1: (latitude, longitude) tuple
        loc2: (latitude, longitude) tuple

    Returns:
        Distance in kilometers
    """
    lat1, lon1 = loc1
    lat2, lon2 = loc2

    # Radius of Earth in kilometers
    R = 6371.0

    # Convert to radians
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlon = math.radians(lon2 - lon1)
    dlat = math.radians(lat2 - lat1)

    # Haversine formula
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = R * c

    return distance


def create_distance_matrix(locations: List[Tuple[float, float]]) -> List[List[int]]:
    """
    Create distance matrix from list of locations.

    Args:
        locations: List of (latitude, longitude) tuples

    Returns:
        Distance matrix in meters (as integers)
    """
    n = len(locations)
    matrix = [[0] * n for _ in range(n)]

    for i in range(n):
        for j in range(n):
            if i != j:
                # Convert km to meters and round to integer
                distance_km = calculate_distance(locations[i], locations[j])
                matrix[i][j] = int(distance_km * 1000)

    return matrix


def solve_vrp(
    vehicle_location: Tuple[float, float],
    job_locations: List[Tuple[float, float]],
    job_ids: List[str],
    time_windows: List[Tuple[datetime, datetime]],
    priorities: List[int],
    job_volumes: List[float],
    vehicle_capacity: float
) -> Dict[str, Any]:
    """
    Solve Vehicle Routing Problem using Google OR-Tools.

    This is a simplified TSP (Traveling Salesman Problem) solver for MVP.
    The vehicle starts at its current location, visits all jobs, and returns.

    Args:
        vehicle_location: (lat, lon) of vehicle's current position
        job_locations: List of (lat, lon) for each job's delivery location
        job_ids: List of job UUIDs
        time_windows: List of (start, end) datetime tuples for each job
        priorities: List of priority values (1=urgent, 2=high, 3=normal, 4=low)
        job_volumes: List of volume limits for jobs
        vehicle_capacity: The vehicle's total volume capacity


    Returns:
        Dictionary with optimized route information
    """
    # Prepare locations: [depot] + [all jobs]
    locations = [vehicle_location] + job_locations
    num_locations = len(locations)

    # Create distance matrix
    distance_matrix = create_distance_matrix(locations)

    # Create routing index manager
    manager = pywrapcp.RoutingIndexManager(
        num_locations,  # Number of locations
        1,              # Number of vehicles
        0               # Depot index (vehicle starting location)
    )

    # Create routing model
    routing = pywrapcp.RoutingModel(manager)

    # Define cost of each arc (distance callback)
    def distance_callback(from_index, to_index):
        """Return distance between two nodes."""
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return distance_matrix[from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    # Add time window constraints
    time_dimension_name = 'Time'
    # For concrete trucks, the total lifespan of the mix from start is approx 90-120 minutes.
    # We enforce a hard limit of 90 minutes (5400 seconds) for the vehicle's total trip duration.
    routing.AddDimension(
        transit_callback_index,
        3600,  # Allow waiting time (1 hour in seconds)
        5400,  # Maximum time per vehicle (90 minutes / 5400 seconds)
        False,  # Don't force start cumul to zero
        time_dimension_name
    )
    time_dimension = routing.GetDimensionOrDie(time_dimension_name)

    # Add Capacity constraints for Concrete Volume
    def demand_callback(from_index):
        """Returns the demand of the node."""
        from_node = manager.IndexToNode(from_index)
        if from_node == 0:
            return 0
        job_idx = from_node - 1
        # Multiply by 100 to handle floats safely in OR-Tools integers
        return int(job_volumes[job_idx] * 100)

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index,
        0,  # null capacity slack
        [int(vehicle_capacity * 100)],  # vehicle maximum capacity
        True,  # start cumul to zero
        'Capacity'
    )

    # Add time windows for jobs (skip depot at index 0)
    for location_idx in range(1, num_locations):
        index = manager.NodeToIndex(location_idx)
        job_idx = location_idx - 1

        # Convert datetime to seconds from epoch
        start_time = int(time_windows[job_idx][0].timestamp())
        end_time = int(time_windows[job_idx][1].timestamp())

        time_dimension.CumulVar(index).SetRange(start_time, end_time)

    # Add priority as a soft constraint (via penalty)
    # Lower priority value = higher priority job
    for location_idx in range(1, num_locations):
        index = manager.NodeToIndex(location_idx)
        job_idx = location_idx - 1
        priority_penalty = priorities[job_idx] * 1000  # Penalty for not visiting high priority jobs first
        routing.AddDisjunction([index], priority_penalty)

    # Set search parameters
    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_parameters.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_parameters.time_limit.seconds = 10  # 10 second time limit

    # Solve the problem
    solution = routing.SolveWithParameters(search_parameters)

    if not solution:
        return {
            "success": False,
            "error": "No solution found",
            "route": [],
            "total_distance_km": 0,
            "total_duration_minutes": 0
        }

    # Extract solution
    route = []
    total_distance = 0
    index = routing.Start(0)

    while not routing.IsEnd(index):
        node_index = manager.IndexToNode(index)

        # Skip depot (node 0)
        if node_index > 0:
            job_idx = node_index - 1
            time_var = time_dimension.CumulVar(index)
            arrival_time = solution.Value(time_var)

            route.append({
                "job_id": job_ids[job_idx],
                "sequence": len(route) + 1,
                "location": {
                    "latitude": job_locations[job_idx][0],
                    "longitude": job_locations[job_idx][1]
                },
                "estimated_arrival": datetime.fromtimestamp(arrival_time).isoformat(),
                "time_window_start": time_windows[job_idx][0].isoformat(),
                "time_window_end": time_windows[job_idx][1].isoformat(),
                "priority": priorities[job_idx]
            })

        previous_index = index
        index = solution.Value(routing.NextVar(index))
        total_distance += routing.GetArcCostForVehicle(previous_index, index, 0)

    # Convert total distance from meters to kilometers
    total_distance_km = total_distance / 1000.0

    # Estimate duration (assuming average speed of 40 km/h)
    total_duration_minutes = (total_distance_km / 40.0) * 60

    return {
        "success": True,
        "route": route,
        "total_distance_km": round(total_distance_km, 2),
        "total_duration_minutes": round(total_duration_minutes, 2),
        "num_jobs": len(route),
        "vehicle_start_location": {
            "latitude": vehicle_location[0],
            "longitude": vehicle_location[1]
        }
    }
