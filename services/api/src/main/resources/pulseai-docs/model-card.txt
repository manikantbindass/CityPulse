# Daily segment forecasting model card

## Purpose and data

Local decision-support experiments for daily demand by city, district and category. The reproducible benchmark uses eight synthetic segments across Bengaluru/Amsterdam, central/north and groceries/mobility. These city labels do not establish real city observations. No measured synthetic error implies real-world accuracy.

## Training and evaluation

`scripts/train_models.py` fixes random seed 42 and generates 182 daily observations per segment. Models train separately per geographic/category segment. A chronological 60/20/20 split prevents future targets entering training. Lag 1/7/14 and the previous-seven mean use only past observations; weekday sine/cosine are known calendar features. No pooling across geographies is used.

Candidates: seasonal-naive, seven-point moving average, Ridge regression and XGBoost. Validation MAE selects the model independently per segment. The deployed artifact remains trained on the training split only. Held-out test results and all candidate comparisons are computed in [evaluation JSON](reports/model-evaluation.json). Metrics include MAE, RMSE, sMAPE and mean under/overforecast. These are rolling one-step evaluations, where prior observed test values are available at each subsequent origin; they are not claims about long-horizon recursive accuracy.

PyTorch and a second tree implementation are omitted because the benchmark provides no evidence that additional complexity would improve decisions.

## Intervals and explanations

Intervals use the selected model's 90th percentile absolute validation residual. Validation also selects the model, so this is an empirical diagnostic, not an independent conformal guarantee. The test report measures one-step interval coverage. Recursive horizons widen that radius by square root of horizon, a heuristic with no guaranteed multi-horizon coverage. Without a trained calibration artifact, intervals are null and clearly disclosed.

XGBoost split importance and Ridge raw coefficients are associations, not causal explanations or comparable normalized weights. Baselines explain the repeated weekday or previous-seven average. Anomalies use past-only median/MAD. Drift compares recent seven-day mean with training mean/standard deviation; trends and seasonality can trigger it, so it is diagnostic rather than a validated alarm.

## Service behavior

`POST /v1/forecasts`, `GET /v1/forecasts/{id}`, `POST /v1/forecasts/batch`, `GET /v1/models`, `GET /v1/models/{id}/metrics`, and `/health` run in FastAPI. Forecast jobs persist in SQLite scoped by a trusted service `X-Tenant-ID` header. Service bearer authentication is mandatory. Spring derives that tenant from authenticated identity, applies permissions and idempotency, orchestrates inference and persists the result. The browser never chooses a trusted tenant header.

Daily requests require at least 14 ordered offset-aware observations, bounded values, a known scope and horizon 1..90. Batch is bounded to 20 series and 10k total observations. A body limit precedes validation. Missing or unreadable models fall back to seasonal-naive without fabricated intervals. Synthetic models are not used automatically for nonsynthetic requests. Supply forecasts repeat last week's known supply; gap flags and additional-unit recommendations are simple scenarios requiring human review. Nothing dispatches resources.

## Registry, reproducibility and rollback

Training fingerprints sorted dataset records and names model versions from the digest. Artifacts are inspectable Ridge JSON or XGBoost JSON with no untrusted pickle loading. Only trusted local registry files are loaded. `MODEL_REGISTRY_DIR` selects the registry; `AI_STORAGE_DIR` controls persistent jobs. Cached models keep inference separate from training.

Run `python scripts/model_registry.py list`, then `python scripts/model_registry.py activate --version <existing-version>` to promote or roll back. The previous pointer is preserved. The weekly synthetic evaluation workflow trains and uploads artifacts; it does not auto-promote a production model. Real-data training requires provider licensing, dataset review, segment-specific backtesting, coverage review and explicit promotion policy.

## Limits

Daily cadence only; no irregular-series resampling, holiday data, prices, exogenous weather, geospatial transfer, LLM recommendations or population access model. SQLite is a local persistence choice; shared production deployment needs durable central storage and service identity. Forecast retention, tracing and production SLOs remain operational follow-up. Prediction latency is measured per response; benchmark it under representative load before setting a guarantee.
