"""Custom exceptions for the Routing & Dispatch SDK"""


class RoutingDispatchError(Exception):
    """Base exception for all SDK errors"""

    def __init__(self, message: str, status_code: int = None):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class AuthenticationError(RoutingDispatchError):
    """Raised when API authentication fails"""

    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, status_code=401)


class ValidationError(RoutingDispatchError):
    """Raised when request validation fails"""

    def __init__(self, message: str, errors: dict = None):
        super().__init__(message, status_code=400)
        self.errors = errors


class NotFoundError(RoutingDispatchError):
    """Raised when a resource is not found"""

    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, status_code=404)


class RateLimitError(RoutingDispatchError):
    """Raised when rate limit is exceeded"""

    def __init__(self, message: str = "Rate limit exceeded", retry_after: int = None):
        super().__init__(message, status_code=429)
        self.retry_after = retry_after
