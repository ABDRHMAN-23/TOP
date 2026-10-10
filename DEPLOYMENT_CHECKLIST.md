# Cloudflare deployment checklist

Target Cloudflare Worker: `aqarflow-ai1`.

## Before deploying

- Confirm the Wrangler `name` matches `aqarflow-ai1`.
- Confirm the `WORKER_SELF_REFERENCE` service binding targets the intended Worker.
- Configure required secrets in the Cloudflare Workers Builds environment when the build/deploy command reads them from `process.env`.
- Configure runtime Worker secrets separately where the application needs them at runtime.
- Never commit API keys, tokens, encryption keys, or `.env` files.
- Use real credentials for enabled integrations; do not use placeholder values to bypass deployment checks.

## Current deployment blocker

The build can complete while deployment fails if required secrets are unavailable to Wrangler. Review the latest deployment log and configure the missing secrets before retrying.
