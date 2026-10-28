"""Pure forecasting logic, independent of HTTP and infrastructure."""

import numpy as np
from sklearn.linear_model import LinearRegression


def forecast(values: list[float], horizon: int) -> list[float]:
    """Fit a trend to equally spaced, finite, nonnegative observations.

    This baseline has no seasonality or uncertainty estimates. Validation is
    enforced again here so non-HTTP callers cannot bypass the domain boundary.
    """
    series = np.asarray(values, dtype=float)
    if not 3 <= len(series) <= 10000 or not 1 <= horizon <= 168:
        raise ValueError("Require 3..10000 samples and a horizon of 1..168")
    if not np.isfinite(series).all() or (series < 0).any() or (series > 1e12).any():
        raise ValueError("Observations must be finite values between 0 and 1e12")
    model = LinearRegression().fit(np.arange(len(series)).reshape(-1, 1), series)
    future = np.arange(len(series), len(series) + horizon).reshape(-1, 1)
    return np.maximum(model.predict(future), 0).round(4).tolist()
