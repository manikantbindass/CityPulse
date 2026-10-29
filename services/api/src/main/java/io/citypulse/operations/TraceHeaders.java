package io.citypulse.operations;

import io.opentelemetry.api.trace.propagation.W3CTraceContextPropagator;
import io.opentelemetry.context.Context;
import java.net.http.HttpRequest;

public final class TraceHeaders {

    private TraceHeaders() {}

    public static HttpRequest propagated(HttpRequest request) {
        var builder = HttpRequest.newBuilder(
            request,
            (name, value) ->
                !name.equalsIgnoreCase("traceparent") && !name.equalsIgnoreCase("tracestate")
        );
        W3CTraceContextPropagator.getInstance().inject(
            Context.current(),
            builder,
            (carrier, name, value) -> carrier.setHeader(name, value)
        );
        return builder.build();
    }
}
