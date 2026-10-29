"""Persistent forecast jobs and read-only model metadata. No training in requests."""

from __future__ import annotations
import json
import math
import os
import sqlite3
import time
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, model_validator

from citypulse_ai.modeling import load_artifact, predict_one, fingerprint


class Observation(BaseModel):
    time: datetime
    demand: float = Field(ge=0, le=1e12, allow_inf_nan=False)
    supply: float | None = Field(default=None, ge=0, le=1e12, allow_inf_nan=False)


class JobRequest(BaseModel):
    city: str = Field(pattern=r"^[a-z0-9-]{1,60}$")
    district: str = Field(pattern=r"^[a-z0-9-]{1,60}$")
    category: str = Field(pattern=r"^[a-z0-9-]{1,60}$")
    observations: list[Observation] = Field(min_length=14, max_length=10000)
    horizon: int = Field(default=7, ge=1, le=90, strict=True)
    dataMode: str = Field(default="synthetic", pattern=r"^(synthetic|historical|live)$")

    @model_validator(mode="after")
    def regular_daily(self):
        times = [row.time for row in self.observations]
        if any(t.tzinfo is None or t.utcoffset() is None for t in times):
            raise ValueError("Offset-aware timestamps are required")
        for row in self.observations:
            row.time = row.time.astimezone(timezone.utc)
        if any(b - a != timedelta(days=1) for a, b in zip(times, times[1:])):
            raise ValueError(
                "Provide ordered unique daily observations; irregular series are not silently resampled"
            )
        return self


@lru_cache(maxsize=64)
def cached_model(folder: str, serialized: str):
    return load_artifact(Path(folder), json.loads(serialized))


def storage() -> Path:
    folder = Path(os.environ.get("AI_STORAGE_DIR", ".data/ai"))
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def registry():
    root = Path(os.environ.get("MODEL_REGISTRY_DIR", ".models"))
    if not (root / "active.json").exists():
        return root, None
    name = json.loads((root / "active.json").read_text())["id"]
    if not name.startswith("daily-v1-") or not name.replace("-", "").isalnum():
        raise ValueError("Invalid model registry pointer")
    folder = root / name
    return folder, json.loads((folder / "registry.json").read_text())


def connection():
    db = sqlite3.connect(storage() / "forecasts.sqlite3", timeout=5)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute(
        "CREATE TABLE IF NOT EXISTS forecasts(id TEXT PRIMARY KEY,tenant TEXT NOT NULL,result TEXT NOT NULL)"
    )
    return db


def run_forecast(request: JobRequest, tenant: str) -> dict:
    start = time.perf_counter()
    values = [row.demand for row in request.observations]
    key = f"{request.city}/{request.district}/{request.category}"
    model_name = "seasonal-naive"
    version = "fallback-seasonal-naive-v1"
    model = None
    segment = None
    report = None
    reason = None
    try:
        folder, report = registry()
        segment = report["segments"].get(key) if report else None
        if segment and report["dataMode"] == "synthetic" and request.dataMode != "synthetic":
            segment = None
            reason = "Synthetic model is not used for nonsynthetic input; baseline fallback"
        if segment:
            model_name = segment["selectedModel"]
            version = report["id"]
            model = cached_model(str(folder), json.dumps(segment, sort_keys=True))
        else:
            reason = "No trained artifact for this segment; seasonal-naive fallback"
    except (ValueError, OSError, ImportError, KeyError):
        model_name = "seasonal-naive"
        version = "fallback-seasonal-naive-v1"
        model = None
        segment = None
        reason = "Registry unavailable; seasonal-naive fallback"
    radius = segment["intervalRadius"] if segment else None
    history = list(values)
    predictions = []
    supply_history = [row.supply for row in request.observations]
    supply_complete = all(v is not None for v in supply_history)
    for step in range(1, request.horizon + 1):
        date = request.observations[-1].time + timedelta(days=step)
        value = predict_one(model_name, model, history, date)
        history.append(value)
        supply = float(supply_history[-7 + ((step - 1) % 7)]) if supply_complete else None
        width = radius * math.sqrt(step) if radius is not None else None
        predictions.append(
            {
                "time": date.isoformat(),
                "demand": round(value, 4),
                "lower": round(max(0, value - width), 4) if width is not None else None,
                "upper": round(value + width, 4) if width is not None else None,
                "supplyBaseline": supply,
                "imbalance": round(value - supply, 4) if supply is not None else None,
                "shortageHotspot": value > supply if supply is not None else None,
            }
        )
    previous = values[:-1]
    median = sorted(previous[-28:])[len(previous[-28:]) // 2]
    deviations = sorted(abs(v - median) for v in previous[-28:])
    mad = deviations[len(deviations) // 2]
    anomaly = abs(values[-1] - median) > max(1e-9, 3 * 1.4826 * mad)
    mean_recent = sum(values[-7:]) / 7
    drift = (
        None
        if not segment
        else {
            "meanShiftStandardDeviations": abs(mean_recent - segment["trainingMean"])
            / max(1e-9, segment["trainingStdDev"]),
            "method": "recent 7-day mean versus training mean/std; diagnostic only",
        }
    )
    shortfalls = [max(0, row["imbalance"]) for row in predictions if row["imbalance"] is not None]
    result = {
        "id": str(uuid4()),
        "city": request.city,
        "district": request.district,
        "category": request.category,
        "dataMode": request.dataMode,
        "model": model_name,
        "modelVersion": version,
        "trainingDataMode": report["dataMode"] if segment and report else None,
        "requestFingerprint": fingerprint(request.model_dump(mode="json")),
        "trainingFingerprint": report["datasetFingerprint"] if segment and report else None,
        "predictions": predictions,
        "intervalMethod": report["intervalMethod"]
        if segment and report
        else "Unavailable without calibration data; no confidence interval fabricated",
        "fallbackReason": reason,
        "anomaly": {
            "latestDemandFlag": anomaly,
            "method": "past-only 28-point median/MAD, threshold 3 robust standard deviations",
        },
        "drift": drift,
        "recommendation": {
            "additionalUnits": round(sum(shortfalls), 4) if supply_complete else None,
            "method": "sum of positive forecast gap; human review required; no dispatch",
        },
        "explanation": {
            "features": segment["featureImportance"] if segment else {},
            "meaning": segment["featureImportanceMeaning"]
            if segment
            else "Seasonal-naive repeats the same weekday from the previous week; no learned feature weights",
        },
        "predictionLatencyMs": round((time.perf_counter() - start) * 1000, 3),
    }
    with connection() as db:
        db.execute(
            "INSERT INTO forecasts(id,tenant,result) VALUES(?,?,?)",
            (result["id"], tenant, json.dumps(result, allow_nan=False)),
        )
    return result


def build_router(auth):
    router = APIRouter(prefix="/v1", dependencies=[Depends(auth)])

    @router.post("/forecasts")
    def create(request: JobRequest, x_tenant_id: Annotated[UUID, Header()]):
        return run_forecast(request, str(x_tenant_id))

    @router.get("/forecasts/{job_id}")
    def retrieve(job_id: UUID, x_tenant_id: Annotated[UUID, Header()]):
        with connection() as db:
            row = db.execute(
                "SELECT result FROM forecasts WHERE id=? AND tenant=?",
                (str(job_id), str(x_tenant_id)),
            ).fetchone()
        if not row:
            raise HTTPException(404, "Forecast not found")
        return json.loads(row[0])

    @router.post("/forecasts/batch")
    def batch(requests: list[JobRequest], x_tenant_id: Annotated[UUID, Header()]):
        if not 1 <= len(requests) <= 20 or sum(len(r.observations) for r in requests) > 10000:
            raise HTTPException(422, "Use at most 20 series and 10000 total observations")
        return {"items": [run_forecast(request, str(x_tenant_id)) for request in requests]}

    @router.get("/models")
    def models():
        try:
            _, report = registry()
            return {
                "active": report["id"] if report else None,
                "models": [
                    {
                        "id": report["id"],
                        "dataMode": report["dataMode"],
                        "segments": list(report["segments"]),
                    }
                ]
                if report
                else [],
                "fallback": "seasonal-naive",
            }
        except (OSError, ValueError, KeyError):
            return {
                "active": None,
                "models": [],
                "fallback": "seasonal-naive",
                "status": "registry-unavailable",
            }

    @router.get("/models/{model_id}/metrics")
    def model_metrics(model_id: str):
        try:
            _, report = registry()
            if not report or report["id"] != model_id:
                raise HTTPException(404, "Active model metrics not found")
            return report
        except (OSError, ValueError, KeyError) as error:
            raise HTTPException(503, "Model registry unavailable") from error

    return router
