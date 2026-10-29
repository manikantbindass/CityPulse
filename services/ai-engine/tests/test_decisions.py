import copy
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from citypulse_ai.decisions import Scenario, evaluate, optimize
from citypulse_ai.main import app

ROOT = Path(__file__).resolve().parents[3]


def basic(**changes):
    value = {
        "name": "Test only",
        "unit": "kg",
        "currency": "INR",
        "timeZone": "Asia/Kolkata",
        "periodStart": "2026-01-01T00:00:00Z",
        "periodEnd": "2026-01-02T00:00:00Z",
        "budget": 100,
        "objective": "throughput",
        "includeTradeoffs": False,
        "districts": [
            {
                "id": "a",
                "city": "bengaluru",
                "name": "Synthetic A",
                "category": "rice",
                "demand": 100,
                "availability": 0,
            }
        ],
        "stocks": [
            {"id": "s", "name": "Test stock", "category": "rice", "quantity": 80, "unitCost": 2}
        ],
    }
    value.update(changes)
    return value


def test_budget_stock_and_gap_constraints():
    result = optimize(Scenario.model_validate(basic()))
    assert result["status"] == "optimal"
    assert result["totalAllocated"] == pytest.approx(50, abs=1e-5)
    assert result["totalCost"] <= 100 + 1e-5
    assert result["remainingUnmet"] == pytest.approx(50, abs=1e-5)
    assert not result["dispatched"]


def test_receiving_capacity_and_no_inventory_from_surplus():
    value = basic()
    value["districts"][0]["receivingCapacity"] = 12
    assert optimize(Scenario.model_validate(value))["totalAllocated"] == pytest.approx(12, abs=1e-5)
    value["stocks"] = []
    value["districts"].append(
        {
            "id": "b",
            "city": "bengaluru",
            "name": "Surplus",
            "category": "rice",
            "demand": 10,
            "availability": 1000,
        }
    )
    assert optimize(Scenario.model_validate(value))["totalAllocated"] == 0


def test_hard_floor_infeasibility_never_silently_relaxes():
    result = optimize(Scenario.model_validate(basic(minimumCoverage=0.9)))
    assert result["status"] == "infeasible"
    assert result["allocations"] == []


def test_fairness_uses_existing_availability():
    value = basic(budget=1000, objective="fairness")
    value["stocks"][0]["quantity"] = 100
    value["districts"].append(
        {
            "id": "b",
            "city": "pune",
            "name": "Synthetic B",
            "category": "rice",
            "demand": 100,
            "availability": 50,
        }
    )
    result = optimize(Scenario.model_validate(value))
    assert result["status"] == "optimal"
    assert result["minimumCoverage"] == pytest.approx(0.75, abs=1e-6)
    assert result["districts"][0]["received"] == pytest.approx(75, abs=1e-5)


def test_cost_only_zero_is_valid_not_faked_throughput():
    result = optimize(Scenario.model_validate(basic(objective="cost")))
    assert result["status"] == "optimal" and result["totalAllocated"] == 0


def test_integer_allocations_and_category_separation():
    value = basic(budget=5, integral=True)
    result = optimize(Scenario.model_validate(value))
    assert result["totalAllocated"] == 2
    value["stocks"][0]["category"] = "water"
    assert optimize(Scenario.model_validate(value))["totalAllocated"] == 0


def test_lane_travel_and_capacities():
    value = basic(maxTravelMinutes=30, minimumCoverage=0.1)
    assert optimize(Scenario.model_validate(value))["status"] == "unsupported_constraint"
    value["lanes"] = [
        {"sourceId": "s", "districtId": "a", "unitCost": 1, "travelMinutes": 40, "capacity": 80}
    ]
    assert optimize(Scenario.model_validate(value))["status"] == "infeasible"
    value["lanes"][0].update(travelMinutes=20, capacity=20)
    result = optimize(Scenario.model_validate(value))
    assert result["totalAllocated"] == pytest.approx(20, abs=1e-5)
    assert result["totalCost"] == pytest.approx(60, abs=1e-5)


def test_missing_data_and_uncertain_forecast_stay_separate():
    value = basic()
    value["districts"][0]["availability"] = None
    result = evaluate(Scenario.model_validate(value))
    assert result["optimization"]["status"] == "insufficient_data"
    assert result["opportunities"][0]["score"] is None
    value = basic(demandBasis="forecast")
    assert optimize(Scenario.model_validate(value))["status"] == "insufficient_data"
    value["districts"][0]["forecastDemand"] = 200
    result = evaluate(Scenario.model_validate(value))
    assert result["opportunities"][0]["demand"] == 100
    assert result["opportunities"][0]["effectiveDemand"] == 200


@pytest.mark.parametrize(
    "change",
    [
        {"budget": -1},
        {"budget": float("nan")},
        {"timeZone": "Not/AZone"},
        {"periodEnd": "2025-12-01T00:00:00Z"},
        {"periodStart": "2026-01-01T00:00:00"},
        {"objectiveWeights": {"throughput": 0, "cost": 0, "fairness": 0}},
        {
            "stocks": [
                {"id": "s", "name": "Test", "category": "rice", "quantity": -10, "unitCost": 1}
            ]
        },
        {
            "lanes": [
                {
                    "sourceId": "missing",
                    "districtId": "a",
                    "unitCost": 1,
                    "capacity": 1,
                    "travelMinutes": 1,
                }
            ]
        },
    ],
)
def test_invalid_scenarios_rejected(change):
    with pytest.raises(ValidationError):
        Scenario.model_validate(basic(**change))


def test_duplicate_geographic_ids_rejected():
    value = basic()
    value["districts"].append(copy.deepcopy(value["districts"][0]))
    with pytest.raises(ValidationError):
        Scenario.model_validate(value)


def test_scores_are_explained_bounded_and_reproducible():
    value = json.loads((ROOT / "data/sample/decisions/retail.json").read_text())
    first = evaluate(Scenario.model_validate(value))
    second = evaluate(Scenario.model_validate(value))
    assert first["inputFingerprint"] == second["inputFingerprint"]
    assert first["resultFingerprint"] == second["resultFingerprint"]
    assert len(first["cityComparisons"]) == 2
    for row in first["opportunities"]:
        assert 0 <= row["score"] <= 100
        assert row["score"] == pytest.approx(
            sum(c["points"] for c in row["contributions"].values())
        )
    assert len(first["tradeoffs"]) == 3


@pytest.mark.parametrize("name", ["retail", "logistics", "public-service"])
def test_reproducible_use_case_fixtures(name):
    value = json.loads((ROOT / f"data/sample/decisions/{name}.json").read_text())
    result = evaluate(Scenario.model_validate(value))
    assert result["canonicalInput"]["dataMode"] == "synthetic"
    assert result["optimization"]["status"] in {"optimal", "infeasible"}


def test_service_auth_and_schema_boundary(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_TOKEN", "decision-unit-token-that-is-longer-than-32")
    client = TestClient(app)
    assert client.post("/v1/decisions/evaluate", json=basic()).status_code == 401
    response = client.post(
        "/v1/decisions/evaluate",
        json=basic(),
        headers={
            "Authorization": "Bearer decision-unit-token-that-is-longer-than-32",
            "X-Tenant-ID": "00000000-0000-0000-0000-000000000001",
        },
    )
    assert response.status_code == 200
    assert response.json()["optimization"]["status"] == "optimal"
