package io.citypulse.operations;

import static org.junit.jupiter.api.Assertions.*;

import io.opentelemetry.api.trace.*;
import java.net.URI;
import java.net.http.HttpRequest;
import org.junit.jupiter.api.Test;

class TraceHeadersTest {

    @Test
    void propagatesOnlyTraceContextWhilePreservingRequest() {
        var context = SpanContext.create(
            "11111111111111111111111111111111",
            "2222222222222222",
            TraceFlags.getSampled(),
            TraceState.getDefault()
        );
        try (var scope = Span.wrap(context).makeCurrent()) {
            var original = HttpRequest.newBuilder(URI.create("https://ai.example.org/v1/forecasts"))
                .header("Authorization", "Bearer unit-test")
                .POST(HttpRequest.BodyPublishers.ofString("{}"))
                .build();
            var result = TraceHeaders.propagated(original);
            assertEquals(
                "00-11111111111111111111111111111111-2222222222222222-01",
                result.headers().firstValue("traceparent").orElseThrow()
            );
            assertEquals(
                "Bearer unit-test",
                result.headers().firstValue("Authorization").orElseThrow()
            );
            assertTrue(result.headers().firstValue("baggage").isEmpty());
            assertEquals("POST", result.method());
            assertEquals(2, result.bodyPublisher().orElseThrow().contentLength());
        }
    }

    @Test
    void removesStaleTraceContextWithoutAnActiveSpan() {
        var request = HttpRequest.newBuilder(URI.create("https://ai.example.org/"))
            .header("traceparent", "untrusted-stale-value")
            .build();
        assertTrue(TraceHeaders.propagated(request).headers().firstValue("traceparent").isEmpty());
    }
}
