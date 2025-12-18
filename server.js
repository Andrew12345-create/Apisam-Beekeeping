require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;

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
// Serve static files (so admin.html, style.css, script.js are available)
app.use(express.static(path.join(__dirname)));

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

    // Check if user is banned
    if (user.is_banned) {
      if (user.ban_until) {
        const banUntil = new Date(user.ban_until);
        if (banUntil > new Date()) {
          return res.status(403).json({ 
            message: `Your account is temporarily banned until ${banUntil.toLocaleString()}. Reason: ${user.ban_reason || 'No reason provided'}` 
          });
        } else {
          // Ban expired, unban user
          await pool.query('UPDATE users SET is_banned = FALSE, ban_until = NULL, banned_by = NULL, ban_reason = NULL WHERE id = $1', [user.id]);
        }
      } else {
        return res.status(403).json({ 
          message: `Your account has been permanently banned. Reason: ${user.ban_reason || 'No reason provided'}` 
        });
      }
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
    const result = await pool.query('SELECT id, name, email, is_admin, last_login, is_banned, ban_until, ban_reason FROM users WHERE id = $1', [decoded.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const u = result.rows[0];
    
    // Check if user is banned
    if (u.is_banned) {
      if (u.ban_until) {
        const banUntil = new Date(u.ban_until);
        if (banUntil > new Date()) {
          return res.status(403).json({ 
            message: `Your account is temporarily banned until ${banUntil.toLocaleString()}. Reason: ${u.ban_reason || 'No reason provided'}`,
            banned: true
          });
        } else {
          // Ban expired, unban user
          await pool.query('UPDATE users SET is_banned = FALSE, ban_until = NULL, banned_by = NULL, ban_reason = NULL WHERE id = $1', [u.id]);
        }
      } else {
        return res.status(403).json({ 
          message: `Your account has been permanently banned. Reason: ${u.ban_reason || 'No reason provided'}`,
          banned: true
        });
      }
    }

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

    // Check admin status and ban status from database
    const adminCheck = await pool.query('SELECT is_admin, is_super_admin, is_banned, ban_until FROM users WHERE id = $1', [decoded.id]);
    const user = adminCheck.rows[0];
    if (!user || !user.is_admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    // Check if admin is banned
    if (user.is_banned) {
      if (user.ban_until && new Date(user.ban_until) <= new Date()) {
        await pool.query('UPDATE users SET is_banned = FALSE, ban_until = NULL, banned_by = NULL, ban_reason = NULL WHERE id = $1', [decoded.id]);
      } else {
        return res.status(403).json({ message: 'Access denied - account banned' });
      }
    }

    const result = await pool.query(`
      SELECT id, name, email, is_admin, is_super_admin, is_banned, ban_until, 
             ban_reason, permissions, last_login, banned_by,
             (SELECT name FROM users u2 WHERE u2.id = users.banned_by) as banned_by_name
      FROM users ORDER BY id
    `);
    
    res.json({ 
      users: result.rows,
      currentUser: { isSuperAdmin: adminCheck.rows[0].is_super_admin }
    });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: create new admin (super admin only)
app.post('/api/admin/create-admin', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const adminCheck = await pool.query('SELECT is_super_admin FROM users WHERE id = $1', [decoded.id]);
    if (!adminCheck.rows[0]?.is_super_admin) {
      return res.status(403).json({ message: 'Super admin access required' });
    }

    const { name, email, password, permissions } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (name, email, password, is_admin, permissions, created_by) VALUES ($1, $2, $3, TRUE, $4, $5) RETURNING id, name, email, is_admin, permissions',
      [name, email, hashedPassword, permissions || [], decoded.id]
    );

    await pool.query('INSERT INTO admin_actions (admin_id, target_user_id, action, details) VALUES ($1, $2, $3, $4)',
      [decoded.id, result.rows[0].id, 'CREATE_ADMIN', { permissions }]);

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Create admin error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: ban user
app.post('/api/admin/ban/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const adminCheck = await pool.query('SELECT is_admin, is_super_admin FROM users WHERE id = $1', [decoded.id]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const userId = parseInt(req.params.id, 10);
    const { duration, reason } = req.body;
    const banUntil = duration ? new Date(Date.now() + duration * 60000) : null;

    await pool.query('UPDATE users SET is_banned = TRUE, ban_until = $1, banned_by = $2, ban_reason = $3 WHERE id = $4',
      [banUntil, decoded.id, reason, userId]);

    await pool.query('INSERT INTO admin_actions (admin_id, target_user_id, action, details) VALUES ($1, $2, $3, $4)',
      [decoded.id, userId, 'BAN_USER', { duration, reason, banUntil }]);

    res.json({ message: 'User banned successfully' });
  } catch (err) {
    console.error('Ban user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: unban user
app.post('/api/admin/unban/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [decoded.id]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const userId = parseInt(req.params.id, 10);
    await pool.query('UPDATE users SET is_banned = FALSE, ban_until = NULL, banned_by = NULL, ban_reason = NULL WHERE id = $1', [userId]);

    await pool.query('INSERT INTO admin_actions (admin_id, target_user_id, action) VALUES ($1, $2, $3)',
      [decoded.id, userId, 'UNBAN_USER']);

    res.json({ message: 'User unbanned successfully' });
  } catch (err) {
    console.error('Unban user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: set permissions
app.put('/api/admin/permissions/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const adminCheck = await pool.query('SELECT is_super_admin FROM users WHERE id = $1', [decoded.id]);
    if (!adminCheck.rows[0]?.is_super_admin) {
      return res.status(403).json({ message: 'Super admin access required' });
    }

    const userId = parseInt(req.params.id, 10);
    const { permissions } = req.body;

    await pool.query('UPDATE users SET permissions = $1 WHERE id = $2', [permissions, userId]);

    await pool.query('INSERT INTO admin_actions (admin_id, target_user_id, action, details) VALUES ($1, $2, $3, $4)',
      [decoded.id, userId, 'UPDATE_PERMISSIONS', { permissions }]);

    res.json({ message: 'Permissions updated successfully' });
  } catch (err) {
    console.error('Update permissions error:', err);
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

    const migrationsDir = path.join(__dirname, 'db', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).sort();
    
    for (const file of migrationFiles) {
      if (file.endsWith('.sql')) {
        const migrationSQL = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await pool.query(migrationSQL);
        console.log(`Migration ${file} completed`);
      }
    }
    console.log('All migrations run successfully');
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
