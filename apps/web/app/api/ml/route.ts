export async function POST(request: Request) {
  if (!process.env.API_BASE_URL || !process.env.LOCAL_API_TOKEN)
    return Response.json(
      { error: 'Start the API and AI services to run a forecast.' },
      { status: 503 },
    );
  try {
    const raw = await request.text();
    if (raw.length > 200000) return Response.json({ error: 'Request too large' }, { status: 413 });
    const response = await fetch(`${process.env.API_BASE_URL}/api/v1/forecast-jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LOCAL_API_TOKEN}`,
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: raw,
      signal: AbortSignal.timeout(15000),
    });
    return Response.json(await response.json(), { status: response.status });
  } catch {
    return Response.json(
      { error: 'Forecast unavailable. No results were fabricated.' },
      { status: 503 },
    );
  }
}
