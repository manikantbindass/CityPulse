"""Low-cardinality metrics, redacted request logs and optional W3C trace export."""
import json
import logging
import os
import sys
import time
from contextlib import nullcontext

from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from opentelemetry import trace
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
from starlette.responses import Response

REQUESTS = Counter("citypulse_http_requests", "Completed AI requests", ["route", "method", "status"])
DURATION = Histogram("citypulse_http_request_duration_seconds", "AI request duration", ["route"], buckets=(.01, .05, .1, .25, .5, 1, 2, 5, 10, 30))
LOG = logging.getLogger("citypulse.operations")
LOG.setLevel(logging.INFO)
if not LOG.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(message)s"))
    LOG.addHandler(handler)
LOG.propagate = False


def configure_tracing():
    if not os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT"):
        return None
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.sdk.trace.sampling import ParentBased, TraceIdRatioBased
    provider = TracerProvider(resource=Resource.create({"service.name": "citypulse-ai"}), sampler=ParentBased(TraceIdRatioBased(0.1)))
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(timeout=3)))
    trace.set_tracer_provider(provider)
    return provider.get_tracer("citypulse.http")


def install(app):
    tracer = configure_tracing()

    @app.middleware("http")
    async def observe(request, call_next):
        started = time.perf_counter()
        status = 500
        span_context = TraceContextTextMapPropagator().extract(dict(request.headers))
        context = tracer.start_as_current_span("citypulse.request", context=span_context) if tracer else nullcontext()
        with context:
            try:
                response = await call_next(request)
                status = response.status_code
                return response
            finally:
                route = getattr(request.scope.get("route"), "path", "unmatched")
                method = request.method if request.method in {"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"} else "OTHER"
                elapsed = time.perf_counter() - started
                if route not in {"/metrics", "/health", "/ready"}:
                    REQUESTS.labels(route, method, str(status)).inc()
                    DURATION.labels(route).observe(elapsed)
                    span = trace.get_current_span()
                    if span.is_recording():
                        span.set_attribute("http.route", route)
                        span.set_attribute("http.request.method", method)
                        span.set_attribute("http.response.status_code", status)
                    LOG.info(json.dumps({"event": "http_request", "service": "citypulse-ai", "route": route, "method": method, "status": status, "duration_ms": round(elapsed*1000, 2)}))

    @app.get("/metrics", include_in_schema=False)
    def metrics():
        # Private-network only. Never expose the AI service through public ingress.
        return Response(generate_latest(), headers={"Content-Type": CONTENT_TYPE_LATEST})

    @app.get("/ready", tags=["operations"])
    def ready():
        token = os.environ.get("AI_SERVICE_TOKEN") or os.environ.get("LOCAL_API_TOKEN", "")
        if len(token) < 32 or token.startswith("replace-"):
            return Response(status_code=503)
        return {"status": "ready"}
