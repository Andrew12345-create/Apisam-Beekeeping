-- Add admin management columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_by INTEGER REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT;

-- Set main admin as super admin
UPDATE users SET is_super_admin = TRUE WHERE email = 'andrewmunamwangi@gmail.com';

-- Create admin_actions table for audit trail
CREATE TABLE IF NOT EXISTS admin_actions (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES users(id),
    target_user_id INTEGER REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);