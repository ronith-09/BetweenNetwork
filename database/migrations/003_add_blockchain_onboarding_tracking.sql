ALTER TABLE bank_applications
  ADD COLUMN IF NOT EXISTS blockchain_onboarding_status VARCHAR(50) NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN IF NOT EXISTS blockchain_onboarding_started_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS blockchain_onboarding_completed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS blockchain_onboarding_failed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS blockchain_onboarding_last_error TEXT,
  ADD COLUMN IF NOT EXISTS blockchain_org_metadata JSONB;

ALTER TABLE bank_applications
  DROP CONSTRAINT IF EXISTS valid_app_status;

ALTER TABLE bank_applications
  ADD CONSTRAINT valid_app_status CHECK (
    status IN ('APPLIED', 'UNDER_REVIEW', 'REJECTED', 'APPROVED_PENDING_ACTIVATION', 'ACTIVE')
  );

ALTER TABLE bank_applications
  DROP CONSTRAINT IF EXISTS valid_blockchain_onboarding_status;

ALTER TABLE bank_applications
  ADD CONSTRAINT valid_blockchain_onboarding_status CHECK (
    blockchain_onboarding_status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED')
  );

CREATE INDEX IF NOT EXISTS idx_bank_applications_blockchain_onboarding_status
  ON bank_applications(blockchain_onboarding_status);
