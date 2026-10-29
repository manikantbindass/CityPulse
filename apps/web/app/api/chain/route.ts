import { backendAuthorization } from '../../../lib/server-auth';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const authorization = await backendAuthorization(request);
  if (!authorization) return Response.json({ detail: 'Authentication required' }, { status: 401 });
  if (!process.env.API_BASE_URL)
    return Response.json({ error: 'Backend not configured' }, { status: 503 });
  try {
    const response = await fetch(
      `${process.env.API_BASE_URL}/api/v1/verifications?page=0&size=20`,
      {
        cache: 'no-store',
        headers: { Authorization: authorization },
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
