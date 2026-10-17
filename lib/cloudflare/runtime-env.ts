import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Read a server-side setting from the Workers runtime, with a process.env
 * fallback for local Node.js and standard Node-compatible deployments.
 * Never use this helper for client-side code.
 */
export function getRuntimeEnv(name: string): string | undefined {
  const processValue = process.env[name];
  if (typeof processValue === 'string' && processValue.trim()) {
    return processValue.trim();
  }

  try {
    const context = getCloudflareContext();
    const environment = context.env as unknown as Record<string, unknown>;
    const bindingValue = environment[name];
    if (typeof bindingValue === 'string' && bindingValue.trim()) {
      return bindingValue.trim();
    }
  } catch {
    // The Cloudflare context is unavailable in normal Node.js/test execution.
  }

  return undefined;
}
