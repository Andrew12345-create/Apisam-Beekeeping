-- Migration: update admin email
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM users WHERE email = 'andrewmunamwangi@gmail.com') THEN
		IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'andrew.lillux@gmail.com') THEN
			UPDATE users
			SET email = 'andrew.lillux@gmail.com'
			WHERE email = 'andrewmunamwangi@gmail.com';
		ELSE
			-- Target email already exists; skip to avoid unique constraint violation
			RAISE NOTICE 'Skipping admin email update: target email already exists';
		END IF;
	END IF;
END$$;
