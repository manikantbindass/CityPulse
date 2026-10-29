from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from citypulse_ai.main import app
from citypulse_ai.modeling import errors, train_dataset, features
from citypulse_ai.forecast_jobs import JobRequest, run_forecast


def records():
    return [
        {
            "city": "bengaluru",
            "district": "central",
            "category": "groceries",
            "time": (datetime(2025, 1, 1, tzinfo=timezone.utc) + timedelta(days=i)).isoformat(),
            "demand": float(100 + i * 0.1 + (i % 7) * 3),
            "dataMode": "synthetic",
        }
        for i in range(84)
    ]


def payload():
    return {
        "city": "bengaluru",
        "district": "central",
        "category": "groceries",
        "observations": [
            {"time": row["time"], "demand": row["demand"], "supply": 95} for row in records()[-28:]
        ],
        "horizon": 3,
        "dataMode": "synthetic",
    }


def test_metrics_are_computed_not_constants():
    result = errors([10, 20], [12, 16])
    assert result["mae"] == 3
    assert result["rmse"] == pytest.approx(10**0.5)
    assert errors([0], [0])["smape_percent"] == 0


def test_training_is_chronological_and_artifact_is_reproducible(tmp_path):
    rows = records()
    report = train_dataset(rows, tmp_path)
    segment = report["segments"]["bengaluru/central/groceries"]
    assert segment["trainingCount"] + segment["validationCount"] + segment["testCount"] == 84
    assert segment["trainedThrough"] < segment["testStartsAt"]
    assert {"moving-average", "seasonal-naive", "ridge"}.issubset(segment["candidates"])
    assert report["id"] == train_dataset(rows, tmp_path)["id"]
    assert features([float(i) for i in range(14)], datetime(2025, 1, 15, tzinfo=timezone.utc))[
        :3
    ] == [13, 7, 0]


def test_fallback_does_not_invent_intervals_and_jobs_are_tenant_scoped(tmp_path, monkeypatch):
    monkeypatch.setenv("MODEL_REGISTRY_DIR", str(tmp_path / "missing"))
    monkeypatch.setenv("AI_STORAGE_DIR", str(tmp_path / "storage"))
    monkeypatch.setenv("LOCAL_API_TOKEN", "test-token-for-citypulse-with-32-characters")
    client = TestClient(app)
    headers = {
        "Authorization": "Bearer test-token-for-citypulse-with-32-characters",
        "X-Tenant-ID": "00000000-0000-0000-0000-000000000001",
    }
    result = client.post("/v1/forecasts", headers=headers, json=payload())
    assert result.status_code == 200
    body = result.json()
    assert body["predictions"][0]["lower"] is None
    assert body["fallbackReason"]
    assert client.get("/v1/forecasts/" + body["id"], headers=headers).status_code == 200
    assert (
        client.get(
            "/v1/forecasts/" + body["id"],
            headers={**headers, "X-Tenant-ID": "00000000-0000-0000-0000-000000000002"},
        ).status_code
        == 404
    )
    invalid = payload()
    invalid["observations"][1]["time"] = invalid["observations"][0]["time"]
    assert client.post("/v1/forecasts", headers=headers, json=invalid).status_code == 422


def test_trained_forecast_exposes_calibration_and_fingerprint(tmp_path, monkeypatch):
    report = train_dataset(records(), tmp_path / "registry")
    monkeypatch.setenv("MODEL_REGISTRY_DIR", str(tmp_path / "registry"))
    monkeypatch.setenv("AI_STORAGE_DIR", str(tmp_path / "storage"))
    result = run_forecast(JobRequest(**payload()), "local-test-tenant")
    assert result["modelVersion"] == report["id"]
    assert len(result["trainingFingerprint"]) == 64
    assert all(row["lower"] <= row["demand"] <= row["upper"] for row in result["predictions"])
