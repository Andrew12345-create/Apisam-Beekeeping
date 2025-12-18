require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3001;

// PostgreSQL connection (prefer env var `DATABASE_URL`)
const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_i4RhG3FWHmev@ep-withered-wildflower-aelni316-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
  connectionString,
  // If your provider requires SSL config, uncomment and adjust below
  // ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(cors());
app.use(express.json());

// JWT secret (in production, set via environment variable `JWT_SECRET`)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Routes
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update last_login and get its value
    let lastLogin = null;
    try {
      const upd = await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1 RETURNING last_login', [user.id]);
      lastLogin = upd.rows[0]?.last_login || null;
    } catch (uErr) {
      console.error('Failed to update last_login:', uErr);
    }

    const token = jwt.sign({ id: user.id, email: user.email, isAdmin: user.is_admin }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, isAdmin: user.is_admin, lastLogin }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user with last_login set, make admin if specific main admin email
    const isAdmin = email === 'andrewmunamwangi@gmail.com';
    const result = await pool.query(
      'INSERT INTO users (name, email, password, is_admin, last_login) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING id, name, email, is_admin, last_login',
      [name, email, hashedPassword, isAdmin]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, isAdmin: user.is_admin }, JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: { id: user.id, name: user.name, email: user.email, isAdmin: user.is_admin, lastLogin: user.last_login }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query('SELECT id, name, email, is_admin, last_login FROM users WHERE id = $1', [decoded.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const u = result.rows[0];
    res.json({ user: { id: u.id, name: u.name, email: u.email, isAdmin: u.is_admin, lastLogin: u.last_login } });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Admin: list users (requires admin token)
app.get('/api/admin/users', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET);

    // Check admin status from database
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [decoded.id]);
    if (!adminCheck.rows[0] || !adminCheck.rows[0].is_admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const result = await pool.query('SELECT id, name, email, is_admin, last_login FROM users ORDER BY id');
    res.json({ users: result.rows });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: update user (e.g., toggle is_admin)
app.put('/api/admin/users/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET);

    // Check admin status from database
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [decoded.id]);
    if (!adminCheck.rows[0] || !adminCheck.rows[0].is_admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const userId = parseInt(req.params.id, 10);
    const { isAdmin } = req.body;
    if (typeof isAdmin !== 'boolean') return res.status(400).json({ message: 'Invalid payload' });

    await pool.query('UPDATE users SET is_admin = $1 WHERE id = $2', [isAdmin, userId]);
    const result = await pool.query('SELECT id, name, email, is_admin, last_login FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Admin update user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { name, email } = req.body;

    await pool.query('UPDATE users SET name = $1, email = $2 WHERE id = $3', [name, email, decoded.id]);

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Run migrations
async function runMigrations() {
  try {
    const fs = require('fs');
    const path = require('path');

    const migrationPath = path.join(__dirname, 'db', 'migrations', '000_create_users_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    await pool.query(migrationSQL);
    console.log('Migrations run successfully');
  } catch (err) {
    console.error('Migration error:', err);
  }
}

// Start server after verifying DB connectivity
async function startServer() {
  try {
    // Quick DB smoke test
    await pool.query('SELECT 1');

    // Run migrations
    await runMigrations();

    // Ensure main admin exists (promote existing user or create a seeded admin)
    try {
      const mainEmail = 'andrewmunamwangi@gmail.com';
      const upd = await pool.query('UPDATE users SET is_admin = TRUE WHERE email = $1 RETURNING id', [mainEmail]);
      if (upd.rowCount === 0) {
        // If the user doesn't exist, create a seeded admin with a random password
        const randomPwd = Math.random().toString(36).slice(2, 10);
        const hashed = await bcrypt.hash(randomPwd, 10);
        await pool.query('INSERT INTO users (name, email, password, is_admin, last_login) VALUES ($1, $2, $3, TRUE, CURRENT_TIMESTAMP)', ['Main Admin', mainEmail, hashed]);
        console.log(`Seeded main admin account for ${mainEmail}`);
      } else {
        console.log(`Promoted existing user ${mainEmail} to main admin`);
      }
    } catch (adminErr) {
      console.error('Failed to ensure main admin:', adminErr);
    }

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (err) {
    console.error('Failed to connect to the database. Server not started.');
    console.error(err);
    process.exit(1);
  }
}

startServer();
