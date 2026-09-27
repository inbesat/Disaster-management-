# SafeSphere field verification portal

The third portal lives at `/portal`. Citizens submit a report at `/public/report` and track it at `/public/reports`. Approved field responders claim, check in, and record a verdict. Government staff approve profiles, set tiers and priorities, assign work, and review escalations at `/portal/admin`. The government dashboard and command-center map read the same persisted reports. No part of this change deploys the site.

## Database rollout

1. Apply `supabase/migrations/0034_field_verification_portal.sql` to the active Supabase project before deploying this code. It adds workflow fields and private photo buckets.
2. Keep `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` configured server-side. The service-role key must never be exposed as a `NEXT_PUBLIC_` variable. `.env.example` already documents these names.
3. Generate the Prisma client and deploy the updated application. The Android wrapper points at the deployed SafeSphere URL, so it will pick up the web portal when that URL is updated; a new APK is only required if its configured URL changes or native code changes.
4. Set `DEMO_AUTH_ENABLED=false` when replacing demo authentication with a real identity and OTP flow. The current demo sign-ins intentionally accept any credentials and must not be treated as verified government or responder identity.

## Workflow and safeguards

- Responder profile registration never approves itself. An admin approves the profile and sets the tier after checking credentials. Training acknowledgement is required. Probation responders cannot claim rescue reports.
- A claim is exclusive and can be taken over after its 45-minute lease expires. Rescue, flood, road and shelter cards have 15-minute, 45-minute, 2-hour and 4-hour display deadlines respectively. Expired claims are released in the audit trail when another responder claims or an admin reassigns them.
- A real GPS check-in requires being within 100 metres of the report. Demo sessions have an explicitly labeled simulated arrival action. Verified and rejected verdicts require a photo; partial and escalation verdicts require an observation note. Escalation sets critical priority.
- Every report submission and workflow transition has a timestamped event. Citizen and responder photos use private Supabase buckets; field photos are stored without overwrite. Reporter contact text is redacted in field/government views.
- A citizen can dispute one rejected verdict from the same browser that submitted the report. The report reopens, and the previous responder cannot claim or receive the second review.
- Demo reports use the current `demo_session_id` and remain separate from live rows. Government demo users can add or reset an eight-report wave; the demo field login creates an isolated approved sample profile when the database is available.

## Still needed for the full roadmap

The supplied 10-phase document is a product roadmap, not proof of implemented services. This change does **not** include verified badge/NGO registry checks, district geofences, automatic push/cascade dispatch, background SLA escalation, offline photo sync, evidence EXIF authenticity checks, automatic trust scoring, WhatsApp notifications, PDF exports, RAG/model feedback, or live responder GPS tracking. Those need provider configuration, district boundary data, security review, and an active database. Do not describe evidence as legal-grade or demo sign-in as identity verification.

The active database was unreachable while this work was performed, so the migration and a real public → field → government transaction still need to be exercised against that project. If the database is unavailable, the UI reports the failure instead of issuing a false report receipt.
