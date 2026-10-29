import { NextRequest } from 'next/server';

async function proxy(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params;
  if (!/^sessions(?:\/[0-9a-f-]{36}(?:\/messages)?)?$/.test(path.join('/')))
    return Response.json({ detail: 'Unknown analyst route' }, { status: 404 });
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin)
    return Response.json({ detail: 'Same-origin requests required' }, { status: 403 });
  const authorization =
    request.headers.get('authorization') ??
    (process.env.PULSEAI_LOCAL_PREVIEW === 'true' && process.env.LOCAL_API_TOKEN
      ? `Bearer ${process.env.LOCAL_API_TOKEN}`
      : null);
  if (!authorization)
    return Response.json(
      {
        detail: 'Sign in with a valid API access token. Local preview must be explicitly enabled.',
      },
      { status: 401 },
    );
  if (!process.env.API_BASE_URL)
    return Response.json({ detail: 'Configure and start the backend.' }, { status: 503 });
  const body = ['POST', 'PUT'].includes(request.method) ? await request.text() : undefined;
  if (body && body.length > 8000)
    return Response.json({ detail: 'Request too large' }, { status: 413 });
  try {
    const response = await fetch(`${process.env.API_BASE_URL}/api/v1/pulseai/${path.join('/')}`, {
      method: request.method,
      body: body || undefined,
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return Response.json(await response.json(), { status: response.status });
    if (response.status === 204 || request.method === 'DELETE')
      return new Response(null, { status: 204 });
    return Response.json(await response.json());
  } catch {
    return Response.json(
      { detail: 'Analyst unavailable. Your question was not replaced by sample insights.' },
      { status: 503 },
    );
  }
}
export const GET = proxy;
export const POST = proxy;
export const DELETE = proxy;
