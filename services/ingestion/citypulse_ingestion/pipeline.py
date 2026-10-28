"""Bounded interchange ingestion with explicit provenance and quality diagnostics."""
from __future__ import annotations

import csv
import hashlib
import io
import json
import math
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

REQUIRED = {"cityId", "zoneId", "sourceId", "externalId", "kind", "commodity", "quantity", "unit", "observedAt", "periodEnd"}
UNITS = {"count", "kg", "litre", "kwh", "trip"}


def digest(value: object) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def parse_time(value: str) -> datetime:
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.tzinfo is None or result.utcoffset() is None:
        raise ValueError("Timestamp must include a UTC offset")
    return result.astimezone(timezone.utc)


def read_rows(path: Path) -> list[dict]:
    if path.stat().st_size > 10_000_000:
        raise ValueError("Input exceeds 10 MB local pipeline limit")
    content = path.read_text(encoding="utf-8-sig")
    if path.suffix.lower() == ".csv":
        result = list(csv.DictReader(io.StringIO(content)))
    else:
        value = json.loads(content)
        if isinstance(value, dict) and value.get("type") == "FeatureCollection":
            result = []
            for feature in value.get("features", []):
                if feature.get("type") != "Feature" or not isinstance(feature.get("properties"), dict):
                    raise ValueError("GeoJSON requires Features with object properties")
                row = dict(feature["properties"])
                geometry = feature.get("geometry", {})
                if geometry.get("type") != "Point" or len(geometry.get("coordinates", [])) != 2:
                    raise ValueError("Observation GeoJSON requires 2D Point geometry in WGS84")
                row["longitude"], row["latitude"] = geometry["coordinates"]
                result.append(row)
        elif isinstance(value, list):
            result = value
        else:
            raise ValueError("Expected a JSON array, CSV header table, or observation FeatureCollection")
    if not result or len(result) > 100000 or not all(isinstance(row, dict) for row in result):
        raise ValueError("Use 1..100000 object rows")
    return result


def normalize(row: dict, catalog: dict) -> dict:
    if not REQUIRED.issubset(row):
        raise ValueError("Missing fields: " + ", ".join(sorted(REQUIRED - row.keys())))
    allowed = REQUIRED | {"businessId", "longitude", "latitude", "timezone", "currency", "dataMode", "capacity"}
    if set(row) - allowed:
        raise ValueError("Unknown columns are rejected to prevent accidental PII ingestion")
    result = {key: value.strip() if isinstance(value, str) else value for key, value in row.items()}
    for key in ["cityId", "zoneId", "sourceId"]:
        UUID(result[key])
    if result.get("businessId"):
        UUID(result["businessId"])
    if not str(result["externalId"]) or len(str(result["externalId"])) > 100:
        raise ValueError("externalId must have 1..100 characters")
    if result["kind"] not in {"supply", "demand"} or result["unit"] not in UNITS:
        raise ValueError("Unsupported kind or unit")
    result["commodity"] = str(result["commodity"]).strip().lower()
    if not result["commodity"] or len(result["commodity"]) > 80:
        raise ValueError("Commodity must have 1..80 characters")
    try:
        quantity = Decimal(str(result["quantity"]))
    except InvalidOperation as error:
        raise ValueError("Quantity must be numeric") from error
    if not quantity.is_finite() or quantity < 0 or quantity >= Decimal("1e14"):
        raise ValueError("Quantity must be finite and nonnegative within numeric(18,4)")
    if quantity.as_tuple().exponent < -4:
        raise ValueError("At most four fractional digits are supported; no silent rounding")
    result["quantity"] = float(quantity)
    start, end = parse_time(result["observedAt"]), parse_time(result["periodEnd"])
    if end <= start:
        raise ValueError("periodEnd must be after observedAt")
    result["observedAt"], result["periodEnd"] = start.isoformat(), end.isoformat()
    tz = str(result.get("timezone") or catalog["timezone"])
    try:
        ZoneInfo(tz)
    except ZoneInfoNotFoundError as error:
        raise ValueError("Unknown IANA timezone") from error
    result["timezone"] = tz
    result["currency"] = result.get("currency") or catalog["currency"]
    if result["currency"] != catalog["currency"]:
        raise ValueError("Currency differs from source catalog")
    mode = result.get("dataMode") or catalog["dataMode"]
    if mode not in {"synthetic", "historical", "live"} or mode != catalog["dataMode"]:
        raise ValueError("Data mode must match catalog; live status is never inferred")
    result["dataMode"] = mode
    spatial = "longitude" in result and "latitude" in result
    if ("longitude" in result) != ("latitude" in result):
        raise ValueError("Both coordinates are required")
    if spatial:
        lon, lat = float(result["longitude"]), float(result["latitude"])
        if not math.isfinite(lon) or not math.isfinite(lat) or not (-180 <= lon <= 180 and -90 <= lat <= 90):
            raise ValueError("Coordinates outside WGS84 bounds")
        west, south, east, north = catalog["bounds"]
        if not (west <= lon <= east and south <= lat <= north):
            raise ValueError("Observation is outside the configured synthetic city rectangle")
        result["longitude"], result["latitude"] = lon, lat
    if "capacity" in result:
        capacity = float(result["capacity"])
        if not math.isfinite(capacity) or capacity < 0:
            raise ValueError("Capacity must be finite and nonnegative")
        result["capacity"] = capacity
    result["qualityScore"] = 1.0 if spatial else 0.8
    result["provenance"] = {"sourceUri": catalog["sourceUri"], "licenseReference": catalog["licenseReference"], "dataMode": mode, "schemaVersion": 1, "geographicCheck": "city-rectangle" if spatial else "ids-only; PostGIS checks on publish"}
    result["payloadSha256"] = digest({key: value for key, value in result.items() if key not in {"qualityScore", "provenance"}})
    return result


def ingest(path: Path, catalog: dict, state: dict | None = None) -> dict:
    for key in ["sourceUri", "licenseReference", "timezone", "currency", "dataMode", "bounds"]:
        if not catalog.get(key):
            raise ValueError(f"Catalog requires {key}")
    state = dict(state or {})
    accepted, rejected, duplicates = [], [], 0
    for index, row in enumerate(read_rows(path), 1):
        try:
            value = normalize(row, catalog)
            key = value["sourceId"] + ":" + value["externalId"]
            if key in state:
                if state[key] != value["payloadSha256"]:
                    raise ValueError("Duplicate source/externalId conflicts with an existing digest")
                duplicates += 1
                continue
            state[key] = value["payloadSha256"]
            accepted.append(value)
        except (ValueError, TypeError, KeyError, OverflowError) as error:
            # Do not copy raw input into dead letters: it might contain private fields.
            rejected.append({"row": index, "reason": str(error), "retryable": False})
    return {"accepted": accepted, "deadLetters": rejected, "duplicates": duplicates, "state": state, "ingestedAt": datetime.now(timezone.utc).isoformat(), "quality": {"accepted": len(accepted), "rejected": len(rejected), "duplicate": duplicates, "status": "passed" if not rejected else "partial"}}


def haversine(a: tuple[float, float], b: tuple[float, float]) -> float:
    lon1, lat1, lon2, lat2 = map(math.radians, (*a, *b))
    return 6371008.8 * 2 * math.asin(min(1, math.sqrt(math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2)))


def metrics(rows: list[dict]) -> dict:
    """Never aggregate across units, commodities, source modes or unequal windows."""
    groups = defaultdict(list)
    for row in rows:
        duration = (parse_time(row["periodEnd"]) - parse_time(row["observedAt"])).total_seconds()
        groups[(row["commodity"], row["unit"], row["dataMode"], duration)].append(row)
    result = []
    for (commodity, unit, mode, duration), group in sorted(groups.items()):
        demand = math.fsum(r["quantity"] for r in group if r["kind"] == "demand")
        supply = math.fsum(r["quantity"] for r in group if r["kind"] == "supply")
        buckets = defaultdict(lambda: {"demand": 0.0, "supply": 0.0})
        for row in group:
            buckets[row["observedAt"]][row["kind"]] += row["quantity"]
        trend = [{"time": key, **value} for key, value in sorted(buckets.items())]
        values = [value["demand"] for value in trend]
        mean = math.fsum(values)/len(values) if values else 0
        variance = math.fsum((v-mean)**2 for v in values)/len(values) if values else 0
        comparisons = []
        for bucket in trend:
            previous = (parse_time(bucket["time"]) - timedelta(days=7)).isoformat()
            if previous in buckets:
                baseline = buckets[previous]["demand"]
                comparisons.append({"time": bucket["time"], "previousWeekDemand": baseline, "demandChange": bucket["demand"]-baseline})
        capacity = math.fsum(float(r["capacity"]) for r in group if r["kind"] == "supply" and "capacity" in r)
        utilization = supply / capacity if capacity and all("capacity" in r for r in group if r["kind"] == "supply") else None
        result.append({"resourceUtilization": utilization, "commodity": commodity, "unit": unit, "dataMode": mode, "intervalSeconds": duration, "demand": demand, "supply": supply, "ratio": demand/supply if supply else None, "shortage": max(0,demand-supply), "surplus": max(0,supply-demand), "volatilityStdDev": math.sqrt(variance), "coefficientOfVariation": math.sqrt(variance)/mean if mean else None, "marketGapShare": max(0,demand-supply)/demand if demand else None, "timeSeries": trend, "sameTimePreviousWeek": comparisons, "coverageWarning": "Absent rows are unknown, not confirmed zero. Period totals require complete source coverage."})
    points = sorted({(r["longitude"], r["latitude"]) for r in rows if "longitude" in r})
    # Connected components under 1 km, deliberately not called DBSCAN.
    remaining = set(range(len(points))) if len(points) <= 2000 else set()
    clusters = []
    while remaining:
        queue = [remaining.pop()]; component = []
        while queue:
            index = queue.pop(); component.append(index)
            nearby = [j for j in remaining if haversine(points[index],points[j]) <= 1000]
            remaining.difference_update(nearby); queue.extend(nearby)
        clusters.append(len(component))
    return {"groups": result, "geographicClusters": {"method": "connected-components-within-1000m; observation locations, not population", "sizes": sorted(clusters,reverse=True), "status": "computed" if len(points) <= 2000 else "skipped: more than 2000 unique locations; use PostGIS"}, "limitations": ["synthetic values are not real city intelligence", "week-over-week comparison does not establish seasonality", "business density and accessibility require licensed business/area/population data"]}
