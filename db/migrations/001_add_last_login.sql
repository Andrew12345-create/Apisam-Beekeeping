DO $$
BEGIN
	IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
		ALTER TABLE users
		ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
	END IF;
END$$;

-- Optional: set existing values to NULL (no-op) or to a specific timestamp
-- UPDATE users SET last_login = NULL WHERE last_login IS NULL;
