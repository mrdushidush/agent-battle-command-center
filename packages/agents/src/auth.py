"""Inbound authentication for the agents service.

This service runs code: /run-validation executes the command it is sent, and
/execute runs agents that have shell tools. Its only legitimate caller is the
API server, so every route except /health requires the same X-API-Key the API
itself checks (packages/api/src/middleware/auth.ts). Reaching the port is not
enough to run a command.
"""
import hmac

from fastapi import Request
from fastapi.responses import JSONResponse

from src.config import settings


async def require_api_key(request: Request, call_next):
    """Reject any request without the configured API key, except /health."""
    if request.url.path == "/health":
        return await call_next(request)

    expected = settings.API_KEY
    # Reject all requests if no API key is configured, as the API does
    if not expected:
        return JSONResponse(
            status_code=500,
            content={
                "error": "Server misconfiguration",
                "message": "API authentication is not configured. Set API_KEY.",
            },
        )

    provided = request.headers.get("x-api-key")
    if not provided:
        return JSONResponse(
            status_code=401,
            content={
                "error": "Unauthorized",
                "message": "API key required. Provide via X-API-Key header.",
            },
        )

    if not hmac.compare_digest(provided.encode(), expected.encode()):
        return JSONResponse(
            status_code=403,
            content={"error": "Forbidden", "message": "Invalid API key"},
        )

    return await call_next(request)
