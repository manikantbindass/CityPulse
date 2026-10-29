# Local observability

Run `python scripts/dev_stack.py up --observability` from the repository root after configuring the generated Grafana secret. This overlay includes the redacting OpenTelemetry Collector, Tempo, Prometheus, ingestion Pushgateway and a provisioned Grafana dashboard. No public telemetry or pager endpoint is configured. [Signals, privacy, alerts and proposed SLOs](../../docs/operations/observability.md) distinguish executable local configuration from cloud operational work. [Deployment](../../docs/operations/deployment.md) documents startup, validation and rollback.
