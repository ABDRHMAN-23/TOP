import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const organizationId = request.cookies.get('sinan-org-id')?.value;
  if (organizationId && /^[0-9a-f-]{36}$/i.test(organizationId)) requestHeaders.set('x-organization-id', organizationId);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  return response;
}

export const config = { matcher: ['/api/:path*'] };
