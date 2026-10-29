import { backendAuthorization } from '../../../lib/server-auth';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const authorization = await backendAuthorization(request);
  if (!authorization) return Response.json({ detail: 'Authentication required' }, { status: 401 });
  if (!process.env.API_BASE_URL)
    return Response.json({ error: 'API not configured' }, { status: 503 });
  const query = new URLSearchParams({
    cityId: '10000000-0000-0000-0000-000000000001',
    commodity: 'rice',
    unit: 'kg',
    from: '2026-01-01T00:00:00Z',
    to: '2026-01-02T00:00:00Z',
  });
  try {
    const response = await fetch(
      `${process.env.API_BASE_URL}/api/v1/analytics/imbalance?${query}`,
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
        headers: { Authorization: authorization },
      },
    );
    if (!response.ok) return Response.json({ error: 'Evidence unavailable' }, { status: 503 });
    return Response.json({
      source: 'Local database fixture · Jan 1, 2026 · rice · kg',
      rows: await response.json(),
    });
  } catch {
    return Response.json({ error: 'Evidence unavailable' }, { status: 503 });
  }
}
