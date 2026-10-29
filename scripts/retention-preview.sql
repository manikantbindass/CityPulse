-- Read-only policy preview. No deletion is implemented.
SELECT 'observation' AS entity, count(*) FROM observation WHERE observed_at < now() - interval '24 months'
UNION ALL SELECT 'inventory', count(*) FROM inventory WHERE recorded_at < now() - interval '24 months'
UNION ALL SELECT 'audit_event', count(*) FROM audit_event WHERE occurred_at < now() - interval '12 months';
