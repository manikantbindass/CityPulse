export const dynamic = 'force-dynamic';
export async function GET() {
  const base = process.env.API_BASE_URL;
  const token = process.env.LOCAL_API_TOKEN;
  if (!base || !token) return Response.json({ error: 'API not configured' }, { status: 503 });
  try {
    const response = await fetch(`${base}/api/v1/cities?page=0&size=20`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return Response.json({ error: 'Registry unavailable' }, { status: 503 });
    return Response.json(await response.json());
  } catch {
    return Response.json({ error: 'Registry unavailable' }, { status: 503 });
  }
}
