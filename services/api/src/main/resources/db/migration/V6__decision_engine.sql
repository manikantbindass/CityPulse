CREATE TABLE decision_snapshot (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenant(id), actor_subject varchar(200) NOT NULL,
 payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX decision_snapshot_owner ON decision_snapshot(tenant_id,actor_subject,created_at DESC);
CREATE TABLE decision_network (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenant(id), actor_subject varchar(200) NOT NULL,
 source_id uuid NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(source_id,tenant_id) REFERENCES source_metadata(id,tenant_id)
);
CREATE TABLE decision_scenario (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenant(id), actor_subject varchar(200) NOT NULL,
 name varchar(120) NOT NULL, input jsonb NOT NULL, result jsonb NOT NULL,
 input_sha256 char(64) NOT NULL, result_sha256 char(64) NOT NULL, engine_version varchar(80) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX decision_scenario_owner ON decision_scenario(tenant_id,actor_subject,created_at DESC,id);
