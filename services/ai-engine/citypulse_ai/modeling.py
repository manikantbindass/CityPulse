"""Leakage-aware daily forecasting with inspectable baseline and model artifacts."""

from __future__ import annotations

import hashlib
import json
import math
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
from sklearn.linear_model import Ridge

FEATURES = ["lag_1", "lag_7", "lag_14", "mean_previous_7", "weekday_sin", "weekday_cos"]


def fingerprint(value: object) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    ).hexdigest()


def features(history: list[float], target: datetime) -> list[float]:
    return [
        history[-1],
        history[-7],
        history[-14],
        sum(history[-7:]) / 7,
        math.sin(2 * math.pi * target.weekday() / 7),
        math.cos(2 * math.pi * target.weekday() / 7),
    ]


def fit_candidate(name: str, values: list[float], dates: list[datetime]):
    if name in {"seasonal-naive", "moving-average"}:
        return None
    x = [features(values[:i], dates[i]) for i in range(14, len(values))]
    y = values[14:]
    if name == "ridge":
        return Ridge(alpha=10).fit(x, y)
    if name == "xgboost":
        from xgboost import XGBRegressor

        return XGBRegressor(
            n_estimators=80,
            max_depth=3,
            learning_rate=0.05,
            objective="reg:squarederror",
            random_state=42,
            n_jobs=1,
            subsample=1,
            colsample_bytree=1,
        ).fit(x, y)
    raise ValueError("Unsupported candidate")


def predict_one(name: str, model, history: list[float], date: datetime) -> float:
    if name == "seasonal-naive":
        return max(0, history[-7] if len(history) >= 7 else history[-1])
    if name == "moving-average":
        return max(0, sum(history[-7:]) / len(history[-7:]))
    return max(0, float(model.predict([features(history, date)])[0]))


def errors(actual: list[float], predictions: list[float]) -> dict:
    y, p = np.asarray(actual, dtype=float), np.asarray(predictions, dtype=float)
    denominator = np.abs(y) + np.abs(p)
    smape = np.divide(
        200 * np.abs(y - p), denominator, out=np.zeros_like(y), where=denominator != 0
    )
    return {
        "mae": float(np.mean(np.abs(y - p))),
        "rmse": float(np.sqrt(np.mean((y - p) ** 2))),
        "smape_percent": float(np.mean(smape)),
        "mean_underforecast": float(np.mean(np.maximum(y - p, 0))),
        "mean_overforecast": float(np.mean(np.maximum(p - y, 0))),
        "samples": len(actual),
    }


def rolling_evaluate(name, model, values, dates, start, end):
    # At each origin, only observations before that target are available.
    predictions = [predict_one(name, model, values[:i], dates[i]) for i in range(start, end)]
    return predictions, errors(values[start:end], predictions)


def train_dataset(rows: list[dict], output: Path) -> dict:
    grouped: dict[str, list[dict]] = {}
    for row in rows:
        key = "/".join(row[field] for field in ["city", "district", "category"])
        grouped.setdefault(key, []).append(row)
    data_hash = fingerprint(
        sorted(rows, key=lambda row: (row["city"], row["district"], row["category"], row["time"]))
    )
    version = "daily-v1-" + data_hash[:12]
    folder = output / version
    folder.mkdir(parents=True, exist_ok=True)
    report = {
        "id": version,
        "datasetFingerprint": data_hash,
        "dataMode": "synthetic"
        if all(row.get("dataMode") == "synthetic" for row in rows)
        else "historical-unverified",
        "features": FEATURES,
        "protocol": "per-geographic-segment chronological 60/20/20; rolling one-step evaluation; select on validation MAE; deployed artifact uses training split only; untouched test report",
        "segments": {},
        "intervalMethod": "90th percentile absolute validation residual; sqrt(h) widening is heuristic and has no multi-horizon coverage guarantee",
    }
    for key, records in sorted(grouped.items()):
        records = sorted(records, key=lambda row: row["time"])
        dates = [datetime.fromisoformat(row["time"].replace("Z", "+00:00")) for row in records]
        values = [float(row["demand"]) for row in records]
        if len(values) < 84 or not all(math.isfinite(v) and 0 <= v <= 1e12 for v in values):
            raise ValueError("Each segment requires at least 84 finite daily observations")
        if len(set(dates)) != len(dates) or any(
            b - a != timedelta(days=1) for a, b in zip(dates, dates[1:])
        ):
            raise ValueError("Training series must have unique, regular daily timestamps")
        train_end, validation_end = int(len(values) * 0.6), int(len(values) * 0.8)
        candidates = {}
        fitted = {}
        for name in ["seasonal-naive", "moving-average", "ridge", "xgboost"]:
            try:
                model = fit_candidate(name, values[:train_end], dates[:train_end])
                validation_predictions, validation_metrics = rolling_evaluate(
                    name, model, values, dates, train_end, validation_end
                )
                test_predictions, test_metrics = rolling_evaluate(
                    name, model, values, dates, validation_end, len(values)
                )
                residuals = [
                    abs(y - p)
                    for y, p in zip(values[train_end:validation_end], validation_predictions)
                ]
                radius = float(np.quantile(residuals, 0.9, method="higher"))
                coverage = float(
                    np.mean(
                        [
                            abs(y - p) <= radius
                            for y, p in zip(values[validation_end:], test_predictions)
                        ]
                    )
                )
                candidates[name] = {
                    "validation": validation_metrics,
                    "test": test_metrics,
                    "oneStepTestIntervalCoverage": coverage,
                    "validationResidualRadius": radius,
                }
                fitted[name] = model
            except ImportError:
                candidates[name] = {"status": "not-installed; not evaluated"}
        selected = min(
            (name for name in candidates if "validation" in candidates[name]),
            key=lambda name: candidates[name]["validation"]["mae"],
        )
        # Test targets never enter training. Model selection is validation-only.
        final_model = fitted[selected]
        segment_id = fingerprint(key)[:16]
        artifact = None
        importance = {}
        if selected == "xgboost":
            artifact = segment_id + ".xgboost.json"
            final_model.save_model(folder / artifact)
            importance = dict(zip(FEATURES, map(float, final_model.feature_importances_)))
        elif selected == "ridge":
            artifact = segment_id + ".ridge.json"
            (folder / artifact).write_text(
                json.dumps(
                    {
                        "coefficients": final_model.coef_.tolist(),
                        "intercept": float(final_model.intercept_),
                    }
                )
            )
            importance = dict(zip(FEATURES, map(float, final_model.coef_)))
        report["segments"][key] = {
            "selectedModel": selected,
            "artifact": artifact,
            "candidates": candidates,
            "trainingCount": train_end,
            "validationCount": validation_end - train_end,
            "testCount": len(values) - validation_end,
            "trainedThrough": dates[train_end - 1].isoformat(),
            "testStartsAt": dates[validation_end].isoformat(),
            "intervalRadius": candidates[selected]["validationResidualRadius"],
            "featureImportance": importance,
            "featureImportanceMeaning": "XGBoost split gain or Ridge raw coefficients; association, not causality or comparable normalized importance",
            "trainingMean": float(np.mean(values[:train_end])),
            "trainingStdDev": float(np.std(values[:train_end])),
        }
    (folder / "registry.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    pointer = output / "active.tmp"
    pointer.write_text(json.dumps({"id": version}))
    pointer.replace(output / "active.json")
    return report


class RidgeArtifact:
    def __init__(self, value):
        self.value = value

    def predict(self, x):
        return [
            sum(a * b for a, b in zip(row, self.value["coefficients"])) + self.value["intercept"]
            for row in x
        ]


def load_artifact(folder: Path, segment: dict):
    if segment["selectedModel"] == "ridge":
        return RidgeArtifact(json.loads((folder / segment["artifact"]).read_text()))
    if segment["selectedModel"] == "xgboost":
        from xgboost import XGBRegressor

        model = XGBRegressor(n_jobs=1)
        model.load_model(folder / segment["artifact"])
        return model
    return None
