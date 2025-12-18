require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Use DATABASE_URL if present, otherwise fall back to same default as server.js
const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_i4RhG3FWHmev@ep-withered-wildflower-aelni316-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({ connectionString });

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found, exiting.');
    process.exit(0);
  }

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    console.log('Running migration:', file);
    const sql = fs.readFileSync(fullPath, 'utf8');
    try {
      await pool.query(sql);
      console.log('Applied:', file);
    } catch (err) {
      console.error('Failed migration', file, err.message || err);
      await pool.end();
      process.exit(1);
    }
  }

  await pool.end();
  console.log('All migrations applied successfully.');
}

runMigrations().catch(err => {
  console.error('Migration runner error:', err);
  process.exit(1);
});
