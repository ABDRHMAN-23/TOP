# Sinan remote setup check — 13 October 2026

## Local package verification

- `npm test`: 27 tests passed, 0 failed.
- TypeScript/TSX syntax parse using the globally available TypeScript parser: 41 files parsed, 0 syntax errors.
- `npm run preflight`: passed in demo mode. Demo mode intentionally does not persist patient or clinical data.
- ZIP package source remains separate from any live patient data; `.env.example` contains placeholders only.

## What was verified remotely

### Vercel

- Project: `sinan-dental-workspace` (`prj_pNFleurHEHyQ8nTwn6JItWfp5jlW`).
- A deployment reports `READY`, but its source tree contains only `src/app.js`, `src/index.html`, and `src/styles.css`. This is not the Next.js Sinan workspace in this package.
- Project environment inspection returned zero variables and zero hidden production variables.
- Deployment protection-bypass reads and build-event reads are denied with HTTP 403 for the `abdrhman-23s-projects` scope. The current connection must be granted access to that team/project before updating the project or validating the protected deployment.
- No remote deployment or environment variable was changed during this check.

### Supabase

- The candidate project `ewaeuqvkxoukeogeqgye` is `INACTIVE`; restoring it was denied because the organization is already at its two-active-project limit on the current free plan.
- `TOP` and `Yemen News Intelligence` remain active and untouched. They are unrelated live projects and must not be used as Sinan's clinical database.
- No migration was applied and no clinical or sample patient data was written remotely.

### GitHub and package build

- The connected GitHub tools did not expose a dedicated Sinan repository or a repository-creation action. No unrelated repository was modified.
- A fresh local `npm install` attempt failed because DNS resolution for `registry.npmjs.org` returned `EAI_AGAIN`. Therefore dependency-backed `npm run typecheck` and `npm run build` remain unverified. The syntax parse and tests do not substitute for a production build.

## Required to continue to a live deployment

1. Reauthorize the Vercel connection so it has access to `abdrhman-23s-projects` and the `sinan-dental-workspace` project, or choose a new authorized deployment target.
2. Provide a dedicated empty Supabase project for Sinan. The inactive project cannot be restored until an active-project slot is freed or the plan changes; creating a replacement may incur cost and requires the owner's explicit organization and cost confirmation.
3. After a dedicated database is available, inspect its schema, apply `supabase/migrations/202610120001_initial_clinical_workspace.sql`, set up Supabase Auth/private Storage, then configure the production environment variables. Keep `GEMINI_API_KEY` server-only.
4. Run dependency-backed typecheck/build and validate consent, tenant isolation, audio upload/retries, clinician approval, and reports before accepting real patient data.

**Status:** source package and local logic tests are available; the real application is not yet deployed end-to-end. Do not use this workspace with real patient data until the above checks are completed.


## Addendum — 15 October 2026: shared-database safety check

The current Cloudflare workflow had been compiling the application with `NEXT_PUBLIC_DEMO_MODE=false` and the Supabase project `djpfjbjjybpquvzacmtj` (project name `TOP`). A read-only inspection confirmed that this database contains earlier Aqarflow migrations as well as the Sinan clinical tables. The listed Sinan tables had row-level security enabled and reported zero rows at the time of inspection, but this does not make a shared application database an acceptable destination for real dental records.

The Cloudflare workflow is therefore locked to `NEXT_PUBLIC_DEMO_MODE=true` and no longer injects the TOP Supabase URL or key. The interface can be reviewed, but the demo intentionally does not create or persist real patient data and the microphone workflow remains unavailable. Do not change the deployment to live mode until a dedicated Supabase project for Sinan has been provisioned, verified, migrated, and configured with Auth, private audio storage policies, and the correct runtime secrets. The presence of a table or an RLS flag alone is not an end-to-end clinical validation.

The GitHub workflow does not configure `GEMINI_API_KEY`; whether a Cloudflare Worker secret exists independently was not verified. Audio transcription should not be considered production-ready until that secret and the complete recording-to-approved-report path are tested with consented non-production data.


## Addendum — printable transcript and remaining clinical limits

The latest report implementation now snapshots the saved transcription together with the approved structured note and displays that text on the on-site printable report when present. It remains a transcript for review, not a separate medical conclusion. The application still has no automatic audio-retention cleanup job: `audio_retention_days` is saved as a clinic setting, but an enforced deletion schedule must be implemented and tested separately. The current print route opens the browser print dialog (including “Save as PDF”); it does not generate a downloadable server-side PDF file. The dental glyphs are differentiated 2D SVG schematics, not clinically validated three-dimensional tooth models. A dental professional must verify chart orientation and morphology before real clinical use.
