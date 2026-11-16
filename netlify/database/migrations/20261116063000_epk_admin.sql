-- Private production database: admin API is the sole read/write surface.
CREATE TABLE IF NOT EXISTS epk_applications (
  id text PRIMARY KEY,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  profile_type text NOT NULL DEFAULT 'unspecified',
  public_name text NOT NULL DEFAULT 'Unnamed applicant',
  contact text NOT NULL DEFAULT '',
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  stage text NOT NULL DEFAULT 'new' CHECK (stage IN ('new','under_review','awaiting_content','in_production','client_approval','published')),
  internal_notes text NOT NULL DEFAULT '',
  approval_verified boolean NOT NULL DEFAULT false,
  approval_evidence text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE INDEX IF NOT EXISTS epk_applications_submitted_idx ON epk_applications (submitted_at DESC);
CREATE INDEX IF NOT EXISTS epk_applications_stage_idx ON epk_applications (stage, submitted_at DESC);
CREATE TABLE IF NOT EXISTS epk_application_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  application_id text NOT NULL REFERENCES epk_applications(id) ON DELETE CASCADE,
  actor text NOT NULL,
  action text NOT NULL,
  from_stage text,
  to_stage text,
  summary text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS epk_activity_app_idx ON epk_application_activity (application_id, created_at DESC);