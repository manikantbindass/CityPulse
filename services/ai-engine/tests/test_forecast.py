import pytest
from fastapi.testclient import TestClient

from citypulse_ai.domain import forecast
from citypulse_ai.main import app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("LOCAL_API_TOKEN", "test-token-for-citypulse-with-32-characters")
    return TestClient(app)


AUTH = {"Authorization": "Bearer test-token-for-citypulse-with-32-characters"}


def test_trend_and_nonnegative_floor():
    assert forecast([10, 20, 30], 2) == [40, 50]
    assert forecast([30, 20, 10], 2) == [0, 0]


@pytest.mark.parametrize("values", [[1, 2], [-1, 0, 1], [1, float("nan"), 3]])
def test_domain_rejects_invalid_observations(values):
    with pytest.raises(ValueError):
        forecast(values, 3)


def test_health_and_authorization(client):
    assert client.get("/health").status_code == 200
    assert client.post("/api/v1/forecasts", json={"values": [1, 2, 3]}).status_code == 401
    response = client.post(
        "/api/v1/forecasts", headers=AUTH, json={"values": [10, 20, 30], "horizon": 2}
    )
    assert response.status_code == 200
    assert response.json()["predictions"] == [40, 50]


@pytest.mark.parametrize(
    "payload",
    [
        {"values": [1, 2]},
        {"values": [1, 2, -3]},
        {"values": [1, 2, 3], "horizon": 169},
        {"values": [1, 2, 3], "horizon": 1.5},
    ],
)
def test_http_validation(client, payload):
    response = client.post("/api/v1/forecasts", headers=AUTH, json=payload)
    assert response.status_code == 422
    assert response.headers["content-type"] == "application/problem+json"
