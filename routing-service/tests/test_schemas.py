import unittest
from datetime import datetime

from app.schemas import OptimizeRequest


class OptimizeSchemaTest(unittest.TestCase):
    def test_optimize_request_accepts_locked_vehicle_and_time_windows(self):
        request = OptimizeRequest(
            plan_date=datetime(2026, 4, 10, 8, 0, 0),
            vehicles=[
                {
                    "id": "vehicle-1",
                    "start_lat": 39.0997,
                    "start_lng": -94.5786,
                    "capacity_volume": 10,
                    "max_route_minutes": 480,
                }
            ],
            stops=[
                {
                    "id": "stop-1",
                    "lat": 39.1200,
                    "lng": -94.5800,
                    "service_minutes": 15,
                    "tw_start": datetime(2026, 4, 10, 9, 0, 0),
                    "tw_end": datetime(2026, 4, 10, 10, 0, 0),
                    "priority": 2,
                    "volume": 3,
                    "locked_vehicle_id": "vehicle-1",
                }
            ],
        )

        self.assertEqual(request.vehicles[0].id, "vehicle-1")
        self.assertEqual(request.stops[0].locked_vehicle_id, "vehicle-1")
        self.assertEqual(request.stops[0].service_minutes, 15)


if __name__ == "__main__":
    unittest.main()
