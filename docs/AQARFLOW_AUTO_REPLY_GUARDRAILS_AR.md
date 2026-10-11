# AqarFlow automatic reply — guarded rollout plan

This phase adds a fail-closed policy and webhook-connected sales orchestrator for WhatsApp auto replies, plus supporting schema/quota functions. It deliberately does **not** turn automatic replies on by default. Each connection stays disabled after creation or reauthorization until its owner explicitly enables it from WhatsApp settings.

## Policy

- Only active integrations and inbound text messages qualify.
- The contact must not have opted out.
- The inbound timestamp must be verified and inside the 24-hour customer-service window.
- A customer request to stop messages records a contact-level opt-out and must not receive a further marketing reply.
- A request to speak with a person is routed to human handoff instead of a persuasion attempt.
- Image/audio/unsupported message types are not passed to a text-only sales response generator.
- Generation must use current workspace-scoped property inventory and the AqarFlow sales validator.
- Before an outbound message, the sender must validate token configuration and claim a deterministic idempotency key. A pending/unknown send is never blindly retried.
- Quota reservation and usage recording are available to the webhook only through RPCs executable by `service_role`; user roles cannot call them directly.

## Tests

```bash
npm run test:aqarflow:auto-reply-policy
npm run test:aqarflow:migration
npm run test:aqarflow:whatsapp-cloud
```

Passing the policy unit test is not proof of a working WhatsApp auto-reply. The feature branch now invokes the policy from the signed inbound webhook, runs workspace-scoped sales generation, validates the draft, claims an outbound idempotency key, and calls WhatsApp Cloud API. It still requires successful CI on the latest commit and an end-to-end test against a real configured Meta app and test recipient before any production use. Do not enable it on a live number until those checks pass.
