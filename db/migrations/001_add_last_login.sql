-- Migration: Add last_login column to users table if it doesn't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- Optional: set existing values to NULL (no-op) or to a specific timestamp
-- UPDATE users SET last_login = NULL WHERE last_login IS NULL;
