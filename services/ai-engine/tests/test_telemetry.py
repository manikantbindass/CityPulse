from fastapi.testclient import TestClient
from citypulse_ai.main import app


def test_readiness_fails_without_service_identity(monkeypatch):
    monkeypatch.delenv("AI_SERVICE_TOKEN", raising=False)
    monkeypatch.delenv("LOCAL_API_TOKEN", raising=False)
    with TestClient(app) as client:
        assert client.get("/ready").status_code == 503
        assert client.get("/health").status_code == 200


def test_metrics_do_not_label_raw_urls_or_query_values(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_TOKEN", "a" * 40)
    with TestClient(app) as client:
        assert client.get("/ready").status_code == 200
        client.get("/private-untrusted-value?secret=do-not-export")
        metrics = client.get("/metrics")
        assert metrics.status_code == 200
        assert 'route="unmatched"' in metrics.text
        assert 'private-untrusted-value' not in metrics.text
        assert 'do-not-export' not in metrics.text
