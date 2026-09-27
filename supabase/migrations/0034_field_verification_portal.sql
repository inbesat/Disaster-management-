-- Shared citizen → field responder → government verification workflow.
ALTER TABLE public.crowdsourced_reports
  ADD COLUMN IF NOT EXISTS reporter_token_hash text,
  ADD COLUMN IF NOT EXISTS workflow_status text NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS assigned_responder_id text,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS verdict_note text,
  ADD COLUMN IF NOT EXISTS evidence_url text,
  ADD COLUMN IF NOT EXISTS dispute_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prior_responder_id text;

ALTER TABLE public.crowdsourced_reports
  ADD CONSTRAINT crowdsourced_reports_workflow_status_check
    CHECK (workflow_status IN ('queued', 'claimed', 'checked_in', 'completed', 'escalated')),
  ADD CONSTRAINT crowdsourced_reports_priority_check
    CHECK (priority IN ('normal', 'high', 'critical'));

CREATE INDEX IF NOT EXISTS crowdsourced_reports_workflow_priority_idx
  ON public.crowdsourced_reports (workflow_status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS crowdsourced_reports_reporter_idx
  ON public.crowdsourced_reports (reporter_token_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS public.responder_profiles (
  id text PRIMARY KEY,
  name text NOT NULL,
  organization text NOT NULL,
  organization_type text NOT NULL CHECK (organization_type IN ('ngo', 'police', 'ndrf', 'sdrf', 'medical', 'civil_defence', 'volunteer', 'other')),
  district text NOT NULL,
  phone text,
  designation text,
  badge_id text,
  service_radius_km integer NOT NULL DEFAULT 20 CHECK (service_radius_km BETWEEN 1 AND 200),
  tier text NOT NULL DEFAULT 'probation' CHECK (tier IN ('probation', 'approved', 'trusted')),
  training_completed_at timestamptz,
  reliability_score integer NOT NULL DEFAULT 50 CHECK (reliability_score BETWEEN 0 AND 100),
  total_verifications integer NOT NULL DEFAULT 0,
  availability text NOT NULL DEFAULT 'available' CHECK (availability IN ('available', 'unavailable')),
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS responder_profiles_dispatch_idx
  ON public.responder_profiles (district, approval_status, availability);

CREATE TABLE IF NOT EXISTS public.report_verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.crowdsourced_reports(id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('submitted', 'claimed', 'assigned', 'checked_in', 'verified', 'partially_true', 'rejected', 'escalated', 'released', 'priority_changed', 'disputed')),
  note text,
  lat double precision,
  lng double precision,
  evidence_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS report_verification_events_report_idx
  ON public.report_verification_events (report_id, created_at DESC);
CREATE INDEX IF NOT EXISTS report_verification_events_actor_idx
  ON public.report_verification_events (actor_id, created_at DESC);

-- Browser clients do not write workflow tables directly. Server actions use
-- the server's database connection after resolving role and ownership.
ALTER TABLE public.responder_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_verification_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.responder_profiles FROM anon, authenticated;
REVOKE ALL ON public.report_verification_events FROM anon, authenticated;

-- Citizen and field photos are private; only server-side validated uploads
-- and short-lived signed URLs may expose individual objects.
INSERT INTO storage.buckets (id, name, public)
VALUES ('citizen-reports', 'citizen-reports', false), ('field-reports', 'field-reports', false)
ON CONFLICT (id) DO UPDATE SET public = false;
