import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Liveness endpoint only; never expose tenant, provider, or secret configuration. */
export async function GET() {
  return NextResponse.json(
    { ok: true, service: 'sinan-clinical-workspace', timestamp: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
