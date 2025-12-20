"""Base client with common HTTP functionality"""

import requests
from typing import Dict, Any, Optional
from .exceptions import (
    RoutingDispatchError,
    AuthenticationError,
    ValidationError,
    NotFoundError,
    RateLimitError,
)


class BaseClient:
    """Base client for API communication"""

    def __init__(
        self,
        api_key: str,
        base_url: str = "http://localhost:3000/api",
        timeout: int = 30,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "routing-dispatch-python-sdk/1.0.0",
            }
        )

    def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Make HTTP request to API

        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            endpoint: API endpoint path
            data: Request body data
            params: Query parameters

        Returns:
            Response data as dictionary

        Raises:
            AuthenticationError: When authentication fails
            ValidationError: When request validation fails
            NotFoundError: When resource not found
            RateLimitError: When rate limit exceeded
            RoutingDispatchError: For other API errors
        """
        url = f"{self.base_url}/{endpoint.lstrip('/')}"

        try:
            response = self.session.request(
                method=method,
                url=url,
                json=data,
                params=params,
                timeout=self.timeout,
            )

            # Handle error responses
            if response.status_code == 401:
                raise AuthenticationError("Invalid API key")
            elif response.status_code == 400:
                error_data = response.json() if response.content else {}
                raise ValidationError(
                    error_data.get("message", "Validation failed"),
                    errors=error_data.get("errors"),
                )
            elif response.status_code == 404:
                raise NotFoundError(response.json().get("message", "Not found"))
            elif response.status_code == 429:
                retry_after = response.headers.get("Retry-After")
                raise RateLimitError(
                    "Rate limit exceeded",
                    retry_after=int(retry_after) if retry_after else None,
                )
            elif response.status_code >= 400:
                error_msg = response.json().get("message", "API error")
                raise RoutingDispatchError(error_msg, status_code=response.status_code)

            response.raise_for_status()

            # Return JSON response
            return response.json() if response.content else {}

        except requests.exceptions.Timeout:
            raise RoutingDispatchError(f"Request timeout after {self.timeout}s")
        except requests.exceptions.ConnectionError:
            raise RoutingDispatchError(f"Connection error to {url}")
        except requests.exceptions.RequestException as e:
            raise RoutingDispatchError(f"Request failed: {str(e)}")

    def get(self, endpoint: str, params: Optional[Dict] = None) -> Dict:
        """Make GET request"""
        return self._request("GET", endpoint, params=params)

    def post(self, endpoint: str, data: Optional[Dict] = None) -> Dict:
        """Make POST request"""
        return self._request("POST", endpoint, data=data)

    def put(self, endpoint: str, data: Optional[Dict] = None) -> Dict:
        """Make PUT request"""
        return self._request("PUT", endpoint, data=data)

    def delete(self, endpoint: str) -> Dict:
        """Make DELETE request"""
        return self._request("DELETE", endpoint)
