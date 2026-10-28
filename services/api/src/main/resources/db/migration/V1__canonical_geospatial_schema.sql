CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE city (
    id uuid PRIMARY KEY,
    name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
    country_code char(2) NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
    timezone text NOT NULL,
    boundary geometry(MultiPolygon,4326) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (ST_IsValid(boundary) AND NOT ST_IsEmpty(boundary))
);
CREATE INDEX city_boundary_gist ON city USING gist(boundary);

CREATE TABLE zone (
    id uuid PRIMARY KEY,
    city_id uuid NOT NULL REFERENCES city(id),
    name text NOT NULL,
    boundary geometry(MultiPolygon,4326) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(id, city_id),
    CHECK (ST_IsValid(boundary) AND NOT ST_IsEmpty(boundary))
);
CREATE INDEX zone_boundary_gist ON zone USING gist(boundary);

CREATE TABLE business (
    id uuid PRIMARY KEY,
    city_id uuid NOT NULL REFERENCES city(id),
    zone_id uuid NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    location geometry(Point,4326) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(id, city_id),
    FOREIGN KEY (zone_id, city_id) REFERENCES zone(id, city_id),
    CHECK (NOT ST_IsEmpty(location) AND ST_X(location) BETWEEN -180 AND 180 AND ST_Y(location) BETWEEN -90 AND 90)
);
CREATE INDEX business_location_gist ON business USING gist(location);

CREATE TABLE source_metadata (
    id uuid PRIMARY KEY,
    provider text NOT NULL,
    dataset_name text NOT NULL,
    source_uri text NOT NULL,
    license_reference text NOT NULL,
    classification text NOT NULL CHECK (classification IN ('public','internal','restricted')),
    schema_version integer NOT NULL CHECK (schema_version > 0),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE observation (
    id uuid PRIMARY KEY,
    city_id uuid NOT NULL REFERENCES city(id),
    zone_id uuid NOT NULL,
    business_id uuid,
    source_id uuid NOT NULL REFERENCES source_metadata(id),
    external_id text NOT NULL,
    kind text NOT NULL CHECK (kind IN ('supply','demand')),
    commodity text NOT NULL,
    quantity numeric(18,4) NOT NULL CHECK (quantity >= 0),
    unit text NOT NULL CHECK (unit IN ('count','kg','litre','kwh','trip')),
    observed_at timestamptz NOT NULL,
    ingested_at timestamptz NOT NULL DEFAULT now(),
    period_end timestamptz NOT NULL,
    provenance jsonb NOT NULL CHECK (jsonb_typeof(provenance) = 'object'),
    payload_sha256 char(64) NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
    quality_score numeric(5,4) NOT NULL CHECK (quality_score BETWEEN 0 AND 1),
    FOREIGN KEY (zone_id, city_id) REFERENCES zone(id, city_id),
    FOREIGN KEY (business_id, city_id) REFERENCES business(id, city_id),
    UNIQUE(source_id, external_id),
    CHECK (period_end > observed_at)
);
CREATE INDEX observation_city_time ON observation(city_id, observed_at DESC);
CREATE INDEX observation_zone_commodity_time ON observation(zone_id, commodity, observed_at DESC);

CREATE TABLE inventory (
    id uuid PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES business(id),
    source_id uuid NOT NULL REFERENCES source_metadata(id),
    external_id text NOT NULL,
    commodity text NOT NULL,
    quantity numeric(18,4) NOT NULL CHECK (quantity >= 0),
    unit text NOT NULL CHECK (unit IN ('count','kg','litre','kwh','trip')),
    recorded_at timestamptz NOT NULL,
    ingested_at timestamptz NOT NULL DEFAULT now(),
    provenance jsonb NOT NULL CHECK (jsonb_typeof(provenance) = 'object'),
    UNIQUE(source_id, external_id)
);

CREATE TABLE audit_event (
    id uuid PRIMARY KEY,
    actor_subject text NOT NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id uuid NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    trace_id text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE FUNCTION validate_geographic_parent() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_TABLE_NAME = 'zone' THEN
        IF NOT EXISTS (SELECT 1 FROM city WHERE id = NEW.city_id AND ST_Covers(boundary, NEW.boundary)) THEN
            RAISE EXCEPTION 'Zone must be covered by its city';
        END IF;
    ELSE
        IF NOT EXISTS (SELECT 1 FROM zone WHERE id = NEW.zone_id AND city_id = NEW.city_id AND ST_Covers(boundary, NEW.location)) THEN
            RAISE EXCEPTION 'Business location must be covered by its zone';
        END IF;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER zone_parent_check BEFORE INSERT OR UPDATE ON zone FOR EACH ROW EXECUTE FUNCTION validate_geographic_parent();
CREATE TRIGGER business_parent_check BEFORE INSERT OR UPDATE ON business FOR EACH ROW EXECUTE FUNCTION validate_geographic_parent();
