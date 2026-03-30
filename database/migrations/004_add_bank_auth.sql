-- Add auth columns to bank_applications
ALTER TABLE bank_applications 
ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
