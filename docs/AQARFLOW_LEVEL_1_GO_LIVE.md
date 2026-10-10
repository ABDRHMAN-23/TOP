# AqarFlow Level 1 — Go-live and verification checklist

> Status: application changes are on `integration/level-1-crm-whatsapp-promptfoo`. A passing CI run validates code, SQL migrations against a disposable PostgreSQL instance, Promptfoo configuration, and both builds. It does **not** prove that the remote Supabase project, Meta Business app, WhatsApp number, or production deployment is configured.

## Scope decision

This implementation keeps the CRM, inventory, and inbox native to the existing TOP/QUVOTO Next.js application and uses Meta WhatsApp Cloud API. It does not vendor DeskcommCRM as a second application root and does not use its WAHA/VPS deployment. That avoids a second login/database/deployment stack, but it is a deliberate difference from a literal “DeskcommCRM as the application base” requirement. Do not describe the upstream project as integrated source code.

## 1. Supabase — use development first

- [ ] Create/select a **development** Supabase project/branch that has TOP's baseline schema and Auth tables. The current production project had no development branch when this runbook was written.
- [ ] Back up/confirm a restore path before any production schema change.
- [ ] Apply the four AqarFlow migrations in timestamp order to development:
  1. `20261010000200_aqarflow_ai_runtime.sql`
  2. `20261010000300_aqarflow_whatsapp_tech_provider.sql`
  3. `20261010000400_aqarflow_crm_inbox.sql`
  4. `20261010000500_aqarflow_crm_lead_pipeline.sql`
- [ ] Verify all four are recorded in migration history and inspect the resulting tables, grants, and RLS. CI's local PostgreSQL test is not a substitute for this remote test.
- [ ] Point the development deployment at the development Supabase URL and keys. Never share a production secret with browser code or commit secrets.
- [ ] Confirm that the server-only Supabase secret used by `lib/supabase/admin.ts` can access only the service-side code paths intended by the app. Do not grant `anon` or `authenticated` direct table access to the WhatsApp token/event tables.

## 2. Meta Business / WhatsApp setup

- [ ] Use a Meta app with the WhatsApp Business Platform product and a Business account. Configure **Facebook Login for Business / Embedded Signup** in the Meta app dashboard.
- [ ] Create an Embedded Signup configuration that matches the intended onboarding mode. Keep `META_WHATSAPP_SIGNUP_MODE=cloud_api` unless the configuration explicitly supports Coexistence.
- [ ] Configure and verify the webhook callback URL: `https://<your-development-host>/api/integrations/whatsapp/webhook`.
- [ ] Set the same random webhook verify token in Meta and the server secret `META_WEBHOOK_VERIFY_TOKEN`; subscribe the app to the `messages` webhook field. The connection endpoint also subscribes the authorized WABA to the app.
- [ ] Request/review the permissions required for the intended provider flow, including `business_management`, `whatsapp_business_management`, and `whatsapp_business_messaging`, as applicable to the current Meta app type and access tier. Complete Meta App Review, business verification, and Advanced Access if required.
- [ ] Complete any remaining Meta Tech Provider steps in Meta's official dashboard, including system-user/business asset configuration, phone-number registration/PIN, approved message templates, and credit-line sharing where the chosen business model requires it. These account/financial actions are deliberately **not** performed automatically by this code.
- [ ] Test with a development WABA/phone number before connecting production numbers.

## 3. Runtime variables and server secrets

Set these values in the **development** deployment first. Use Cloudflare Worker variables for public/non-secret configuration and Worker Secrets for credentials.

### Public/runtime variables

- `NEXT_PUBLIC_META_APP_ID`: public Meta App ID.
- `NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID`: ID of the Embedded Signup configuration.
- `META_GRAPH_API_VERSION=v26.0`: explicit Graph API version pinned by this branch.
- `META_WHATSAPP_SIGNUP_MODE=cloud_api`: switch to `coexistence` only when the Meta configuration is compatible.
- `AQARFLOW_GEMINI_MODEL=gemini-3.5-flash-lite` and `GEMINI_API_URL=https://generativelanguage.googleapis.com`.

### Server-only secrets

- `META_APP_ID` and `META_APP_SECRET`.
- `META_WEBHOOK_VERIFY_TOKEN`.
- `META_TOKEN_ENCRYPTION_KEY`: Base64 encoding of **exactly 32 random bytes**. Generate once per environment and store it as a secret; never commit it or change it casually after encrypted tokens exist.
- `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `QUVOTO_LEGAL_CONSENT_SECRET`, and the existing billing secrets required by the application's existing routes.
- Keep `NEXT_PUBLIC_*` variables non-secret: never place an app secret or Supabase service key under that prefix.

The repository's `.env.example` lists the project-wide variables. Values for real credentials must be created in the relevant account dashboard; they cannot be inferred from the Git repository.

## 4. Functional smoke test

- [ ] Sign in as the intended workspace owner on the development deployment.
- [ ] Open `/settings/whatsapp`, start Embedded Signup, complete Meta's flow, and verify that the connected phone number appears. The integration record should contain encrypted token ciphertext, not plaintext.
- [ ] Send a real inbound test message from a separate test phone to the connected number. Confirm one contact, one conversation, and one inbound message appear in the CRM inbox.
- [ ] Replay the same signed webhook event and confirm the event/message is not duplicated and the conversation is not moved backwards. Confirm a previously unprocessed webhook event can be retried to recover after a temporary persistence failure.
- [ ] Generate a draft from the inbox. Confirm that the draft is saved but no message is sent automatically.
- [ ] During Meta's 24-hour customer-service window, send a human-approved text and confirm both provider result and CRM history. Outside the window, free-form send is expected to be rejected; approved-template send/management is not implemented in this branch.
- [ ] Create/edit a manual lead, validate budget ordering, assign a follow-up, add a note, and navigate from the lead to its linked conversation.
- [ ] Test with two different workspace owners and confirm neither can read or modify the other's properties, contacts, conversations, messages, notes, tokens, or outbound records.

## 5. Promptfoo and deployment gates

- [ ] Run `npm run validate:aqarflow:promptfoo` (configuration validation only).
- [ ] For a live evaluation, set `AQARFLOW_EVAL_URL` to the development sales endpoint and `AQARFLOW_EVAL_COOKIE` to a short-lived session cookie for a **test account with synthetic property data**, then run `npm run eval:aqarflow:promptfoo`. Do not put the cookie in GitHub logs, issue comments, or this file.
- [ ] Confirm the latest GitHub Actions run passes after the final commit.
- [ ] Review all changes, then merge/deploy only after the remote database and Meta smoke tests pass.

## Remaining product boundary

This branch implements native CRM/inventory/inbox, WhatsApp Cloud API Embedded Signup/webhooks, owner-reviewed free-form replies inside the 24-hour service window, and Promptfoo regression configuration. It does not yet provide approved WhatsApp template management/sending, automated system-user or credit-line onboarding, a live Meta-account test, an authenticated live Promptfoo evaluation, or a literal DeskcommCRM codebase migration. Keep the PR in Draft until the applicable external and product-scope gates are explicitly resolved.
