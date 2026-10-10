// OpenNext generates this module during `npm run build:cloudflare`.
// @ts-ignore Generated build artifact; it is intentionally absent before the OpenNext build.
import openNextWorker from './.open-next/worker.js';

type WorkerEnv = { CRON_SECRET?: string; [key: string]: unknown };
type ScheduledEvent = { cron: string; scheduledTime: number };
type ExecutionContextLike = { waitUntil(promise: Promise<unknown>): void };

const handler = openNextWorker as unknown as {
  fetch(request: Request, env: WorkerEnv, ctx: ExecutionContextLike): Promise<Response>;
};

/**
 * Custom OpenNext entry point.
 * HTTP is delegated to OpenNext unchanged; Cloudflare Cron invokes the internal
 * Next route in-process so the secret never travels over a public network request.
 */
export default {
  fetch: handler.fetch,

  async scheduled(event: ScheduledEvent, env: WorkerEnv, ctx: ExecutionContextLike): Promise<void> {
    ctx.waitUntil((async () => {
      const secret = env.CRON_SECRET;
      if (typeof secret !== 'string' || secret.length < 32) {
        console.error('[aqarflow-cron] CRON_SECRET is missing or too short');
        return;
      }

      try {
        const request = new Request('https://aqarflow-cron.invalid/api/aqarflow/automation/dispatch', {
          method: 'POST',
          headers: { authorization: `Bearer ${secret}` },
        });
        const response = await handler.fetch(request, env, ctx);
        if (!response.ok) {
          console.error('[aqarflow-cron] dispatch failed', { cron: event.cron, status: response.status });
          return;
        }
        const result = await response.json().catch(() => ({})) as {
          dispatched?: { taskNotifications?: number; viewingNotifications?: number };
        };
        console.info('[aqarflow-cron] dispatch completed', {
          cron: event.cron,
          taskNotifications: Number(result.dispatched?.taskNotifications || 0),
          viewingNotifications: Number(result.dispatched?.viewingNotifications || 0),
        });
      } catch (error) {
        console.error('[aqarflow-cron] dispatch failed', error instanceof Error ? error.message : 'unknown error');
      }
    })());
  },
};
