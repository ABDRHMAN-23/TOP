import { getCloudflareContext } from '@opennextjs/cloudflare';

export function runtimeEnv(name: string): string | undefined {
  try {
    const { env } = getCloudflareContext();
    const value = (env as Record<string, unknown>)[name];
    if (typeof value === 'string' && value.length > 0) return value;
  } catch {}

  const fallback = process.env[name];
  return typeof fallback === 'string' && fallback.length > 0 ? fallback : undefined;
}
