export const dynamic = 'force-dynamic';
export async function GET() {
  if (!process.env.API_BASE_URL || !process.env.LOCAL_API_TOKEN)
    return Response.json({ error: 'Backend not configured' }, { status: 503 });
  try {
    const response = await fetch(
      `${process.env.API_BASE_URL}/api/v1/verifications?page=0&size=20`,
      {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${process.env.LOCAL_API_TOKEN}` },
        signal: AbortSignal.timeout(4000),
      },
    );
    if (!response.ok)
      return Response.json({ error: 'Verification records unavailable' }, { status: 503 });
    return Response.json(await response.json());
  } catch {
    return Response.json({ error: 'Backend unavailable' }, { status: 503 });
  }
}
