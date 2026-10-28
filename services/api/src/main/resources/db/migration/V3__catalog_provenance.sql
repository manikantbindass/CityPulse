ALTER TABLE source_metadata ADD COLUMN update_frequency text NOT NULL DEFAULT 'unspecified';
ALTER TABLE source_metadata ADD COLUMN quality_status text NOT NULL DEFAULT 'unvalidated';
ALTER TABLE source_metadata ADD COLUMN data_mode text NOT NULL DEFAULT 'historical' CHECK(data_mode IN ('synthetic','historical','live'));
ALTER TABLE source_metadata ADD COLUMN source_schema jsonb NOT NULL DEFAULT '{"version":1}'::jsonb;
ALTER TABLE source_metadata ADD COLUMN timezone text NOT NULL DEFAULT 'UTC';
ALTER TABLE source_metadata ADD COLUMN currency char(3) NOT NULL DEFAULT 'XXX' CHECK(currency ~ '^[A-Z]{3}$');
CREATE INDEX source_tenant_mode ON source_metadata(tenant_id,data_mode);
