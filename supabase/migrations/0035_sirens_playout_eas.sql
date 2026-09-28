-- =====================================================================
-- 0035_sirens_playout_eas.sql
-- Siren network persistence + playout/EAS station columns.
--
--   siren_towers      — district outdoor-warning towers (GSM/relay).
--   siren_activations — every trigger with two-person confirmations.
--   fm_stations.playout_endpoint — per-station automation REST endpoint.
--   fm_stations.eas_area_code    — SAME area-code override.
--
-- HOW TO RUN
--   Option A — Supabase SQL editor: paste + Run (idempotent).
--   Option B — CLI: supabase db push
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SIREN TOWERS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.siren_towers (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name               VARCHAR(100) NOT NULL,
    location           VARCHAR(200) NOT NULL,
    district           VARCHAR(100),
    status             VARCHAR(20) NOT NULL DEFAULT 'online', -- online | malfunction | sounding | offline
    coverage_radius_m  INTEGER NOT NULL DEFAULT 500,
    controller_phone   VARCHAR(20),
    lat                DOUBLE PRECISION,
    lng                DOUBLE PRECISION,
    last_tested_at     TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_siren_towers_district_status
  ON public.siren_towers (district, status);

-- ---------------------------------------------------------------------
-- 2. SIREN ACTIVATIONS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.siren_activations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    district      VARCHAR(100),
    tower_ids     TEXT[] NOT NULL DEFAULT '{}',
    status        VARCHAR(20) NOT NULL DEFAULT 'sounding', -- sounding | partial | failed | stood_down
    confirmations INTEGER NOT NULL DEFAULT 0,
    decided_by    UUID,
    alert_id      TEXT,
    test_mode     BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_siren_activations_district_created
  ON public.siren_activations (district, created_at);

-- ---------------------------------------------------------------------
-- 3. FM STATION EXTENSIONS (playout + EAS)
-- ---------------------------------------------------------------------
ALTER TABLE public.fm_stations
  ADD COLUMN IF NOT EXISTS playout_endpoint TEXT,
  ADD COLUMN IF NOT EXISTS eas_area_code VARCHAR(10);

-- ---------------------------------------------------------------------
-- 4. RLS (gov-only: siren detail never public)
-- ---------------------------------------------------------------------
ALTER TABLE public.siren_towers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.siren_activations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS siren_towers_gov_all ON public.siren_towers;
CREATE POLICY siren_towers_gov_all ON public.siren_towers
  FOR ALL
  USING (public.current_user_role() IN ('super_admin', 'district_admin', 'field_responder'))
  WITH CHECK (public.current_user_role() IN ('super_admin', 'district_admin', 'field_responder'));

DROP POLICY IF EXISTS siren_activations_gov_all ON public.siren_activations;
CREATE POLICY siren_activations_gov_all ON public.siren_activations
  FOR ALL
  USING (public.current_user_role() IN ('super_admin', 'district_admin', 'field_responder'))
  WITH CHECK (public.current_user_role() IN ('super_admin', 'district_admin', 'field_responder'));

-- ---------------------------------------------------------------------
-- 5. SEED — Patna pilot towers (matches the old UI mock, now real rows)
-- ---------------------------------------------------------------------
INSERT INTO public.siren_towers (name, location, district, status, coverage_radius_m)
VALUES
  ('Tower 1', 'Riverside', 'Patna', 'online', 500),
  ('Tower 2', 'Market', 'Patna', 'online', 500),
  ('Tower 3', 'Railway Station', 'Patna', 'malfunction', 500)
ON CONFLICT DO NOTHING;
