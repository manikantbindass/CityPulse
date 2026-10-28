INSERT INTO tenant(id,name) VALUES('00000000-0000-0000-0000-000000000001','Local development tenant');
-- Local profile only. Fictional boundaries, businesses, and observations.
INSERT INTO city(id,name,country_code,timezone,boundary) VALUES
('10000000-0000-0000-0000-000000000001','Demo City','IN','Asia/Kolkata',ST_Multi(ST_GeomFromText('POLYGON((77.0 12.0,77.2 12.0,77.2 12.2,77.0 12.2,77.0 12.0))',4326)));
INSERT INTO zone(id,city_id,name,boundary) VALUES
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Market Quarter',ST_Multi(ST_GeomFromText('POLYGON((77.01 12.01,77.09 12.01,77.09 12.09,77.01 12.09,77.01 12.01))',4326)));
INSERT INTO business(tenant_id,id,city_id,zone_id,name,category,location) VALUES
('00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Sample Market','groceries',ST_SetSRID(ST_MakePoint(77.05,12.05),4326));
INSERT INTO source_metadata(tenant_id,id,provider,dataset_name,source_uri,license_reference,classification,schema_version) VALUES
('00000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','CityPulse synthetic fixtures','local-demo-v1','urn:citypulse:synthetic:local-demo-v1','synthetic test data; repository license pending','public',1);
INSERT INTO observation(tenant_id,id,city_id,zone_id,business_id,source_id,external_id,kind,commodity,quantity,unit,observed_at,period_end,provenance,payload_sha256,quality_score)
SELECT '00000000-0000-0000-0000-000000000001', ('50000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
'10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',
'demand-' || n,'demand','rice',10*n,'kg','2026-01-01T00:00:00Z'::timestamptz + (n-1)*interval '1 hour','2026-01-01T00:00:00Z'::timestamptz + n*interval '1 hour',
'{"synthetic":true,"generator":"local-demo-v1"}'::jsonb,encode(sha256(('synthetic-demand-' || n)::bytea),'hex'),1 FROM generate_series(1,3) n;
INSERT INTO inventory(tenant_id,id,business_id,source_id,external_id,commodity,quantity,unit,recorded_at,provenance) VALUES
('00000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','inventory-1','rice',120,'kg','2026-01-01T00:00:00Z','{"synthetic":true}');

INSERT INTO tenant_city(tenant_id,city_id) VALUES('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
INSERT INTO user_account(id,tenant_id,subject,display_name,role) VALUES('70000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','local-developer','Local developer','ADMIN');

UPDATE source_metadata SET data_mode='synthetic',quality_status='validated-fixture',update_frequency='manual fixture',timezone='Asia/Kolkata',currency='INR' WHERE tenant_id='00000000-0000-0000-0000-000000000001';
