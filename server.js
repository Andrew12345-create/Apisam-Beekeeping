require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL connection
const connectionString = process.env.STOCK_DATABASE_URL || process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Routes
app.post('/api/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim();
    const password = req.body?.password || '';

    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update last_login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign({ id: user.id, email: user.email, isAdmin: user.is_admin }, JWT_SECRET, { expiresIn: '24h' });
    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, isAdmin: user.is_admin, lastLogin: new Date().toISOString() }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const emailCheck = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, last_login) VALUES ($1, $2, $3, NOW()) RETURNING id, name, email',
      [name, email, hashedPassword]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, isAdmin: false }, JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: { id: user.id, name: user.name, email: user.email, isAdmin: false, lastLogin: new Date().toISOString() }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, last_login, is_admin FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.is_admin,
        lastLogin: user.last_login
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    await pool.query('UPDATE users SET name = $1, email = $2 WHERE id = $3', [name, email, req.user.id]);
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admin/authenticate', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim();
    const password = req.body?.password || '';

    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (result.rows.length === 0 || !result.rows[0].is_super_admin) {
      return res.status(401).json({ message: 'Invalid credentials or insufficient privileges' });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, isAdmin: user.is_admin, isSuperAdmin: user.is_super_admin }, JWT_SECRET, { expiresIn: '24h' });
    res.json({
      message: 'Super admin authenticated successfully',
      token,
      user: { id: user.id, name: user.name, email: user.email, isAdmin: user.is_admin, isSuperAdmin: user.is_super_admin }
    });
  } catch (err) {
    console.error('Super admin auth error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ message: 'Admin access required' });

    const result = await pool.query(`
      SELECT id, name, email, last_login, is_admin, is_super_admin, is_banned, ban_until, permissions
      FROM users
      ORDER BY name
    `);
    res.json({ users: result.rows, currentUser: req.user });
  } catch (error) {
    console.error('Get admin users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/admin/users/:id', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ message: 'Admin access required' });

    const { id } = req.params;
    const { isAdmin } = req.body;

    await pool.query('UPDATE users SET is_admin = $1 WHERE id = $2', [isAdmin, id]);
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admin/ban/:userId', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ message: 'Admin access required' });

    const { userId } = req.params;
    const { duration, reason } = req.body;

    let banUntil = null;
    if (duration) {
      banUntil = new Date(Date.now() + duration * 60 * 1000); // duration in minutes
    }

    await pool.query('UPDATE users SET is_banned = true, ban_until = $1, ban_reason = $2 WHERE id = $3', [banUntil, reason, userId]);
    res.json({ message: 'User banned successfully' });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admin/unban/:userId', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ message: 'Admin access required' });

    const { userId } = req.params;

    await pool.query('UPDATE users SET is_banned = false, ban_until = null, ban_reason = null WHERE id = $1', [userId]);
    res.json({ message: 'User unbanned successfully' });
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/admin/permissions/:userId', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ message: 'Admin access required' });

    const { userId } = req.params;
    const { permissions } = req.body;

    await pool.query('UPDATE users SET permissions = $1 WHERE id = $2', [JSON.stringify(permissions), userId]);
    res.json({ message: 'Permissions updated successfully' });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admin/verify-password', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    // Check if the password matches any super admin's password
    const result = await pool.query('SELECT password FROM users WHERE is_super_admin = true');
    for (const row of result.rows) {
      const isValidPassword = await bcrypt.compare(password, row.password);
      if (isValidPassword) {
        return res.json({ message: 'Super admin password verified successfully' });
      }
    }

    return res.status(401).json({ message: 'Invalid super admin password' });
  } catch (error) {
    console.error('Verify password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admin/verify-super-admin', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT is_super_admin FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      isSuperAdmin: user.is_super_admin || false,
      message: user.is_super_admin ? 'Super admin access confirmed' : 'Access denied - insufficient privileges'
    });
  } catch (error) {
    console.error('Verify super admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admin/create-admin', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isSuperAdmin) return res.status(403).json({ message: 'Super admin access required' });

    const { name, email, password, permissions } = req.body;

    const emailCheck = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, is_admin, permissions, last_login) VALUES ($1, $2, $3, true, $4, NOW()) RETURNING id, name, email',
      [name, email, hashedPassword, JSON.stringify(permissions || [])]
    );

    res.status(201).json({ message: 'Admin created successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/admin/products/:id/stock', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ message: 'Admin access required' });

    const { id } = req.params;
    const { quantity, reason } = req.body;

    await pool.query('UPDATE products SET stock_quantity = $1 WHERE id = $2', [quantity, id]);
    // Optionally log the stock change reason, but for now just update
    res.json({ message: 'Stock updated successfully' });
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/products/full', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY category, name');
    res.json({ products: result.rows });
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running', timestamp: new Date() });
});

app.get('/api/admin/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY category, name');
    res.json({ products: result.rows });
  } catch (err) {
    console.error('Get admin products error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Temporary migration endpoint
app.post('/api/admin/run-migration', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const migrationPath = path.join(__dirname, 'db', 'migrations', '001_add_admin_fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration...');
    await pool.query(migrationSQL);
    console.log('Migration completed successfully!');
    res.json({ message: 'Migration completed successfully' });
  } catch (error) {
    console.error('Migration failed:', error);
    res.status(500).json({ message: 'Migration failed', error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
