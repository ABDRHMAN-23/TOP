# Sinan — Architecture and clinical safety

## Runtime

- Next.js App Router, React, TypeScript.
- Supabase Auth via cookie-backed `@supabase/ssr` session.
- PostgreSQL for clinic, patient, encounter, recording metadata, transcript, notes, approvals, endodontic cases, reports and audit events.
- Private Supabase Storage bucket `clinical-audio-private` for audio fragments.
- Google Gemini is called from the server only; the key must never be exposed in a `NEXT_PUBLIC_` variable.

## Data boundaries

Every tenant-owned row includes `organization_id`; routes obtain clinic membership server-side and all queries filter by that organization. Row-level security repeats this isolation at the database boundary. The selected clinic is placed in the HttpOnly `sinan-org-id` cookie after membership is verified; middleware copies only a UUID-shaped value into `x-organization-id`. The database still checks membership and RLS.

## Recording flow

1. The clinician must select a real saved patient and attest that required recording consent has already been obtained and recorded.
2. `/api/recordings` creates an encounter, consent metadata and recording session.
3. Browser `MediaRecorder` creates short fragments; each fragment is uploaded to the private bucket and associated with a sequence number.
4. `/api/recordings/[recordingId]/finish` finalizes capture and creates a processing job.
5. `/api/ai/process-recording` downloads fragments in index order, concatenates them, transcribes the audio, and asks Gemini for a structured draft.
6. The structured response is sanitized: model-originated states cannot be `clinician_confirmed`; missing facts remain explicitly missing; patient-reported statements retain that provenance.
7. Transcript and a `needs_review` clinical-note version are saved. The encounter remains unapproved until an authorized clinician explicitly approves that version.

Direct inline audio is currently capped at 15 MiB per processing job. Larger recordings are retained in storage but are not automatically processed by this v1 route; use shorter sessions or implement a resumable provider file-upload path before accepting longer sessions in production.

## Clinical safety contract

- Empty/missing is not a negative clinical finding.
- AI output is always a draft.
- A patient's request is not a diagnosis, treatment completed, or medication order.
- Medication names, dosages, tooth status, canal lengths and dates must be reviewed if unclear.
- Only an authorized clinician can approve the current version.
- Final report creation only accepts an approved note and stores a snapshot. Current baseline uses browser print / Save as PDF; a secure server-rendered downloadable PDF service remains a production enhancement.
- Speaker attribution is marked uncertain unless evidence is available. This v1 route does not claim to identify individual speakers reliably or enroll voiceprints.

## Local setup

1. Install Node.js 20+ and npm.
2. `npm install`
3. Copy `.env.example` to `.env.local`.
4. Add a **dedicated new Supabase project** and set its URL and anon key.
5. Review and run `supabase/migrations/202610120001_initial_clinical_workspace.sql` against that dedicated, empty project. Do not run it against `TOP`, OFOQ, the news project or any database containing unrelated or production data.
6. Configure `GEMINI_API_KEY` on the server if you want actual audio transcription/structuring.
7. Create an authenticated user in Supabase Auth, sign in, then open `/onboarding` to create the first clinic.
8. `npm run check`, `npm test`, `npm run build`.

The project uses `NEXT_PUBLIC_DEMO_MODE=true` by default so the interface opens with clearly labelled synthetic fixtures. To use live routes, set it to `false`, deploy with the necessary environment variables and test tenant isolation, consent and restore procedures first.

## Still required before real clinical use

This is an implementation foundation, not a certified clinical record system. Before real patient information is accepted, complete threat modeling, legal/privacy review for the launch jurisdiction, encryption/storage configuration checks, restore tests, security test cases, transcription evaluation using consented/de-identified recordings, dental-professional verification of tooth orientation and clinical schema, background processing/retry design for long sessions, transactional note revision, and a tested final-report renderer.
