from fastapi import Request
from fastapi.responses import JSONResponse


class APIError(Exception):
    """Error mapped to a clean JSON body: {"error": code, "detail": message}."""

    def __init__(self, status: int, code: str, message: str):
        self.status, self.code, self.message = status, code, message
        super().__init__(message)


async def api_error_handler(_: Request, exc: APIError) -> JSONResponse:
    return JSONResponse(status_code=exc.status, content={"error": exc.code, "detail": exc.message})
