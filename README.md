# AqarFlow AI

AqarFlow AI is a real-estate sales workspace. Its intended differentiator is **context-aware sales intelligence**, not a public property marketplace or a generic WhatsApp autoresponder.

The assistant is designed to understand a customer's priorities, match them to verified listings, handle objections ethically, suggest a near-budget alternative only within explicit product guardrails, and preserve the office's reputation and privacy obligations.

## Core code

- `lib/aqarflow/sales-engine.ts`: structured buyer profile, verified listing facts, prompt construction, and guarded draft validation.
- `lib/aqarflow/sales-profile-inference.ts`: extracts explicit property needs and preferences from Arabic/English messages.
- `lib/aqarflow/sales-playbook.ts`: chooses the sales strategy appropriate to the latest customer message, including opt-out, hard budget, price objection, comparison, hesitation, trust, and handoff.
- `lib/aqarflow/sales-knowledge.ts`: original context-selected knowledge cards for discovery, value framing, alternatives, negotiation, trust, privacy, and respectful communication.
- `lib/aqarflow/ranked-inventory.ts`: ranks inventory, requires fresh verified availability for recommendations, prioritizes in-budget matches, and can select one guarded near-budget alternative.
- `lib/aqarflow/automatic-sales-reply.ts`: guarded WhatsApp auto-reply flow, structured profile memory, quota checks, draft validation, consent/state rechecks, idempotent send, and CRM persistence.
- `app/api/integrations/whatsapp/webhook/route.ts`: Meta signature validation, idempotent webhook event processing, opt-out/handoff priority, and auto-reply dispatch.
- `components/aqarflow/WhatsAppConnectionManager.tsx`: owner-controlled WhatsApp connection and per-number auto-reply toggle.
- `data/aqarflow-sales/scenarios.v1.json`: 51 seed cases for classification/evaluation. These are not a 15,000-case reviewed corpus.
- `data/aqarflow-sales/multiturn-gold-seeds.v1.json`: 22 authored multi-turn evaluation seeds with gold replies and safety criteria. They are not fine-tuning data until reviewed and converted by a training pipeline.
- `docs/AQARFLOW_KING_OF_MARKETING_AR.md`: product principles, evaluation strategy, budget rules, and the growth plan for the scenario set.
- `docs/AQARFLOW_SALES_KNOWLEDGE_CATALOG_AR.md`: documentation for the original knowledge cards.
- `docs/AQARFLOW_AUTO_REPLY_GUARDRAILS_AR.md`: runtime guardrails for automatic WhatsApp replies.

## Important behavior rules

1. Confirmed in-budget properties are prioritized over more expensive options.
2. A stated hard budget is never exceeded.
3. If the budget is not stated as final and no exact match exists, the selector may offer at most one freshly verified available listing within the configured limited overage; the reply must disclose its actual price and the difference before asking permission to share details.
4. A property with unknown or stale availability is not recommended as currently available.
5. A request to stop contact or speak with a person takes priority over sales persuasion.
6. No invented prices, features, discounts, scarcity, legal guarantees, booking confirmations, or claims about a competitor.
7. The assistant does not identify itself as AI unprompted, but it must answer honestly if directly asked and must not impersonate a named human.
8. Automatic replies remain disabled per WhatsApp integration until the owner explicitly enables them.

## Stack observed in this repository

- Next.js App Router, React, and TypeScript
- Supabase Auth, Postgres, and Storage
- Gemini API for AI-backed generation
- WhatsApp Cloud API integration modules
- Cloudflare OpenNext deployment
- CI with PostgreSQL migration checks, unit tests, Promptfoo validation, and production/Cloudflare builds

## Local validation

```bash
npm ci
npm run test:aqarflow:sales
npm run test:aqarflow:sales-playbook
npm run test:aqarflow:multiturn
npm run test:aqarflow:sales-profile
npm run test:aqarflow:auto-reply-policy
npm run test:aqarflow:runtime
npm run test:aqarflow:migration
```

## Readiness note

Current code and green CI are not the same as production proof. Real Meta application credentials, webhook registration, consent behavior, end-to-end message delivery, live database migration review, and customer-facing pilot testing must be confirmed separately. No claim is made that the assistant has been fine-tuned on complete books or thousands of expert-reviewed conversations.
