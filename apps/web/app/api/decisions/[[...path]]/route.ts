import { backendAuthorization, localPreviewEnabled, sameOrigin } from '../../../../lib/server-auth';
import { NextRequest } from 'next/server';

let localInFlight = false;

async function boundedBody(request: Request) {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 512000) {
      await reader.cancel();
      throw new Error('BODY_LIMIT');
    }
    chunks.push(value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(result);
}

async function proxy(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params;
  const route = path.join('/');
  if (route === 'config' && request.method === 'GET')
    return Response.json({
      localComputeAllowed: process.env.DECISION_LOCAL_PREVIEW === 'true' && localPreviewEnabled(),
    });
  if (
    !/^(?:local|snapshots|networks|scenarios(?:\/[0-9a-f-]{36}(?:\/(?:export|reproduce))?)?)$/.test(
      route,
    )
  )
    return Response.json({ detail: 'Unknown decision route' }, { status: 404 });
  if (!sameOrigin(request))
    return Response.json({ detail: 'Same-origin request required' }, { status: 403 });
  try {
    const body = request.method === 'POST' ? await boundedBody(request) : undefined;
    if (route === 'local') {
      if (
        request.method !== 'POST' ||
        process.env.DECISION_LOCAL_PREVIEW !== 'true' ||
        !localPreviewEnabled() ||
        !process.env.LOCAL_API_TOKEN ||
        !process.env.AI_BASE_URL
      )
        return Response.json(
          { detail: 'Explicit local decision preview is disabled' },
          { status: 403 },
        );
      if (localInFlight)
        return Response.json({ detail: 'A local scenario is already computing' }, { status: 429 });
      const payload = JSON.parse(body || '{}').scenario;
      if (
        !payload ||
        !['synthetic', 'manual-assumptions'].includes(payload.origin) ||
        payload.snapshotId ||
        payload.networkId
      )
        return Response.json(
          {
            detail:
              'Local mode accepts only synthetic or manual assumptions. Tenant records require the Java API.',
          },
          { status: 400 },
        );
      payload.dataMode = payload.origin === 'synthetic' ? 'synthetic' : 'assumed';
      for (const group of ['districts', 'stocks'])
        for (const row of payload[group] ?? [])
          row.evidence = [`${payload.origin}:operator-supplied`];
      localInFlight = true;
      try {
        const response = await fetch(`${process.env.AI_BASE_URL}/v1/decisions/evaluate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.LOCAL_API_TOKEN}`,
            'X-Tenant-ID': '00000000-0000-0000-0000-000000000001',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(22000),
          cache: 'no-store',
        });
        const value = await response.json();
        return response.ok
          ? Response.json({ id: crypto.randomUUID(), persisted: false, result: value })
          : Response.json(value, { status: response.status });
      } finally {
        localInFlight = false;
      }
    }
    const auth = await backendAuthorization(request);
    if (!auth)
      return Response.json(
        { detail: 'A valid user access token or explicit local identity is required' },
        { status: 401 },
      );
    if (!process.env.API_BASE_URL)
      return Response.json({ detail: 'Start and configure the Java API' }, { status: 503 });
    const response = await fetch(
      `${process.env.API_BASE_URL}/api/v1/decisions/${route}${request.nextUrl.search}`,
      {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth,
          'Idempotency-Key': request.headers.get('idempotency-key') ?? crypto.randomUUID(),
        },
        body,
        cache: 'no-store',
        signal: AbortSignal.timeout(25000),
      },
    );
    return Response.json(await response.json(), {
      status: response.status,
      headers: route.endsWith('/export')
        ? { 'Content-Disposition': 'attachment; filename=citypulse-scenario.json' }
        : undefined,
    });
  } catch (error) {
    return Response.json(
      {
        detail:
          (error as Error).message === 'BODY_LIMIT'
            ? 'Scenario exceeds 512000 bytes'
            : 'Decision service unavailable or invalid JSON. No plan was fabricated.',
      },
      { status: (error as Error).message === 'BODY_LIMIT' ? 413 : 503 },
    );
  }
}
export const GET = proxy;
export const POST = proxy;
