-- Add face recognition biometric column for superadmin authentication
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_descriptor JSONB;

-- Add index for biometric lookups
CREATE INDEX IF NOT EXISTS idx_users_face_descriptor ON users(id) WHERE face_descriptor IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN users.face_descriptor IS 'Stores facial recognition descriptor as JSON array for biometric authentication';
