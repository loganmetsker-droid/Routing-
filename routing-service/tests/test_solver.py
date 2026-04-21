import unittest
from datetime import datetime

from app.schemas import OptimizeRequest
from app.solver import build_time_matrix, solve_optimize_request


class SolverContractTest(unittest.TestCase):
    def test_build_time_matrix_returns_square_matrix(self):
        matrix = build_time_matrix([(39.1, -94.5), (39.2, -94.6), (39.3, -94.7)])

        self.assertEqual(len(matrix), 3)
        self.assertEqual(len(matrix[0]), 3)
        self.assertEqual(matrix[0][0], 0)

    def test_solver_returns_route_for_simple_feasible_request(self):
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
                    "lat": 39.1097,
                    "lng": -94.5686,
                    "service_minutes": 10,
                    "priority": 3,
                    "volume": 2,
                }
            ],
        )

        result = solve_optimize_request(request)

        self.assertEqual(len(result.routes), 1)
        self.assertEqual(result.routes[0].vehicle_id, "vehicle-1")
        self.assertEqual(result.routes[0].ordered_stops[0].stop_id, "stop-1")
        self.assertEqual(result.unassigned_stop_ids, [])


if __name__ == "__main__":
    unittest.main()
