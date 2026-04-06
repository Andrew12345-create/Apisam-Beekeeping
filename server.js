require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const db = require('./db/db');

const app = express();
const port = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
  console.error('No database connection string found. Please check your .env file.');
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === 'production' || process.env.URL;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
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
app.use(express.json());

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

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET environment variable is required. Please check your .env file.');
  process.exit(1);
}

// Rate limiting for login attempts
const loginAttempts = new Map();
const adminAttempts = new Map();
const superAdminAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 3;
const MAX_ADMIN_ATTEMPTS = 2;
const MAX_SUPER_ADMIN_ATTEMPTS = 1;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
const ADMIN_LOCKOUT_TIME = 30 * 60 * 1000; // 30 minutes
const SUPER_ADMIN_LOCKOUT_TIME = 24 * 60 * 60 * 1000; // 24 hours - increased for super admin

// Admin session tracking
const adminSessions = new Map();
const ADMIN_SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const SUPER_ADMIN_SESSION_TIMEOUT = 2 * 60 * 1000; // 2 minutes for super admin - reduced for security

// Password verification attempts
const passwordVerificationAttempts = new Map();
const MAX_PASSWORD_VERIFICATION_ATTEMPTS = 2;
const PASSWORD_VERIFICATION_LOCKOUT = 60 * 60 * 1000; // 1 hour

// Super admin security enhancements
const SUPER_ADMIN_WHITELIST_IPS = process.env.SUPER_ADMIN_WHITELIST_IPS ?
  process.env.SUPER_ADMIN_WHITELIST_IPS.split(',') : [];
const SUPER_ADMIN_ALLOWED_HOURS = { start: 9, end: 17 }; // 9 AM to 5 PM only
const SUPER_ADMIN_MAX_SESSIONS_PER_USER = 1; // Only one active session per super admin
const SUPER_ADMIN_EMERGENCY_LOCKDOWN = { active: false, activatedBy: null, activatedAt: null };

// Super admin account-based rate limiting
const superAdminAccountAttempts = new Map();
const MAX_SUPER_ADMIN_ACCOUNT_ATTEMPTS = 3;
const SUPER_ADMIN_ACCOUNT_LOCKOUT = 24 * 60 * 60 * 1000; // 24 hours

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

function recordFailedAttempt(ip, type = 'login', userId = null) {
  let attemptsMap;

  switch (type) {
    case 'admin':
      attemptsMap = adminAttempts;
      break;
    case 'superadmin':
      attemptsMap = superAdminAttempts;
      // Also record account-based attempt for super admin
      if (userId) {
        const accountAttempts = superAdminAccountAttempts.get(userId) || { count: 0, lastAttempt: 0 };
        accountAttempts.count++;
        accountAttempts.lastAttempt = Date.now();
        superAdminAccountAttempts.set(userId, accountAttempts);
        console.error(`SUPER ADMIN ACCOUNT ATTEMPT RECORDED: User ${userId}, attempt ${accountAttempts.count}/${MAX_SUPER_ADMIN_ACCOUNT_ATTEMPTS}`);
      }
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

// Get face biometric enrollment status for profile
app.get('/api/profile/biometric-status', authenticateToken, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const result = await pool.query(
      'SELECT face_descriptor FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = result.rows[0];
    const enrolled = user.face_descriptor !== null && user.face_descriptor !== undefined;
    
    res.json({
      enrolled,
      enrolledAt: enrolled ? new Date() : null
    });
  } catch (error) {
    console.error('Biometric status check error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Enroll face biometric for user profile
app.post('/api/profile/enroll-face', authenticateToken, async (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  
  try {
    const { faceDescriptor } = req.body;
    
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
      return res.status(400).json({ message: 'Invalid face descriptor. Must be array of 128 values.' });
    }
    
    // Save the face descriptor for the user
    try {
      await pool.query(
        'UPDATE users SET face_descriptor = $1 WHERE id = $2',
        [JSON.stringify(faceDescriptor), req.user.id]
      );
      
      console.log(`Face biometric enrolled for user: ${req.user.email} from IP: ${clientIP}`);
      
      res.json({
        message: 'Face saved successfully',
        enrolled: true
      });
    } catch (updateErr) {
      console.error('Face enrollment update error:', updateErr);
      return res.status(500).json({ message: 'Failed to save face descriptor' });
    }
  } catch (error) {
    console.error('Enroll face error:', error);
    res.status(500).json({ message: 'Server error during face enrollment' });
  }
});

// Verify face biometric for user profile
app.post('/api/profile/verify-face', authenticateToken, async (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  
  try {
    const { faceDescriptor } = req.body;
    
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
      return res.status(400).json({ message: 'Invalid face descriptor. Must be array of 128 values.' });
    }
    
    // Get the user's stored face descriptor
    const result = await pool.query(
      'SELECT face_descriptor FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = result.rows[0];
    
    // Check if user has enrolled face descriptor
    if (!user.face_descriptor) {
      return res.status(400).json({ message: 'No face biometric enrolled for this account' });
    }
    
    // Verify face by computing similarity between stored and current descriptor
    const storedDescriptor = user.face_descriptor;
    const similarity = computeFaceSimilarity(storedDescriptor, faceDescriptor);
    const FACE_MATCH_THRESHOLD = 0.6; // 60% similarity threshold
    
    if (similarity < FACE_MATCH_THRESHOLD) {
      console.warn(
        `Failed face verification from IP: ${clientIP}, User ID: ${req.user.id}, ` +
        `Similarity: ${similarity.toFixed(3)} (threshold: ${FACE_MATCH_THRESHOLD})`
      );
      return res.status(401).json({ 
        message: 'Face verification failed. Face does not match enrolled biometric.',
        similarity: similarity.toFixed(3)
      });
    }
    
    // Face verification successful
    console.log(
      `Face verified successfully for user: ${req.user.email} from IP: ${clientIP}, ` +
      `Similarity: ${similarity.toFixed(3)}`
    );
    
    res.json({ 
      message: 'Face verified successfully',
      verified: true,
      similarity: similarity.toFixed(3)
    });
  } catch (error) {
    console.error('Face verification error:', error);
    res.status(500).json({ message: 'Server error during face verification' });
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
    // Verify super admin status from database - double check
    const superAdminCheck = await pool.query('SELECT is_super_admin FROM users WHERE id = $1', [req.user.id]);
    if (!superAdminCheck.rows[0]?.is_super_admin) {
      console.error(`UNAUTHORIZED ADMIN UPDATE ATTEMPT: User ${req.user.email} (ID: ${req.user.id}) attempted to modify admin privileges`);
      return res.status(403).json({ message: 'Super admin access required' });
    }

    const { id } = req.params;
    const { isAdmin } = req.body;

    // Prevent self-demotion
    if (parseInt(id) === req.user.id && !isAdmin) {
      console.error(`SUPER ADMIN SELF-DEMOTION ATTEMPT BLOCKED: User ${req.user.email} (ID: ${req.user.id})`);
      return res.status(403).json({ message: 'Cannot remove super admin privileges from yourself' });
    }

    await pool.query('UPDATE users SET is_admin = $1 WHERE id = $2', [isAdmin, id]);
    console.log(`Super admin ${req.user.email} updated user ${id} admin status to ${isAdmin}`);
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admin/ban/:userId', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin || !req.user.is_super_admin) return res.status(403).json({ message: 'Super admin access required' });

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
    // Verify super admin status from database - double check
    const superAdminCheck = await pool.query('SELECT is_super_admin FROM users WHERE id = $1', [req.user.id]);
    if (!superAdminCheck.rows[0]?.is_super_admin) {
      console.error(`UNAUTHORIZED UNBAN ATTEMPT: User ${req.user.email} (ID: ${req.user.id}) attempted to unban user ${req.params.userId}`);
      return res.status(403).json({ message: 'Super admin access required' });
    }

    const { userId } = req.params;

    await pool.query('UPDATE users SET is_banned = false, ban_until = null, ban_reason = null WHERE id = $1', [userId]);
    console.log(`Super admin ${req.user.email} unbanned user ${userId}`);
    res.json({ message: 'User unbanned successfully' });
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/admin/permissions/:userId', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin || !req.user.is_super_admin) return res.status(403).json({ message: 'Super admin access required' });

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

// Verify biometric (face recognition) for super admin authentication
app.post('/api/admin/verify-biometric', authenticateToken, async (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  
  if (!checkRateLimit(clientIP, 'password')) {
    return res.status(429).json({ 
      message: 'Too many biometric verification attempts. Try again in 1 hour.',
      lockoutTime: 60
    });
  }
  
  try {
    const { biometricType, faceDescriptor, sessionId, adminEmail } = req.body;
    
    if (!biometricType || biometricType !== 'face') {
      return res.status(400).json({ message: 'Invalid biometric type' });
    }
    
    if (!faceDescriptor || !Array.isArray(faceDescriptor)) {
      return res.status(400).json({ message: 'Face descriptor is required' });
    }
    
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }
    
    // Validate admin session
    const session = validateAdminSession(sessionId);
    if (!session) {
      return res.status(401).json({ message: 'Invalid or expired admin session' });
    }

    // Get the current user's stored face descriptor
    const result = await pool.query(
      'SELECT face_descriptor, is_super_admin FROM users WHERE id = $1', 
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = result.rows[0];
    
    // Verify user is actually super admin
    if (!user.is_super_admin) {
      console.error(`Non-super admin attempting biometric verification: ${req.user.email} from IP: ${clientIP}`);
      return res.status(403).json({ message: 'Access denied - insufficient privileges' });
    }
    
    // Check if user has enrolled face descriptor
    if (!user.face_descriptor) {
      // First-time enrollment: store the face descriptor
      try {
        await pool.query(
          'UPDATE users SET face_descriptor = $1 WHERE id = $2',
          [JSON.stringify(faceDescriptor), req.user.id]
        );

        clearAttempts(clientIP, 'password');
        extendAdminSession(sessionId);

        console.log(`Face descriptor enrolled for super admin: ${req.user.email} from IP: ${clientIP}`);

        return res.json({
          message: 'Face enrolled successfully',
          sessionExtended: true,
          enrolled: true
        });
      } catch (enrollErr) {
        console.error('Face enrollment error:', enrollErr);
        return res.status(500).json({ message: 'Failed to enroll face descriptor' });
      }
    }
    
    // Verify face by computing similarity between stored and current descriptor
    const storedDescriptor = user.face_descriptor;
    const similarity = computeFaceSimilarity(storedDescriptor, faceDescriptor);
    const FACE_MATCH_THRESHOLD = 0.6; // Threshold for face matching (0.6 = 60% similarity)
    
    if (similarity < FACE_MATCH_THRESHOLD) {
      recordFailedAttempt(clientIP, 'password');
      console.warn(
        `Failed face recognition verification from IP: ${clientIP}, ` +
        `User-Agent: ${userAgent}, User ID: ${req.user.id}, ` +
        `Similarity: ${similarity.toFixed(3)} (threshold: ${FACE_MATCH_THRESHOLD})`
      );
      return res.status(401).json({ 
        message: 'Face verification failed. Please try again or use password as fallback.',
        similarity: similarity.toFixed(3)
      });
    }
    
    // Face verification successful
    clearAttempts(clientIP, 'password');
    extendAdminSession(sessionId);
    
    console.log(
      `Face verified successfully for super admin: ${req.user.email} from IP: ${clientIP}, ` +
      `Similarity: ${similarity.toFixed(3)}`
    );
    
    res.json({ 
      message: 'Face verified successfully',
      sessionExtended: true,
      similarity: similarity.toFixed(3)
    });
  } catch (error) {
    console.error('Verify biometric error:', error);
    res.status(500).json({ message: 'Server error during biometric verification' });
  }
});

// Helper function to compute similarity between two face descriptors (Euclidean distance)
function computeFaceSimilarity(storedDescriptor, currentDescriptor) {
  try {
    // Parse stored descriptor if it's a string
    const stored = typeof storedDescriptor === 'string' 
      ? JSON.parse(storedDescriptor) 
      : storedDescriptor;
    
    // Ensure both are arrays
    if (!Array.isArray(stored) || !Array.isArray(currentDescriptor)) {
      console.error('Invalid descriptor format');
      return 0;
    }
    
    // Both should have length 128 (face-api descriptor size)
    if (stored.length !== 128 || currentDescriptor.length !== 128) {
      console.error(`Invalid descriptor length: stored=${stored.length}, current=${currentDescriptor.length}`);
      return 0;
    }
    
    // Compute Euclidean distance
    let sumOfSquares = 0;
    for (let i = 0; i < 128; i++) {
      const diff = (stored[i] || 0) - (currentDescriptor[i] || 0);
      sumOfSquares += diff * diff;
    }
    
    const euclideanDistance = Math.sqrt(sumOfSquares);
    
    // Convert distance to similarity score (0-1, where 1 is perfect match)
    // Using formula: similarity = 1 / (1 + distance)
    // Typical face-api distances: same person ~0.4-0.5, different people ~1.0+
    const similarity = 1 / (1 + euclideanDistance);
    
    return similarity;
  } catch (err) {
    console.error('Error computing face similarity:', err);
    return 0;
  }
}

// Get biometric enrollment status
app.get('/api/admin/biometric-status', authenticateToken, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const result = await pool.query(
      'SELECT face_descriptor FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = result.rows[0];
    const enrolled = user.face_descriptor !== null && user.face_descriptor !== undefined;
    
    res.json({
      enrolled,
      enrolledAt: enrolled ? new Date() : null
    });
  } catch (error) {
    console.error('Biometric status check error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Enroll biometric (face recognition) for superadmin
app.post('/api/admin/enroll-biometric', authenticateToken, async (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  
  try {
    const { biometricType, faceDescriptor } = req.body;
    
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (!biometricType || biometricType !== 'face') {
      return res.status(400).json({ message: 'Invalid biometric type' });
    }
    
    if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
      return res.status(400).json({ message: 'Invalid face descriptor. Must be array of 128 values.' });
    }
    
    // Check if user is admin (not necessarily super admin - regular admins can also enroll)
    const userCheck = await pool.query(
      'SELECT is_admin FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (!userCheck.rows[0].is_admin) {
      return res.status(403).json({ message: 'Only admins can enroll biometric authentication' });
    }
    
    // Save the face descriptor
    try {
      await pool.query(
        'UPDATE users SET face_descriptor = $1 WHERE id = $2',
        [JSON.stringify(faceDescriptor), req.user.id]
      );
      
      console.log(`Face biometric enrolled for admin: ${req.user.email} from IP: ${clientIP}`);
      
      res.json({
        message: 'Face biometric enrolled successfully',
        enrolled: true
      });
    } catch (updateErr) {
      console.error('Face enrollment update error:', updateErr);
      return res.status(500).json({ message: 'Failed to save face descriptor' });
    }
  } catch (error) {
    console.error('Enroll biometric error:', error);
    res.status(500).json({ message: 'Server error during biometric enrollment' });
  }
});

app.post('/api/admin/verify-super-admin', authenticateToken, async (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'Unknown';

  try {
    // IMMEDIATELY check if the user is a super admin - bypass ALL rate limiting and validation
    const userCheck = await pool.query('SELECT is_super_admin, email FROM users WHERE id = $1', [req.user.id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userCheck.rows[0];

    // TEMPORARY: Auto-promote to super admin if email contains 'andrew'
    if (!user.is_super_admin && user.email.toLowerCase().includes('andrew')) {
      await pool.query('UPDATE users SET is_super_admin = true, is_admin = true WHERE id = $1', [req.user.id]);
      user.is_super_admin = true;
      user.is_admin = true;
      console.log(`Auto-promoted to super admin: ${user.email}`);
    }

    // If super admin, clear any attempts and proceed without any checks
    if (user.is_super_admin) {
      clearAttempts(clientIP, 'superadmin');

      const { sessionId } = req.body;
      if (!sessionId) {
        return res.status(400).json({ message: 'Session ID is required' });
      }

      // Always validate/create session for super admins
      let session = validateAdminSession(sessionId);
      if (!session) {
        // Create new session for super admin
        const newSessionId = createAdminSession(req.user.id, true);
        console.log(`Super admin session created/renewed: ${user.email} from IP: ${clientIP}`);
        return res.json({
          isSuperAdmin: true,
          message: 'Super admin access confirmed',
          sessionValid: true,
          newSessionId
        });
      }

      console.log(`Super admin verified: ${user.email} from IP: ${clientIP}`);
      return res.json({
        isSuperAdmin: true,
        message: 'Super admin access confirmed',
        sessionValid: true
      });
    }

    // For NON-super admins only: apply rate limiting - NO BYPASS ALLOWED
    if (!checkRateLimit(clientIP, 'superadmin')) {
      return res.status(429).json({ 
        message: 'Too many verification attempts. Try again later.',
        lockoutTime: 60
      });
    }

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

    // Non-super admin trying to verify - this is suspicious
    recordFailedAttempt(clientIP, 'superadmin');
    console.warn(`Non-super admin verification attempt: ${user.email} from IP: ${clientIP}, User-Agent: ${userAgent}`);

    // Ban for 24 hours
    const banUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.query('UPDATE users SET is_banned = true, ban_until = $1, ban_reason = $2 WHERE id = $3',
      [banUntil, 'False super admin verification attempt - 24 hour ban', user.id]);

    return res.status(403).json({
      message: 'Access denied - insufficient privileges. Account banned for 24 hours.',
      banned: true
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
    if (!req.user.isAdmin || !req.user.is_super_admin) return res.status(403).json({ message: 'Super admin access required' });

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
  const clientIP = req.ip || req.connection.remoteAddress;
  const startTime = performance.now();
  const timestamp = new Date().toISOString();
  
  console.log(`[${timestamp}] GET /api/products/full from IP ${clientIP} - Query started`);
  
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY category, name');
    const duration = performance.now() - startTime;
    console.log(`[${timestamp}] GET /api/products/full from IP ${clientIP} - Query completed in ${duration.toFixed(2)}ms - Found ${result.rows.length} products`);
    
    res.json({ products: result.rows });
  } catch (err) {
    const duration = performance.now() - startTime;
    console.error(`[${timestamp}] GET /api/products/full from IP ${clientIP} - ERROR after ${duration.toFixed(2)}ms:`, err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running', timestamp: new Date() });
});

app.get('/api/admin/products', async (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const startTime = performance.now();
  const timestamp = new Date().toISOString();
  
  console.log(`[${timestamp}] GET /api/admin/products from IP ${clientIP} - Query started`);
  
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY category, name');
    const duration = performance.now() - startTime;
    console.log(`[${timestamp}] GET /api/admin/products from IP ${clientIP} - Query completed in ${duration.toFixed(2)}ms - Found ${result.rows.length} products`);
    
    res.json({ products: result.rows });
  } catch (err) {
    const duration = performance.now() - startTime;
    console.error(`[${timestamp}] GET /api/admin/products from IP ${clientIP} - ERROR after ${duration.toFixed(2)}ms:`, err.message);
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

// Temporary endpoint to set super admin (remove after use)
app.post('/api/admin/set-super-admin', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const result = await pool.query('UPDATE users SET is_super_admin = true WHERE LOWER(email) = LOWER($1)', [email]);
    if (result.rowCount > 0) {
      res.json({ message: `User ${email} set as super admin successfully` });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Set super admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Session management endpoints
app.post('/api/admin/revoke-session', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ message: 'Session ID is required' });
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
    if (!sessionId) return res.status(400).json({ message: 'Session ID is required' });
    const session = validateAdminSession(sessionId);
    if (!session) return res.status(401).json({ message: 'Invalid or expired session' });
    const timeRemaining = session.expiresAt - Date.now();
    res.json({
      valid: true,
      timeRemaining,
      minutesRemaining: Math.floor(timeRemaining / 60000),
      secondsRemaining: Math.floor((timeRemaining % 60000) / 1000),
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
    if (!sessionId) return res.status(400).json({ message: 'Session ID is required' });
    const extended = extendAdminSession(sessionId);
    extended ? res.json({ message: 'Session extended successfully' }) : res.status(404).json({ message: 'Session not found or expired' });
  } catch (error) {
    console.error('Extend session error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/security-audit', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT is_super_admin FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows[0]?.is_super_admin) return res.status(403).json({ message: 'Super admin access required' });
    res.json({
      activeAdminSessions: adminSessions.size,
      loginAttempts: { regular: loginAttempts.size, admin: adminAttempts.size, superAdmin: superAdminAttempts.size, passwordVerification: passwordVerificationAttempts.size },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Security audit error:', error);
    res.status(500).json({ message: 'Server error' });
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

// ── Static files (MUST be after all API routes) ──
app.use(express.static(path.join(__dirname)));

// ── Catch-all (MUST be last) ──
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ message: 'API route not found' });
  } else {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

// Add a route to populate the products table with sample data
app.post('/api/admin/populate-products', async (req, res) => {
  try {
    const sampleProducts = [
      { name: 'Honey Jar', category: 'Honey Processing', price: 10.99, stock_quantity: 100 },
      { name: 'Bee Suit', category: 'Protective Equipment', price: 49.99, stock_quantity: 50 },
      { name: 'Hive Tool', category: 'Tools & Equipment', price: 14.99, stock_quantity: 75 }
    ];

    for (const product of sampleProducts) {
      await pool.query(
        'INSERT INTO products (name, category, price, stock_quantity) VALUES ($1, $2, $3, $4)',
        [product.name, product.category, product.price, product.stock_quantity]
      );
    }

    res.status(201).json({ message: 'Sample products added successfully' });
  } catch (error) {
    console.error('Error populating products:', error);
    res.status(500).json({ message: 'Failed to populate products' });
  }
});