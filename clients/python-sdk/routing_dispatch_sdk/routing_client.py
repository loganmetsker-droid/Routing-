"""Routing client for route planning and optimization"""

from typing import List, Dict, Any, Optional
from .base_client import BaseClient


class RoutingClient(BaseClient):
    """Client for routing and route planning operations"""

    def plan_route(
        self,
        vehicle_id: str,
        job_ids: List[str],
        optimize: bool = True,
        start_location: Optional[Dict[str, float]] = None,
        end_location: Optional[Dict[str, float]] = None,
    ) -> Dict[str, Any]:
        """
        Plan an optimized route for a vehicle with given jobs

        Args:
            vehicle_id: ID of the vehicle
            job_ids: List of job IDs to include in route
            optimize: Whether to optimize route for efficiency
            start_location: Optional start location {lat, lng}
            end_location: Optional end location {lat, lng}

        Returns:
            Route data including waypoints, distance, duration

        Example:
            >>> client = RoutingClient(api_key="your-key")
            >>> route = client.plan_route(
            ...     vehicle_id="vehicle-123",
            ...     job_ids=["job-1", "job-2", "job-3"]
            ... )
            >>> print(f"Total distance: {route['totalDistance']}km")
        """
        payload = {
            "vehicleId": vehicle_id,
            "jobIds": job_ids,
            "optimize": optimize,
        }

        if start_location:
            payload["startLocation"] = start_location
        if end_location:
            payload["endLocation"] = end_location

        return self.post("routes/plan", data=payload)

    def get_route(self, route_id: str) -> Dict[str, Any]:
        """
        Get route details by ID

        Args:
            route_id: Route ID

        Returns:
            Route details
        """
        return self.get(f"routes/{route_id}")

    def list_routes(
        self,
        vehicle_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        List routes with optional filters

        Args:
            vehicle_id: Filter by vehicle ID
            status: Filter by status (planned, in_progress, completed)
            limit: Maximum number of results
            offset: Pagination offset

        Returns:
            List of routes
        """
        params = {"limit": limit, "offset": offset}

        if vehicle_id:
            params["vehicleId"] = vehicle_id
        if status:
            params["status"] = status

        response = self.get("routes", params=params)
        return response.get("routes", [])

    def optimize_route(self, route_id: str) -> Dict[str, Any]:
        """
        Re-optimize an existing route

        Args:
            route_id: Route ID to optimize

        Returns:
            Optimized route data
        """
        return self.post(f"routes/{route_id}/optimize")

    def calculate_distance(
        self,
        origin: Dict[str, float],
        destination: Dict[str, float],
        waypoints: Optional[List[Dict[str, float]]] = None,
    ) -> Dict[str, Any]:
        """
        Calculate distance and duration between points

        Args:
            origin: Start location {lat, lng}
            destination: End location {lat, lng}
            waypoints: Optional intermediate points

        Returns:
            Distance and duration data
        """
        payload = {
            "origin": origin,
            "destination": destination,
        }

        if waypoints:
            payload["waypoints"] = waypoints

        return self.post("routes/calculate-distance", data=payload)
