/**
 * Normalize a Supabase project URL before handing it to supabase-js.
 * The SDK itself adds /rest/v1 for PostgREST requests, so an environment
 * value that already ends in /rest/v1 (or repeats it) would produce 404s.
 */
export function normalizeSupabaseUrl(value: string | undefined | null): string | null {
  if (!value || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    parsed.pathname = parsed.pathname
      .replace(/(?:\/rest\/v1)+\/?$/i, '')
      .replace(/\/+$/, '') || '/';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}
