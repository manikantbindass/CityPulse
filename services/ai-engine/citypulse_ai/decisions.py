"""Bounded, deterministic opportunity analysis and inventory transport optimization."""

import hashlib
import json
import time
from datetime import datetime
from typing import Annotated, Callable, Literal
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import numpy as np
import scipy
from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, ConfigDict, Field, model_validator
from scipy.optimize import Bounds, LinearConstraint, linprog, milp

ENGINE = "citypulse-decision-v1"
Quantity = Annotated[float, Field(ge=0, le=1e7, allow_inf_nan=False)]
Fraction = Annotated[float, Field(ge=0, le=1, allow_inf_nan=False)]
Identifier = Annotated[str, Field(pattern=r"^[A-Za-z0-9_-]{1,80}$")]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class District(Strict):
    id: Identifier
    city: Identifier
    name: str = Field(min_length=1, max_length=120)
    category: Identifier
    demand: Quantity | None = None
    availability: Quantity | None = None
    forecastDemand: Quantity | None = None
    seasonalBaseline: Quantity | None = None
    receivingCapacity: Quantity = 1e7
    minimumCoverage: Fraction = 0
    priority: float = Field(default=1, ge=0.1, le=10, allow_inf_nan=False)
    risk: Fraction = 0.5
    accessibility: Fraction | None = None
    businessesPerKm2: Quantity | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90, allow_inf_nan=False)
    longitude: float | None = Field(default=None, ge=-180, le=180, allow_inf_nan=False)
    evidence: list[str] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def location(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Latitude and longitude must be supplied together")
        if any(len(value) > 200 for value in self.evidence):
            raise ValueError("Evidence reference too long")
        return self


class Stock(Strict):
    id: Identifier
    category: Identifier
    quantity: Quantity
    unitCost: Quantity
    name: str = Field(min_length=1, max_length=120)
    evidence: list[str] = Field(default_factory=list, max_length=100)


class Lane(Strict):
    sourceId: Identifier
    districtId: Identifier
    unitCost: Quantity
    capacity: Quantity
    travelMinutes: Quantity


class ScoreWeights(Strict):
    gap: Fraction = 0.5
    risk: Fraction = 0.2
    accessibility: Fraction = 0.15
    density: Fraction = 0.1
    seasonality: Fraction = 0.05


class ObjectiveWeights(Strict):
    throughput: Fraction = 0.6
    cost: Fraction = 0.2
    fairness: Fraction = 0.2


class Scenario(Strict):
    name: str = Field(min_length=1, max_length=120)
    useCase: Literal["retail", "logistics", "public-service"] = "retail"
    origin: Literal["synthetic", "manual-assumptions", "authorized-snapshot"] = "synthetic"
    snapshotId: UUID | None = None
    networkId: UUID | None = None
    dataMode: Literal["synthetic", "historical", "live", "assumed"] = "synthetic"
    unit: Literal["count", "kg", "litre", "kwh", "trip"]
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    timeZone: str = Field(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_+/-]+$")
    periodStart: datetime
    periodEnd: datetime
    districts: list[District] = Field(min_length=1, max_length=30)
    stocks: list[Stock] = Field(max_length=10)
    lanes: list[Lane] = Field(default_factory=list, max_length=300)
    budget: Quantity
    demandBasis: Literal["observed", "forecast"] = "observed"
    demandMultiplier: float = Field(default=1, ge=0, le=5, allow_inf_nan=False)
    availabilityMultiplier: float = Field(default=1, ge=0, le=5, allow_inf_nan=False)
    minimumCoverage: Fraction = 0
    maxTravelMinutes: Quantity | None = None
    objective: Literal["throughput", "coverage", "cost", "fairness", "balanced"] = "balanced"
    objectiveWeights: ObjectiveWeights = Field(default_factory=ObjectiveWeights)
    scoreWeights: ScoreWeights = Field(default_factory=ScoreWeights)
    densityReferencePerKm2: float = Field(default=100, gt=0, le=1e7, allow_inf_nan=False)
    integral: bool = False
    includeTradeoffs: bool = True

    @model_validator(mode="after")
    def relationships(self):
        try:
            ZoneInfo(self.timeZone)
        except ZoneInfoNotFoundError as error:
            raise ValueError("Unknown IANA time zone") from error
        if self.periodStart.tzinfo is None or self.periodEnd.tzinfo is None:
            raise ValueError("Period timestamps require UTC offsets")
        seconds = (self.periodEnd - self.periodStart).total_seconds()
        if not 0 < seconds <= 366 * 86400:
            raise ValueError("Period must be positive and at most 366 days")
        for items in [self.districts, self.stocks]:
            if len({item.id for item in items}) != len(items):
                raise ValueError("Duplicate district or stock ID")
        if (
            sum(self.scoreWeights.model_dump().values()) <= 0
            or sum(self.objectiveWeights.model_dump().values()) <= 0
        ):
            raise ValueError("Weight sum must be positive")
        keys = set()
        for lane in self.lanes:
            key = (lane.sourceId, lane.districtId)
            if (
                key in keys
                or lane.sourceId not in {s.id for s in self.stocks}
                or lane.districtId not in {d.id for d in self.districts}
            ):
                raise ValueError("Duplicate lane or unknown endpoint")
            keys.add(key)
        return self


def fingerprint(value: object) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    ).hexdigest()


def quantities(s: Scenario, d: District) -> tuple[float | None, float | None]:
    demand = d.forecastDemand if s.demandBasis == "forecast" else d.demand
    return (
        None if demand is None else demand * s.demandMultiplier,
        None if d.availability is None else d.availability * s.availabilityMultiplier,
    )


def opportunities(s: Scenario) -> list[dict]:
    result = []
    for d in s.districts:
        demand, available = quantities(s, d)
        components = {"risk": 1 - d.risk}
        gap = None if demand is None or available is None else max(0, demand - available)
        if gap is not None:
            components["gap"] = gap / demand if demand else 0
        if d.accessibility is not None:
            components["accessibility"] = d.accessibility
        if d.businessesPerKm2 is not None:
            components["density"] = 1 / (1 + d.businessesPerKm2 / s.densityReferencePerKm2)
        seasonal_change = None
        if demand is not None and d.seasonalBaseline is not None:
            seasonal_change = (demand - d.seasonalBaseline) / max(1, d.seasonalBaseline)
            components["seasonality"] = 0.5 + 0.5 * seasonal_change / (1 + abs(seasonal_change))
        weights = s.scoreWeights.model_dump()
        total = sum(weights[key] for key in components)
        contributions = {
            key: {
                "value": value,
                "weight": weights[key] / total if total else 0,
                "points": 100 * value * weights[key] / total if total else 0,
            }
            for key, value in components.items()
        }
        result.append(
            {
                **d.model_dump(),
                "effectiveDemand": demand,
                "effectiveAvailability": available,
                "gap": gap,
                "ratio": demand / available if available and demand is not None else None,
                "score": sum(c["points"] for c in contributions.values())
                if gap is not None and total
                else None,
                "seasonalChangeFraction": seasonal_change,
                "contributions": contributions,
                "missingFeatures": [key for key in weights if key not in components],
                "interpretation": "Investigation candidate only; score is a configurable heuristic, not probability, profit or investment advice.",
            }
        )
    return sorted(result, key=lambda r: (r["score"] is None, -(r["score"] or 0), r["id"]))


def optimize(s: Scenario, objective: str | None = None) -> dict:
    objective = objective or s.objective
    districts = sorted(s.districts, key=lambda d: d.id)
    stocks = sorted(s.stocks, key=lambda stock: stock.id)
    q = [quantities(s, d) for d in districts]
    if any(demand is None or availability is None for demand, availability in q):
        return {
            "status": "insufficient_data",
            "objective": objective,
            "diagnostics": [
                "Demand and availability must both be known for every district; missing is not zero."
            ],
            "allocations": [],
        }
    if s.maxTravelMinutes is not None and not s.lanes:
        return {
            "status": "unsupported_constraint",
            "objective": objective,
            "diagnostics": [
                "Travel constraints need explicit lane times; no road network or travel time was invented."
            ],
            "allocations": [],
        }
    lane_index = {(lane.sourceId, lane.districtId): lane for lane in s.lanes}
    edges = []
    for i, stock in enumerate(stocks):
        for j, district in enumerate(districts):
            lane = lane_index.get((stock.id, district.id))
            if stock.category != district.category or (s.lanes and lane is None):
                continue
            if lane and s.maxTravelMinutes is not None and lane.travelMinutes > s.maxTravelMinutes:
                continue
            edges.append(
                (
                    i,
                    j,
                    stock.unitCost + (lane.unitCost if lane else 0),
                    lane.capacity if lane else stock.quantity,
                )
            )
    n = len(edges)
    # Include one max-min coverage variable, even when all lanes are excluded.
    a, b = [], []

    def constraint(coefficients, maximum):
        a.append(coefficients)
        b.append(maximum)

    for i, stock in enumerate(stocks):
        constraint([1 if e[0] == i else 0 for e in edges] + [0], stock.quantity)
    total_gap = sum(max(0, demand - available) for demand, available in q)
    required = []
    for j, (district, (demand, available)) in enumerate(zip(districts, q)):
        row = [1 if e[1] == j else 0 for e in edges] + [0]
        gap = max(0, demand - available)
        constraint(row, min(gap, district.receivingCapacity))
        floor = max(0, max(s.minimumCoverage, district.minimumCoverage) * demand - available)
        required.append(floor)
        constraint([-v for v in row], -floor)
        if demand > 0:
            constraint([-v / demand for v in row[:-1]] + [1], min(1, available / demand))
    costs = np.array([e[2] for e in edges] + [0.0])
    constraint(costs.tolist(), s.budget)
    bounds = [(0, e[3]) for e in edges] + [(0, 1)]
    c = np.zeros(n + 1)
    w = s.objectiveWeights.model_dump()
    norm = sum(w.values())
    max_priority = max(d.priority for d in districts)
    for k, (_, j, cost, _) in enumerate(edges):
        demand = q[j][0]
        priority = districts[j].priority
        if objective == "cost":
            c[k] = cost
        elif objective == "coverage":
            c[k] = -priority / max(1, demand)
        elif objective == "throughput":
            c[k] = -1
        elif objective == "balanced":
            c[k] = -w["throughput"] / norm * priority / (max_priority * max(1, total_gap)) + w[
                "cost"
            ] / norm * cost / max(1, s.budget)
    if objective == "fairness":
        c[-1] = -1
    elif objective == "balanced":
        c[-1] = -w["fairness"] / norm
    matrix, maxima = np.array(a, dtype=float), np.array(b, dtype=float)

    def solve(coefficients, matrix, maxima):
        if s.integral:
            return milp(
                coefficients,
                integrality=np.array([1] * n + [0]),
                bounds=Bounds(np.array([x[0] for x in bounds]), np.array([x[1] for x in bounds])),
                constraints=LinearConstraint(matrix, -np.inf, maxima),
                options={"time_limit": 2, "mip_rel_gap": 0},
            )
        return linprog(
            coefficients,
            A_ub=matrix,
            b_ub=maxima,
            bounds=bounds,
            method="highs",
            options={"time_limit": 2},
        )

    solution = solve(c, matrix, maxima)
    if not solution.success:
        return {
            "status": {1: "time_limit", 2: "infeasible", 3: "unbounded"}.get(
                solution.status, "solver_error"
            ),
            "objective": objective,
            "allocations": [],
            "diagnostics": [
                f"Hard coverage floors require {sum(required):.4f} additional {s.unit}; total stock is {sum(stock.quantity for stock in stocks):.4f}.",
                "Joint budget, category, lane, stock and receiving limits were not relaxed. No irreducible infeasible set is claimed.",
            ],
        }
    # Secondary cost minimization avoids arbitrary expensive ties while preserving
    # the primary objective within absolute tolerance.
    tie = solve(
        costs + np.array([1e-9] * n + [0]),
        np.vstack([matrix, c]),
        np.append(maxima, solution.fun + 1e-8),
    )
    if tie.success:
        solution = tie
    x = solution.x
    if s.integral:
        x[:n] = np.rint(x[:n])
    x[:n] = np.maximum(0, x[:n])
    violation = max(
        0,
        float(np.max(matrix @ x - maxima)),
        float(np.max(-x)),
        float(np.max(x - np.array([bound[1] for bound in bounds]))),
    )
    if violation > 1e-5 or (s.integral and any(abs(v - round(v)) > 1e-5 for v in x[:n])):
        return {
            "status": "numerical_failure",
            "objective": objective,
            "diagnostics": ["Solution failed independent constraint/integrality checks."],
            "allocations": [],
        }
    received = [
        sum(max(0, x[k]) for k, e in enumerate(edges) if e[1] == j) for j in range(len(districts))
    ]
    coverage = [
        min(1, (available + received[j]) / demand) if demand else 1
        for j, (demand, available) in enumerate(q)
    ]
    result = {
        "status": "optimal",
        "objective": objective,
        "allocations": [
            {
                "sourceId": stocks[i].id,
                "districtId": districts[j].id,
                "quantity": float(max(0, x[k])),
                "unitCost": cost,
            }
            for k, (i, j, cost, _) in enumerate(edges)
            if x[k] > 1e-7
        ],
        "districts": [
            {
                "id": d.id,
                "received": received[j],
                "coverage": coverage[j],
                "unmet": max(0, q[j][0] - q[j][1] - received[j]),
            }
            for j, d in enumerate(districts)
        ],
        "totalAllocated": sum(received),
        "totalCost": float(costs @ x),
        "minimumCoverage": min(coverage),
        "remainingUnmet": max(0, total_gap - sum(received)),
        "maxConstraintViolation": violation,
        "dispatched": False,
        "diagnostics": [
            "Costs are planning inputs, not revenue or ROI. A cost-only objective can allocate zero when no coverage floor is required."
        ],
    }
    return result


def evaluate(s: Scenario) -> dict:
    start = time.perf_counter()
    canonical = s.model_dump(mode="json")
    rankings = opportunities(s)
    plan = optimize(s)
    alternatives = (
        [optimize(s, objective) for objective in ["throughput", "cost", "fairness"]]
        if s.includeTradeoffs
        else []
    )
    cities = []
    for city in sorted({d.city for d in s.districts}):
        rows = [r for r in rankings if r["city"] == city]
        scores = [r["score"] for r in rows if r["score"] is not None]
        allocation_by_id = {d["id"]: d for d in plan.get("districts", [])}
        cities.append(
            {
                "city": city,
                "groupCount": len(rows),
                "scoredGroupCount": len(scores),
                "meanScore": sum(scores) / len(scores) if scores else None,
                "knownGap": sum(r["gap"] for r in rows if r["gap"] is not None),
                "plannedAllocation": sum(
                    allocation_by_id.get(r["id"], {}).get("received", 0) for r in rows
                ),
                "missingDistricts": sum(r["gap"] is None for r in rows),
            }
        )
    result = {
        "engineVersion": ENGINE,
        "solver": "SciPy HiGHS",
        "scipyVersion": scipy.__version__,
        "inputFingerprint": fingerprint(canonical),
        "canonicalInput": canonical,
        "opportunities": rankings,
        "cityComparisons": cities,
        "optimization": plan,
        "tradeoffs": alternatives,
        "assumptions": {
            "origin": s.origin,
            "dataMode": s.dataMode,
            "demandBasis": s.demandBasis,
            "demandMultiplier": s.demandMultiplier,
            "availabilityMultiplier": s.availabilityMultiplier,
            "riskAndPriority": "Operator assumptions, not learned investment risk",
            "network": "Registered supplied lanes"
            if s.networkId
            else "Abstract/assumed lanes; no real road routing",
        },
        "limitations": [
            "No guaranteed profit or investment success. Scores are relative heuristics, not financial valuations.",
            "Same units, currency and comparable period are required. Coverage is quantity coverage, not population accessibility.",
            "Flows are divisible unless integral=true. Stocks are explicit inventory; observed supply is not automatically redistributable stock.",
            "Lane travel limits do not solve vehicle tours, traffic, schedules or delivery time windows.",
            "Seasonal baselines and forecasts must have compatible horizons; inferred causality and market validation are not provided.",
        ],
    }
    result["resultFingerprint"] = fingerprint(
        {key: value for key, value in result.items() if key != "canonicalInput"}
    )
    result["computeMs"] = round((time.perf_counter() - start) * 1000, 3)
    return result


def build_decision_router(auth: Callable) -> APIRouter:
    router = APIRouter(dependencies=[Depends(auth)], tags=["decisions"])

    @router.post("/v1/decisions/evaluate")
    def decision(payload: Scenario, x_tenant_id: Annotated[UUID, Header()]):
        return evaluate(payload)

    return router
