"""
Routing & Dispatch SDK for Python
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

A Python client library for the Routing & Dispatch SaaS API.

Usage:
    >>> from routing_dispatch_sdk import RoutingClient, DispatchClient
    >>> routing = RoutingClient(api_key="your-api-key")
    >>> route = routing.plan_route(vehicle_id="v123", job_ids=["j1", "j2"])
"""

__version__ = "1.0.0"
__author__ = "Routing & Dispatch Team"

from .routing_client import RoutingClient
from .dispatch_client import DispatchClient
from .exceptions import (
    RoutingDispatchError,
    AuthenticationError,
    ValidationError,
    NotFoundError,
    RateLimitError,
)

__all__ = [
    "RoutingClient",
    "DispatchClient",
    "RoutingDispatchError",
    "AuthenticationError",
    "ValidationError",
    "NotFoundError",
    "RateLimitError",
]
