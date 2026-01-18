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
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('No database connection string found. Please check your .env file.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

// Test database connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
    console.error('Please check your database connection string in .env file');
  } else {
    console.log('Database connected successfully');
    release();
  }
});

// Middleware
app.use(cors());
app.use(express.json({
  verify: (req, res, buf) => {
    try {
      if (buf.length) {
        JSON.parse(buf.toString());
      }
    } catch (e) {
      console.error('Invalid JSON received:', buf.toString());
      throw new Error('Invalid JSON format');
    }
  }
}));
app.use(express.static(path.join(__dirname)));

// Error handling middleware for JSON parsing
app.use((err, req, res, next) => {
  if (err.message === 'Invalid JSON format' || (err instanceof SyntaxError && err.status === 400 && 'body' in err)) {
    console.error('JSON parsing error:', err.message);
    return res.status(400).json({
      message: 'Invalid JSON format in request body',
      error: 'Please ensure your request body contains valid JSON'
    });
  }
  next(err);
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Rate limiting for login attempts
const loginAttempts = new Map();
const adminAttempts = new Map();
const superAdminAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 3;
const MAX_ADMIN_ATTEMPTS = 2;
const MAX_SUPER_ADMIN_ATTEMPTS = 1;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
const ADMIN_LOCKOUT_TIME = 30 * 60 * 1000; // 30 minutes
const SUPER_ADMIN_LOCKOUT_TIME = 60 * 60 * 1000; // 1 hour

// Admin session tracking
const adminSessions = new Map();
const ADMIN_SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const SUPER_ADMIN_SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes for super admin

// Password verification attempts
const passwordVerificationAttempts = new Map();
const MAX_PASSWORD_VERIFICATION_ATTEMPTS = 2;
const PASSWORD_VERIFICATION_LOCKOUT = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip, type = 'login') {
  let attempts, maxAttempts, lockoutTime;
  
  switch (type) {
    case 'admin':
      attempts = adminAttempts.get(ip) || { count: 0, lastAttempt: 0 };
      maxAttempts = MAX_ADMIN_ATTEMPTS;
      lockoutTime = ADMIN_LOCKOUT_TIME;
      break;
    case 'superadmin':
      attempts = superAdminAttempts.get(ip) || { count: 0, lastAttempt: 0 };
      maxAttempts = MAX_SUPER_ADMIN_ATTEMPTS;
      lockoutTime = SUPER_ADMIN_LOCKOUT_TIME;
      break;
    case 'password':
      attempts = passwordVerificationAttempts.get(ip) || { count: 0, lastAttempt: 0 };
      maxAttempts = MAX_PASSWORD_VERIFICATION_ATTEMPTS;
      lockoutTime = PASSWORD_VERIFICATION_LOCKOUT;
      break;
    default:
      attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
      maxAttempts = MAX_LOGIN_ATTEMPTS;
      lockoutTime = LOCKOUT_TIME;
  }
  
  const now = Date.now();
  
  if (attempts.count >= maxAttempts && (now - attempts.lastAttempt) < lockoutTime) {
    return false;
  }
  
  if ((now - attempts.lastAttempt) > lockoutTime) {
    attempts.count = 0;
  }
  
  return true;
}

function recordFailedAttempt(ip, type = 'login') {
  let attemptsMap;
  
  switch (type) {
    case 'admin':
      attemptsMap = adminAttempts;
      break;
    case 'superadmin':
      attemptsMap = superAdminAttempts;
      break;
    case 'password':
      attemptsMap = passwordVerificationAttempts;
      break;
    default:
      attemptsMap = loginAttempts;
  }
  
  const attempts = attemptsMap.get(ip) || { count: 0, lastAttempt: 0 };
  attempts.count++;
  attempts.lastAttempt = Date.now();
  attemptsMap.set(ip, attempts);
}

function clearAttempts(ip, type = 'login') {
  switch (type) {
    case 'admin':
      adminAttempts.delete(ip);
      break;
    case 'superadmin':
      superAdminAttempts.delete(ip);
      break;
    case 'password':
      passwordVerificationAttempts.delete(ip);
      break;
    default:
      loginAttempts.delete(ip);
  }
}

// Admin session management
function createAdminSession(userId, isSuperAdmin = false) {
  const sessionId = require('crypto').randomBytes(32).toString('hex');
  const timeout = isSuperAdmin ? SUPER_ADMIN_SESSION_TIMEOUT : ADMIN_SESSION_TIMEOUT;
  const session = {
    userId,
    isSuperAdmin,
    createdAt: Date.now(),
    expiresAt: Date.now() + timeout,
    lastActivity: Date.now()
  };
  adminSessions.set(sessionId, session);
  return sessionId;
}

function validateAdminSession(sessionId) {
  const session = adminSessions.get(sessionId);
  if (!session) return null;
  
  if (Date.now() > session.expiresAt) {
    adminSessions.delete(sessionId);
    return null;
  }
  
  // Update last activity
  session.lastActivity = Date.now();
  return session;
}

function extendAdminSession(sessionId) {
  const session = adminSessions.get(sessionId);
  if (!session) return false;
  
  const timeout = session.isSuperAdmin ? SUPER_ADMIN_SESSION_TIMEOUT : ADMIN_SESSION_TIMEOUT;
  session.expiresAt = Date.now() + timeout;
  session.lastActivity = Date.now();
  return true;
}

function revokeAdminSession(sessionId) {
  return adminSessions.delete(sessionId);
}

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
  const clientIP = req.ip || req.connection.remoteAddress;
  
  console.log('Login attempt from:', clientIP, 'Body:', req.body);
  
  if (!checkRateLimit(clientIP)) {
    return res.status(429).json({ message: 'Too many login attempts. Try again in 15 minutes.' });
  }
  
  try {
    const email = String(req.body?.email || '').trim();
    const password = req.body?.password || '';
    
    console.log('Attempting login for email:', email);

    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    console.log('Database query result:', result.rows.length, 'users found');
    
    if (result.rows.length === 0) {
      recordFailedAttempt(clientIP);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    console.log('User found:', user.email, 'Banned:', user.is_banned);

    if (user.is_banned) {
      const banMessage = user.ban_reason || 'Your account has been banned.';
      return res.status(403).json({ message: banMessage, banned: true });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      recordFailedAttempt(clientIP);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    loginAttempts.delete(clientIP);
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign({ id: user.id, email: user.email, isAdmin: user.is_admin }, JWT_SECRET, { expiresIn: '1h' });
    console.log('Login successful for:', user.email);
    
    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, isAdmin: user.is_admin, lastLogin: new Date().toISOString() }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
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
  const clientIP = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  
  if (!checkRateLimit(clientIP, 'admin')) {
    return res.status(429).json({ 
      message: 'Too many admin authentication attempts. Try again in 30 minutes.',
      lockoutTime: 30
    });
  }
  
  try {
    const { email, password, isSuperAdmin = false } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND is_admin = true', [email]);
    if (result.rows.length === 0) {
      recordFailedAttempt(clientIP, 'admin');
      // Log suspicious activity
      console.warn(`Failed admin login attempt from IP: ${clientIP}, User-Agent: ${userAgent}, Email: ${email}`);
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    const user = result.rows[0];
    
    // Check if user is banned
    if (user.is_banned) {
      const banMessage = user.ban_reason || 'Your account has been banned.';
      return res.status(403).json({ message: banMessage, banned: true });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      recordFailedAttempt(clientIP, 'admin');
      console.warn(`Failed admin password attempt from IP: ${clientIP}, User-Agent: ${userAgent}, Email: ${email}`);
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }
    
    // If claiming super admin, verify it
    if (isSuperAdmin && !user.is_super_admin) {
      recordFailedAttempt(clientIP, 'superadmin');
      console.error(`FALSE SUPER ADMIN CLAIM from IP: ${clientIP}, User-Agent: ${userAgent}, Email: ${email}`);
      
      // Auto-ban for 24 hours for false super admin claims
      const banUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await pool.query('UPDATE users SET is_banned = true, ban_until = $1, ban_reason = $2 WHERE id = $3', 
        [banUntil, 'False super admin claim - 24 hour ban', user.id]);
      
      return res.status(403).json({ 
        message: 'False super admin claim detected. Account banned for 24 hours.',
        banned: true
      });
    }

    clearAttempts(clientIP, 'admin');
    
    // Create admin session
    const sessionId = createAdminSession(user.id, user.is_super_admin);
    
    // Log successful admin authentication
    console.log(`Admin authenticated: ${email} (${user.is_super_admin ? 'Super Admin' : 'Admin'}) from IP: ${clientIP}`);
    
    res.json({ 
      message: 'Admin authenticated successfully',
      sessionId,
      isSuperAdmin: user.is_super_admin,
      sessionTimeout: user.is_super_admin ? 5 : 10 // minutes
    });
  } catch (err) {
    console.error('Admin auth error:', err);
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
  const clientIP = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  
  if (!checkRateLimit(clientIP, 'password')) {
    return res.status(429).json({ 
      message: 'Too many password verification attempts. Try again in 1 hour.',
      lockoutTime: 60
    });
  }
  
  try {
    const { password, sessionId } = req.body;
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }
    
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }
    
    // Validate admin session
    const session = validateAdminSession(sessionId);
    if (!session) {
      return res.status(401).json({ message: 'Invalid or expired admin session' });
    }

    // Get the current user's password
    const result = await pool.query('SELECT password, is_super_admin FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      recordFailedAttempt(clientIP, 'password');
      console.warn(`Failed password verification from IP: ${clientIP}, User-Agent: ${userAgent}, User ID: ${req.user.id}`);
      return res.status(401).json({ message: 'Invalid password' });
    }
    
    // Additional security: verify user is actually super admin
    if (!user.is_super_admin) {
      console.error(`Non-super admin attempting password verification: ${req.user.email} from IP: ${clientIP}`);
      return res.status(403).json({ message: 'Access denied - insufficient privileges' });
    }
    
    clearAttempts(clientIP, 'password');
    
    // Extend admin session on successful verification
    extendAdminSession(sessionId);
    
    console.log(`Password verified for super admin: ${req.user.email} from IP: ${clientIP}`);
    
    res.json({ 
      message: 'Password verified successfully',
      sessionExtended: true
    });
  } catch (error) {
    console.error('Verify password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admin/verify-super-admin', authenticateToken, async (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  
  if (!checkRateLimit(clientIP, 'superadmin')) {
    return res.status(429).json({ 
      message: 'Too many super admin verification attempts. Try again in 1 hour.',
      lockoutTime: 60
    });
  }
  
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }
    
    // Validate admin session
    const session = validateAdminSession(sessionId);
    if (!session) {
      recordFailedAttempt(clientIP, 'superadmin');
      return res.status(401).json({ message: 'Invalid or expired admin session' });
    }
    
    const result = await pool.query('SELECT is_super_admin, email FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      recordFailedAttempt(clientIP, 'superadmin');
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];
    
    if (!user.is_super_admin) {
      recordFailedAttempt(clientIP, 'superadmin');
      console.warn(`Non-super admin verification attempt: ${user.email} from IP: ${clientIP}, User-Agent: ${userAgent}`);
      
      // Ban for 24 hours for false super admin verification attempts
      const banUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await pool.query('UPDATE users SET is_banned = true, ban_until = $1, ban_reason = $2 WHERE id = $3', 
        [banUntil, 'False super admin verification attempt - 24 hour ban', user.id]);
      
      return res.status(403).json({ 
        message: 'Access denied - insufficient privileges. Account banned for 24 hours.',
        banned: true
      });
    }
    
    clearAttempts(clientIP, 'superadmin');
    
    console.log(`Super admin verified: ${user.email} from IP: ${clientIP}`);
    
    res.json({
      isSuperAdmin: true,
      message: 'Super admin access confirmed',
      sessionValid: true
    });
  } catch (error) {
    console.error('Verify super admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admin/create-admin', authenticateToken, async (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  
  try {
    // Verify super admin status from database
    const superAdminCheck = await pool.query('SELECT is_super_admin FROM users WHERE id = $1', [req.user.id]);
    if (!superAdminCheck.rows[0]?.is_super_admin) {
      console.warn(`Non-super admin attempted to create admin: ${req.user.email} from IP: ${clientIP}`);
      return res.status(403).json({ message: 'Super admin access required' });
    }

    const { name, email, password, permissions, sessionId } = req.body;
    
    // Validate admin session
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }
    
    const session = validateAdminSession(sessionId);
    if (!session || !session.isSuperAdmin) {
      return res.status(401).json({ message: 'Invalid or expired super admin session' });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const emailCheck = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12); // Increased salt rounds
    const result = await pool.query(
      'INSERT INTO users (name, email, password, is_admin, permissions, last_login) VALUES ($1, $2, $3, true, $4, NOW()) RETURNING id, name, email',
      [name, email, hashedPassword, JSON.stringify(permissions || [])]
    );
    
    console.log(`New admin created by ${req.user.email}: ${email} from IP: ${clientIP}`);

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

// M-Pesa Payment Endpoint
app.post('/api/mpesa/stkpush', async (req, res) => {
  try {
    const { phoneNumber, amount, accountReference, transactionDesc } = req.body;

    if (!phoneNumber || !amount) {
      return res.status(400).json({ message: 'Phone number and amount are required' });
    }

    // Format phone number (ensure it starts with 254)
    let formattedPhone = phoneNumber.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith('254')) {
      formattedPhone = '254' + formattedPhone;
    }

    const stkPushResponse = await daraja.stkPush({
      phoneNumber: formattedPhone,
      amount: parseInt(amount),
      accountReference: accountReference || 'Apisam Beekeeping',
      transactionDesc: transactionDesc || 'Payment for order'
    });

    res.json({
      message: 'STK Push sent successfully',
      response: stkPushResponse
    });
  } catch (error) {
    console.error('M-Pesa STK Push error:', error);
    res.status(500).json({ message: 'Payment initiation failed', error: error.message });
  }
});

// M-Pesa Callback Endpoint
app.post('/api/mpesa/callback', (req, res) => {
  try {
    const callbackData = req.body;
    console.log('M-Pesa Callback:', JSON.stringify(callbackData, null, 2));

    // Process the callback data here
    // You would typically update order status, send notifications, etc.

    res.json({ message: 'Callback received successfully' });
  } catch (error) {
    console.error('M-Pesa Callback error:', error);
    res.status(500).json({ message: 'Callback processing failed' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
// Additional security endpoints
app.post('/api/admin/revoke-session', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }
    
    const revoked = revokeAdminSession(sessionId);
    if (revoked) {
      console.log(`Admin session revoked for user: ${req.user.email}`);
      res.json({ message: 'Session revoked successfully' });
    } else {
      res.status(404).json({ message: 'Session not found' });
    }
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/session-status', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }
    
    const session = validateAdminSession(sessionId);
    if (!session) {
      return res.status(401).json({ message: 'Invalid or expired session' });
    }
    
    const timeRemaining = session.expiresAt - Date.now();
    const minutesRemaining = Math.floor(timeRemaining / 60000);
    const secondsRemaining = Math.floor((timeRemaining % 60000) / 1000);
    
    res.json({
      valid: true,
      timeRemaining,
      minutesRemaining,
      secondsRemaining,
      isSuperAdmin: session.isSuperAdmin
    });
  } catch (error) {
    console.error('Session status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admin/extend-session', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }
    
    const extended = extendAdminSession(sessionId);
    if (extended) {
      res.json({ message: 'Session extended successfully' });
    } else {
      res.status(404).json({ message: 'Session not found or expired' });
    }
  } catch (error) {
    console.error('Extend session error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Security audit endpoint (super admin only)
app.get('/api/admin/security-audit', authenticateToken, async (req, res) => {
  try {
    // Verify super admin
    const result = await pool.query('SELECT is_super_admin FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows[0]?.is_super_admin) {
      return res.status(403).json({ message: 'Super admin access required' });
    }
    
    const auditData = {
      activeAdminSessions: adminSessions.size,
      loginAttempts: {
        regular: loginAttempts.size,
        admin: adminAttempts.size,
        superAdmin: superAdminAttempts.size,
        passwordVerification: passwordVerificationAttempts.size
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(auditData);
  } catch (error) {
    console.error('Security audit error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});