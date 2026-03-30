CREATE TABLE IF NOT EXISTS betweennetwork_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  msp_id VARCHAR(100) NOT NULL DEFAULT 'BetweenNetworkMSP',
  wallet_label VARCHAR(150) NOT NULL UNIQUE,
  wallet_path VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS betweennetwork_admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES betweennetwork_admins(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_betweennetwork_admins_name
  ON betweennetwork_admins(name);

CREATE INDEX IF NOT EXISTS idx_betweennetwork_admin_sessions_admin_id
  ON betweennetwork_admin_sessions(admin_id);

CREATE INDEX IF NOT EXISTS idx_betweennetwork_admin_sessions_expires_at
  ON betweennetwork_admin_sessions(expires_at);
