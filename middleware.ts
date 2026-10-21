import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const organizationId = request.cookies.get('sinan-org-id')?.value;
  if (organizationId && /^[0-9a-f-]{36}$/i.test(organizationId)) requestHeaders.set('x-organization-id', organizationId);

  const pathname = request.nextUrl.pathname;
  const workspaceToken = request.headers.get('x-sinan-test-workspace')?.trim() || '';
  const hasTestWorkspaceToken = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceToken);
  const supportedTestWorkspaceRoute =
    (pathname.startsWith('/api/appointments') && pathname !== '/api/appointments/availability') ||
    pathname === '/api/clinic/settings' ||
    pathname === '/api/clinic/booking-settings' ||
    pathname === '/api/reports' ||
    pathname === '/api/review-queue' ||
    /^\/api\/patients\/[0-9a-f-]{36}(?:\/(?:odontogram|endodontics|history|encounters))?$/i.test(pathname);

  let response: Response;
  if (hasTestWorkspaceToken && supportedTestWorkspaceRoute && pathname !== '/api/patients') {
    const target = request.nextUrl.clone();
    target.pathname = pathname.replace(/^\/api(?=\/)/, '/api/test-workspace');
    response = NextResponse.rewrite(target, { request: { headers: requestHeaders } });
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  return response;
}

export const config = { matcher: ['/api/:path*'] };
