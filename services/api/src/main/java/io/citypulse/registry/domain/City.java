package io.citypulse.registry.domain;

import java.util.UUID;

public record City(
    UUID id,
    String name,
    String countryCode,
    String timezone
) implements java.io.Serializable {}
