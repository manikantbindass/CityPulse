import { NextRequest, NextResponse } from 'next/server';
import {
  finishLogin,
  logout,
  sameOrigin,
  sessionToken,
  startLogin,
  webOrigin,
} from '../../../../lib/server-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  try {
    if (action === 'login') {
      if (!sameOrigin(request))
        return Response.json({ detail: 'Same-origin navigation required' }, { status: 403 });
      return NextResponse.redirect(await startLogin());
    }
    if (action === 'callback') {
      await finishLogin(request);
      return NextResponse.redirect(`${webOrigin()}/dashboard`);
    }
    if (action === 'session')
      return Response.json(
        { authenticated: !!(await sessionToken()), configured: !!process.env.OIDC_ISSUER_URI },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    return Response.json({ detail: 'Unknown auth action' }, { status: 404 });
  } catch {
    return Response.json(
      {
        detail:
          'Authentication unavailable or rejected. Check provider, membership, assurance and session-store configuration.',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  if (
    !sameOrigin(request) ||
    request.headers.get('origin') !== (process.env.WEB_ORIGIN ?? request.nextUrl.origin)
  )
    return Response.json({ detail: 'Same-origin mutation required' }, { status: 403 });
  if ((await params).action !== 'logout')
    return Response.json({ detail: 'Unknown action' }, { status: 404 });
  try {
    await logout();
    return new Response(null, { status: 204 });
  } catch {
    return Response.json(
      { detail: 'Session store unavailable; logout could not be confirmed' },
      { status: 503 },
    );
  }
}
