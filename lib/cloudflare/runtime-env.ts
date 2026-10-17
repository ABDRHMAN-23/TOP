import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Read a server-side setting from the Workers runtime, with a process.env
 * fallback for local Node.js and standard Node-compatible deployments.
 * Never use this helper for client-side code.
 */
export function getRuntimeEnvAny(names: readonly string[]): string | undefined {
  for (const name of names) {
    const processValue = process.env[name];
    if (typeof processValue === 'string' && processValue.trim()) return processValue.trim();
  }

  try {
    const context = getCloudflareContext();
    const environment = context.env as unknown as Record<string, unknown>;
    for (const name of names) {
      const bindingValue = environment[name];
      if (typeof bindingValue === 'string' && bindingValue.trim()) return bindingValue.trim();
    }
  } catch {
    // The Cloudflare context is unavailable in normal Node.js/test execution.
  }

  return undefined;
}

export function getRuntimeEnv(name: string): string | undefined {
  return getRuntimeEnvAny([name]);
}

export function getGeminiApiKey(): string | undefined {
  // Accept common Google AI secret names for deployments that predate this canonical name.
  return getRuntimeEnvAny([
    'GEMINI_API_KEY',
    'GOOGLE_API_KEY',
    'GOOGLE_GEMINI_API_KEY',
    'GOOGLE_GENAI_API_KEY',
    'GOOGLE_GENERATIVE_AI_API_KEY',
    'GEMINI_KEY',
  ]);
}
