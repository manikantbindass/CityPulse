package io.citypulse.pulseai;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Published response contract; evidence fields differ by allowlisted record type. */
public record PulseAiAnswer(
    UUID sessionId,
    List<Statement> statements,
    String provider,
    String notice,
    List<String> limitations,
    boolean empty,
    List<Document> documents,
    List<String> followUps,
    List<View> views
) {
    public record Statement(String id, String text, Map<String, Object> evidence) {}

    public record Document(String path, String sha256, String excerpt, String label) {}

    public record View(String label, String href) {}
}
