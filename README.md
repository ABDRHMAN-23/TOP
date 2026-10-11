# AqarFlow AI

AqarFlow AI is a real-estate sales workspace for property owners and real-estate offices. Its product goal is not to be a public listing marketplace; it helps an office maintain its property inventory, manage customer conversations, and prepare context-aware sales replies grounded in the office's own verified information.

## Public website experience

- The homepage explains the sales-intelligence value proposition and includes an interactive, illustrative conversation demo.
- Demo scenarios use sample content only. They do not contact WhatsApp, query an office inventory, or represent live assistant output.
- The office sign-in interface currently keeps the existing Supabase email magic-link and configured Google/Apple methods. WhatsApp phone OTP is not implemented by the UI redesign.
- The authenticated workspace surfaces inventory, the sales assistant, the inbox, CRM, operations, analytics, and WhatsApp connection settings.

## Product capabilities in this repository

- Real-estate inventory CRUD and verified-property data.
- AI-assisted sales response drafts grounded in the current workspace inventory.
- CRM/inbox and lead-follow-up workflows.
- Operations for tasks and viewings.
- Sales analytics.
- WhatsApp Cloud API connection, signed webhook ingestion, and controlled/manual outbound messaging workflows.

## Technology

- Next.js App Router, React, and TypeScript
- Supabase Auth, Postgres, and Storage
- Gemini API for grounded AI response generation
- WhatsApp Cloud API integration components
- Cloudflare OpenNext deployment configuration

## Local development and checks

Install the locked dependencies:

```bash
npm ci
```

Run the application:

```bash
npm run dev
```

Production checks:

```bash
npm run build
npm run build:cloudflare
npm run test:aqarflow:sales
npm run test:aqarflow:runtime
npm run test:aqarflow:migration
npm run test:aqarflow:whatsapp-cloud
```

The new UI is implemented on a feature branch for review. It is not live in production until the pull request is reviewed/merged and a deployment succeeds. A successful build also does not establish that Meta credentials, live WhatsApp messaging, phone OTP, or automatic replies are configured end-to-end.
