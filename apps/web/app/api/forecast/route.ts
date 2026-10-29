import { backendAuthorization } from '../../../lib/server-auth';
export async function POST(request: Request) {
  const base = process.env.API_BASE_URL;
  const authorization = await backendAuthorization(request);
  if (!authorization) return Response.json({ detail: 'Authentication required' }, { status: 401 });
  if (!base) return Response.json({ error: 'AI not configured' }, { status: 503 });
  try {
    const raw = await request.text();
    if (raw.length > 200000) return Response.json({ error: 'Request too large' }, { status: 413 });
    const response = await fetch(`${base}/api/v1/forecasts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        values: JSON.parse(raw).values,
        horizon: JSON.parse(raw).horizon,
        intervalMinutes: JSON.parse(raw).interval_minutes,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const result = await response.json();
    return Response.json(response.ok ? result.result : result, { status: response.status });
  } catch {
    return Response.json({ error: 'Forecast unavailable' }, { status: 503 });
  }
}
