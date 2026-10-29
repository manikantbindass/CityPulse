import hmac
import os
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from citypulse_ai.domain import forecast

from citypulse_ai.limits import BodyLimitMiddleware

app = FastAPI(title="CityPulse Forecast API", version="1.0.0")
app.add_middleware(BodyLimitMiddleware)


def require_token(authorization: Annotated[str | None, Header()] = None) -> None:
    token = os.environ.get("AI_SERVICE_TOKEN") or os.environ.get("LOCAL_API_TOKEN", "")
    if len(token) < 32 or token.startswith("replace-"):
        raise HTTPException(503, "Service authentication is not configured")
    if not hmac.compare_digest(authorization or "", f"Bearer {token}"):
        raise HTTPException(401, "A valid service token is required")


class ForecastRequest(BaseModel):
    values: list[Annotated[float, Field(ge=0, le=1e12, allow_inf_nan=False)]] = Field(
        min_length=3, max_length=10000
    )
    horizon: int = Field(default=3, ge=1, le=168, strict=True)
    interval_minutes: int = Field(default=60, ge=1, le=1440, strict=True)


class ForecastResponse(BaseModel):
    model: str = "linear-trend-v1"
    predictions: list[float]
    interval_minutes: int
    synthetic_safe_baseline: bool = True


@app.exception_handler(HTTPException)
async def http_error(request: Request, error: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        media_type="application/problem+json",
        content={
            "type": "urn:citypulse:problem:http-error",
            "title": "Request failed",
            "status": error.status_code,
            "detail": error.detail,
            "instance": request.url.path,
            "code": "HTTP_ERROR",
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, error: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        media_type="application/problem+json",
        content={
            "type": "urn:citypulse:problem:validation",
            "title": "Validation failed",
            "status": 422,
            "code": "VALIDATION_ERROR",
            "instance": request.url.path,
            "detail": "Request fields failed schema validation. See the endpoint OpenAPI schema.",
        },
    )


@app.get("/health", tags=["operations"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "citypulse-ai"}


@app.post(
    "/api/v1/forecasts",
    response_model=ForecastResponse,
    dependencies=[Depends(require_token)],
    tags=["forecasts"],
)
def create_forecast(payload: ForecastRequest) -> ForecastResponse:
    return ForecastResponse(
        predictions=forecast(payload.values, payload.horizon),
        interval_minutes=payload.interval_minutes,
    )


from citypulse_ai.forecast_jobs import build_router  # noqa: E402

app.include_router(build_router(require_token))

from citypulse_ai.pulseai import build_pulseai_router  # noqa: E402

app.include_router(build_pulseai_router(require_token))

from citypulse_ai.decisions import build_decision_router  # noqa: E402

app.include_router(build_decision_router(require_token))
