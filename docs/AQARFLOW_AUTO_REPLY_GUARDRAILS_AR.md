# AqarFlow automatic reply — guarded rollout plan

This phase adds a fail-closed decision policy for webhook-based WhatsApp auto replies and supporting schema/quota functions. It deliberately does **not** turn automatic replies on by default. Every integration remains disabled until its owner explicitly enables it.

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

Passing the policy unit test is not proof of a working WhatsApp auto-reply. The webhook still needs to invoke the policy, execute the workspace-scoped sales generation, persist the CRM response, send through WhatsApp Cloud API, and be tested end-to-end with a real configured Meta app before this feature can be considered live.
