import { NextResponse } from 'next/server';
import { getGeminiApiKey, getRuntimeEnv } from '@/lib/cloudflare/runtime-env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store, max-age=0' };

/**
 * Safe readiness probe for deployment diagnostics.
 * Never returns environment values, API keys, organization IDs, or clinical data.
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
  const supabaseKey = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();
  const geminiConfigured = Boolean(getGeminiApiKey());
  const audioBucketConfigured = Boolean(
    (getRuntimeEnv('CLINICAL_AUDIO_BUCKET') || 'clinical-audio-private').trim(),
  );
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

  let supabaseReachable: boolean | null = null;
  if (supabaseUrl && supabaseKey) {
    try {
      const base = new URL(supabaseUrl);
      if (base.protocol === 'https:' && base.hostname.endsWith('.supabase.co')) {
        const endpoint = new URL('/auth/v1/settings', base);
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: { apikey: supabaseKey },
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
        });
        supabaseReachable = response.ok;
        // Consume/close the small response without returning its contents.
        await response.body?.cancel().catch(() => undefined);
      } else {
        supabaseReachable = false;
      }
    } catch {
      supabaseReachable = false;
    }
  }

  const checks = {
    mode: demoMode ? 'demo' : 'live',
    supabaseConfigured: Boolean(supabaseUrl && supabaseKey),
    supabaseReachable,
    geminiConfigured,
    audioBucketConfigured,
  };
  const ready =
    !demoMode &&
    checks.supabaseConfigured &&
    supabaseReachable === true &&
    geminiConfigured &&
    audioBucketConfigured;

  return NextResponse.json(
    { ready, service: 'sinan-clinical-workspace', checks, timestamp: new Date().toISOString() },
    { status: ready ? 200 : 503, headers: noStore },
  );
}
