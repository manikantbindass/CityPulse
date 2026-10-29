DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='citypulse_app') THEN
   REVOKE ALL ON TABLE flyway_schema_history FROM citypulse_app;
   REVOKE UPDATE,DELETE,TRUNCATE ON TABLE audit_event FROM citypulse_app;
 END IF;
END $$;
