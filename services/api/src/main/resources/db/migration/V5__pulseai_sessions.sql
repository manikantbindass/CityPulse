CREATE TABLE pulseai_session (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenant(id), actor_subject varchar(200) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days'
);
CREATE INDEX pulseai_owner ON pulseai_session(tenant_id,actor_subject,created_at DESC);
CREATE TABLE pulseai_message (
 id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES pulseai_session(id) ON DELETE CASCADE,
 question varchar(2000) NOT NULL, answer jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
