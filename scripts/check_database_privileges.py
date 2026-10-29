"""Assert runtime DB permissions using the local Compose owner; prints no credentials."""
import json
import subprocess

query = """SELECT json_build_object(
 'superuser',(SELECT rolsuper FROM pg_roles WHERE rolname='citypulse_app'),
 'create_role',(SELECT rolcreaterole FROM pg_roles WHERE rolname='citypulse_app'),
 'schema_create',has_schema_privilege('citypulse_app','public','CREATE'),
 'audit_update',has_table_privilege('citypulse_app','audit_event','UPDATE'),
 'audit_delete',has_table_privilege('citypulse_app','audit_event','DELETE'),
 'migration_read',has_table_privilege('citypulse_app','flyway_schema_history','SELECT'),
 'observation_insert',has_table_privilege('citypulse_app','observation','INSERT'),
 'audit_insert',has_table_privilege('citypulse_app','audit_event','INSERT'))"""
command = ["docker", "compose", "exec", "-T", "db", "sh", "-c",
           'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -v ON_ERROR_STOP=1']
value = json.loads(subprocess.check_output(command, input=query, text=True))
assert all(value[key] is False for key in ["superuser", "create_role", "schema_create", "audit_update", "audit_delete", "migration_read"]), value
assert value["observation_insert"] and value["audit_insert"], value
print("PASS runtime DB: no superuser/role/schema/migration/audit mutation access; required inserts allowed")
