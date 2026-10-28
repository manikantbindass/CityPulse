CREATE TABLE tenant (
 id uuid PRIMARY KEY, name varchar(120) NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE organization (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenant(id), name varchar(120) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,tenant_id)
);
CREATE TABLE user_account (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenant(id), subject varchar(200) NOT NULL,
 display_name varchar(120) NOT NULL, role varchar(30) NOT NULL CHECK(role IN ('ADMIN','ANALYST','PLANNER','BUSINESS_OWNER','PROVIDER','CITIZEN')),
 enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,subject)
);
CREATE TABLE tenant_city (tenant_id uuid NOT NULL REFERENCES tenant(id), city_id uuid NOT NULL REFERENCES city(id), PRIMARY KEY(tenant_id,city_id));
-- Existing development fixtures are inserted after versioned migrations.
ALTER TABLE business ADD COLUMN tenant_id uuid NOT NULL REFERENCES tenant(id);
ALTER TABLE business ADD CONSTRAINT business_tenant_id_unique UNIQUE(id,tenant_id);
ALTER TABLE source_metadata ADD COLUMN tenant_id uuid NOT NULL REFERENCES tenant(id);
ALTER TABLE source_metadata ADD CONSTRAINT source_tenant_id_unique UNIQUE(id,tenant_id);
ALTER TABLE observation ADD COLUMN tenant_id uuid NOT NULL REFERENCES tenant(id);
ALTER TABLE observation ADD CONSTRAINT observation_source_tenant_fk FOREIGN KEY(source_id,tenant_id) REFERENCES source_metadata(id,tenant_id);
ALTER TABLE observation ADD CONSTRAINT observation_business_tenant_fk FOREIGN KEY(business_id,tenant_id) REFERENCES business(id,tenant_id);
ALTER TABLE inventory ADD COLUMN tenant_id uuid NOT NULL REFERENCES tenant(id);
ALTER TABLE inventory ADD CONSTRAINT inventory_source_tenant_fk FOREIGN KEY(source_id,tenant_id) REFERENCES source_metadata(id,tenant_id);
ALTER TABLE inventory ADD CONSTRAINT inventory_business_tenant_fk FOREIGN KEY(business_id,tenant_id) REFERENCES business(id,tenant_id);
CREATE INDEX observation_tenant_time ON observation(tenant_id,observed_at DESC,id);
CREATE INDEX business_tenant_name ON business(tenant_id,name,id);
CREATE INDEX inventory_tenant_time ON inventory(tenant_id,recorded_at DESC,id);
CREATE TABLE geographic_area (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenant(id), city_id uuid NOT NULL REFERENCES city(id),
 parent_id uuid, kind varchar(20) NOT NULL CHECK(kind IN ('REGION','DISTRICT','NEIGHBORHOOD')),
 name varchar(120) NOT NULL, boundary geometry(MultiPolygon,4326) NOT NULL,
 UNIQUE(id,tenant_id), FOREIGN KEY(parent_id,tenant_id) REFERENCES geographic_area(id,tenant_id),
 CHECK(ST_IsValid(boundary) AND NOT ST_IsEmpty(boundary))
);
CREATE INDEX geographic_area_spatial ON geographic_area USING gist(boundary);
CREATE INDEX geographic_area_tenant ON geographic_area(tenant_id,city_id,kind);
CREATE TABLE notification (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenant(id), recipient_subject varchar(200) NOT NULL,
 title varchar(160) NOT NULL, message varchar(1000) NOT NULL, read_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notification_recipient ON notification(tenant_id,recipient_subject,created_at DESC);
CREATE TABLE operation_receipt (
 tenant_id uuid NOT NULL REFERENCES tenant(id), subject varchar(200) NOT NULL, operation varchar(80) NOT NULL,
 idempotency_key varchar(100) NOT NULL, request_digest char(64) NOT NULL, result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,subject,operation,idempotency_key)
);
CREATE TABLE forecast_result (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenant(id),request jsonb NOT NULL,result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE verification_request (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenant(id),digest char(64) NOT NULL,
 status varchar(30) NOT NULL CHECK(status='DIGEST_RECORDED'),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE admin_configuration (
 tenant_id uuid PRIMARY KEY REFERENCES tenant(id), configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE audit_event ADD COLUMN tenant_id uuid NOT NULL REFERENCES tenant(id);
CREATE INDEX audit_tenant_time ON audit_event(tenant_id,occurred_at DESC,id);
