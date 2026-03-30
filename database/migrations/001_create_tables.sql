-- Create Participants table (ON-CHAIN data stored OFF-CHAIN for reference)
CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id VARCHAR(50) UNIQUE NOT NULL,
  bank_display_name VARCHAR(255) NOT NULL,
  bic_swift_code VARCHAR(20) NOT NULL,
  country_code VARCHAR(2) NOT NULL,
  msp_id VARCHAR(100) NOT NULL UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  supported_currencies VARCHAR(255),
  settlement_model VARCHAR(50),
  public_key_hash VARCHAR(255),
  certificate_thumbprint_hash VARCHAR(255),
  joined_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_status CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED'))
);

-- Create Bank Applications table (OFF-CHAIN data)
CREATE TABLE IF NOT EXISTS bank_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id VARCHAR(50) UNIQUE NOT NULL,
  legal_entity_name VARCHAR(255) NOT NULL,
  registered_address VARCHAR(500),
  license_number VARCHAR(100),
  regulator_name VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'APPLIED',
  bic_swift_code VARCHAR(20),
  country_code VARCHAR(2),
  msp_id VARCHAR(100),
  wallet_delivery_status VARCHAR(50),
  webhook_url VARCHAR(500),
  ip_allowlist VARCHAR(500),
  risk_review_notes TEXT,
  internal_review_metadata JSONB,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP,
  approved_at TIMESTAMP,
  rejected_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_app_status CHECK (status IN ('APPLIED', 'UNDER_REVIEW', 'REJECTED', 'APPROVED_PENDING_ACTIVATION'))
);

-- Create Bank Contacts table (OFF-CHAIN)
CREATE TABLE IF NOT EXISTS bank_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_application_id UUID NOT NULL REFERENCES bank_applications(id) ON DELETE CASCADE,
  contact_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(20),
  contact_title VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Bank Documents table (OFF-CHAIN)
CREATE TABLE IF NOT EXISTS bank_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_application_id UUID NOT NULL REFERENCES bank_applications(id) ON DELETE CASCADE,
  document_type VARCHAR(100) NOT NULL,
  document_name VARCHAR(255) NOT NULL,
  document_path VARCHAR(500) NOT NULL,
  document_hash VARCHAR(255),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Bank Review Notes table (OFF-CHAIN)
CREATE TABLE IF NOT EXISTS bank_review_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_application_id UUID NOT NULL REFERENCES bank_applications(id) ON DELETE CASCADE,
  reviewer_id VARCHAR(100) NOT NULL,
  note_text TEXT NOT NULL,
  review_status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100),
  admin_id VARCHAR(100),
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  details JSONB,
  ip_address VARCHAR(45),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_participants_bank_id ON participants(bank_id);
CREATE INDEX IF NOT EXISTS idx_participants_msp_id ON participants(msp_id);
CREATE INDEX IF NOT EXISTS idx_participants_status ON participants(status);
CREATE INDEX IF NOT EXISTS idx_bank_applications_bank_id ON bank_applications(bank_id);
CREATE INDEX IF NOT EXISTS idx_bank_applications_status ON bank_applications(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
