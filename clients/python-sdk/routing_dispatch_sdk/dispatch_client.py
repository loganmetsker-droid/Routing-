"""Dispatch client for assigning routes and managing dispatches"""

from typing import List, Dict, Any, Optional
from .base_client import BaseClient


class DispatchClient(BaseClient):
    """Client for dispatch and route assignment operations"""

    def assign_routes(
        self,
        route_assignments: List[Dict[str, str]],
        auto_notify: bool = True,
    ) -> Dict[str, Any]:
        """
        Assign multiple routes to drivers

        Args:
            route_assignments: List of {routeId, driverId} assignments
            auto_notify: Whether to automatically notify drivers

        Returns:
            Dispatch assignment results

        Example:
            >>> client = DispatchClient(api_key="your-key")
            >>> result = client.assign_routes([
            ...     {"routeId": "route-1", "driverId": "driver-1"},
            ...     {"routeId": "route-2", "driverId": "driver-2"},
            ... ])
            >>> print(f"Assigned {len(result['dispatches'])} routes")
        """
        payload = {
            "assignments": route_assignments,
            "autoNotify": auto_notify,
        }

        return self.post("dispatches/assign", data=payload)

    def create_dispatch(
        self,
        route_id: str,
        driver_id: str,
        vehicle_id: str,
        scheduled_start: str,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a new dispatch assignment

        Args:
            route_id: Route ID
            driver_id: Driver ID
            vehicle_id: Vehicle ID
            scheduled_start: ISO 8601 datetime string
            notes: Optional dispatch notes

        Returns:
            Created dispatch data
        """
        payload = {
            "routeId": route_id,
            "driverId": driver_id,
            "vehicleId": vehicle_id,
            "scheduledStart": scheduled_start,
        }

        if notes:
            payload["notes"] = notes

        return self.post("dispatches", data=payload)

    def get_dispatch(self, dispatch_id: str) -> Dict[str, Any]:
        """
        Get dispatch details by ID

        Args:
            dispatch_id: Dispatch ID

        Returns:
            Dispatch details
        """
        return self.get(f"dispatches/{dispatch_id}")

    def list_dispatches(
        self,
        driver_id: Optional[str] = None,
        status: Optional[str] = None,
        date: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        List dispatches with optional filters

        Args:
            driver_id: Filter by driver ID
            status: Filter by status (pending, in_progress, completed, cancelled)
            date: Filter by date (YYYY-MM-DD)
            limit: Maximum number of results
            offset: Pagination offset

        Returns:
            List of dispatches
        """
        params = {"limit": limit, "offset": offset}

        if driver_id:
            params["driverId"] = driver_id
        if status:
            params["status"] = status
        if date:
            params["date"] = date

        response = self.get("dispatches", params=params)
        return response.get("dispatches", [])

    def update_dispatch_status(
        self,
        dispatch_id: str,
        status: str,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Update dispatch status

        Args:
            dispatch_id: Dispatch ID
            status: New status (in_progress, completed, cancelled)
            notes: Optional status update notes

        Returns:
            Updated dispatch data
        """
        payload = {"status": status}

        if notes:
            payload["notes"] = notes

        return self.put(f"dispatches/{dispatch_id}/status", data=payload)

    def cancel_dispatch(self, dispatch_id: str, reason: Optional[str] = None) -> Dict[str, Any]:
        """
        Cancel a dispatch

        Args:
            dispatch_id: Dispatch ID
            reason: Optional cancellation reason

        Returns:
            Canceled dispatch data
        """
        payload = {}
        if reason:
            payload["reason"] = reason

        return self.post(f"dispatches/{dispatch_id}/cancel", data=payload)

    def get_driver_schedule(
        self,
        driver_id: str,
        start_date: str,
        end_date: str,
    ) -> List[Dict[str, Any]]:
        """
        Get driver's schedule for a date range

        Args:
            driver_id: Driver ID
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)

        Returns:
            List of scheduled dispatches
        """
        params = {
            "driverId": driver_id,
            "startDate": start_date,
            "endDate": end_date,
        }

        response = self.get("dispatches/schedule", params=params)
        return response.get("schedule", [])
