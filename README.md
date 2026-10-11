# AqarFlow AI

AqarFlow AI is a real-estate sales workspace intended to help real-estate offices manage property inventory and customer conversations, with a context-aware sales assistant designed to guide customers naturally and respectfully toward a suitable property or a useful next step.

The product's intended differentiator is **sales intelligence**, not a public property marketplace: understand the customer's needs, respect hard budget and deal-breaker constraints, compare verified listings, handle objections without pressure, and preserve the office's reputation.

## Current code areas

- `lib/aqarflow/sales-engine.ts`: grounded sales prompt construction, verified-property matching, and bounded response validation.
- `lib/aqarflow/sales-playbook.ts`: first heuristic layer for selecting context-specific sales guidance.
- `data/aqarflow-sales/scenarios.v1.json`: seed scenarios for automated classification/evaluation; this is not a 15,000-case dataset and does not mean the model has been fine-tuned.
- `components/aqarflow/AqarFlowSalesAssistant.tsx` and `app/api/aqarflow/sales/route.ts`: authenticated interface/API for generating a response draft from workspace inventory.
- `lib/aqarflow/whatsapp-cloud.ts` and `app/api/integrations/whatsapp/`: existing WhatsApp Cloud integration components; connecting the drafted sales engine into end-to-end automatic replies still requires integration and real-provider testing.
- `supabase/migrations/`: database changes and contracts for the current application. Review migrations, access boundaries, and backups before applying any schema changes.
- `docs/AQARFLOW_KING_OF_MARKETING_AR.md`: product behavior, safety principles, evaluation approach, and roadmap for expanding the scenario set.

## Architecture principles

1. Keep property prices, details, and availability grounded in verified workspace inventory. A language model must not invent facts, amenities, discounts, legal guarantees, or booking confirmations.
2. Keep a firm customer budget or deal-breaker as a hard constraint unless the customer explicitly changes it.
3. Treat no exact match as the beginning of an honest alternatives conversation—not permission to push unsuitable inventory.
4. Keep the office's conversational voice professional and natural. Do not identify as an AI unprompted, but never falsely claim to be a specific human employee or mislead a customer who asks directly.
5. Respect requests to stop contact, privacy, customer consent, and escalation to a human when the situation requires it.
6. Keep the property database, marketing playbook, and conversation memory separate so listing updates do not require model retraining.

## Stack observed in this repository

- Next.js App Router, React, and TypeScript
- Supabase Auth, Postgres, and Storage
- Gemini API for AI-backed generation
- WhatsApp Cloud API integration modules
- Cloudflare OpenNext deployment scripts
- Promptfoo and project-specific test scripts

## Local checks

Install locked dependencies with:

```bash
npm ci
```

Relevant focused tests:

```bash
npm run test:aqarflow:sales
npm run test:aqarflow:sales-playbook
npm run test:aqarflow:runtime
npm run validate:aqarflow:promptfoo
```

Full CI also runs migration checks, additional application tests, dependency auditing, and production builds.

## Important status note

The sales playbook and 46 scenario seed cases on the feature branch are an initial implementation slice. They are not proof of fine-tuning, a large reviewed training corpus, live WhatsApp auto-reply behavior, or production readiness. Check the associated pull request and CI results before merging. Do not apply database migrations or enable outbound automation in a live workspace without separately reviewing access controls, consent behavior, backups, rollback, and provider configuration.
