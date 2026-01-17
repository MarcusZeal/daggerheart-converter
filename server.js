const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const DATABASE_PATH = process.env.DATABASE_PATH || './community.db';

// OAuth credentials (Discord only)
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

// Base URL for OAuth callbacks
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Admin user IDs (comma-separated Discord user IDs)
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '').split(',').filter(Boolean);

// ============================================================================
// DATABASE SETUP
// ============================================================================

const Database = require('better-sqlite3');
const db = new Database(DATABASE_PATH);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Initialize database schema
db.exec(`
  -- Users (from OAuth)
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    username TEXT NOT NULL,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_banned INTEGER DEFAULT 0,
    is_admin INTEGER DEFAULT 0,
    UNIQUE(provider, provider_id)
  );

  -- Community conversions
  CREATE TABLE IF NOT EXISTS conversions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    tier TEXT NOT NULL,
    adv_type TEXT NOT NULL,
    source_system TEXT,
    data JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_published INTEGER DEFAULT 1
  );

  -- Votes
  CREATE TABLE IF NOT EXISTS votes (
    user_id TEXT REFERENCES users(id),
    conversion_id TEXT REFERENCES conversions(id),
    vote INTEGER NOT NULL,
    PRIMARY KEY (user_id, conversion_id)
  );

  -- Vote counts (denormalized for performance)
  CREATE TABLE IF NOT EXISTS conversion_stats (
    conversion_id TEXT PRIMARY KEY,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    score INTEGER DEFAULT 0
  );

  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_conversions_user ON conversions(user_id);
  CREATE INDEX IF NOT EXISTS idx_conversions_tier ON conversions(tier);
  CREATE INDEX IF NOT EXISTS idx_conversions_type ON conversions(adv_type);
  CREATE INDEX IF NOT EXISTS idx_conversions_name ON conversions(name);
  CREATE INDEX IF NOT EXISTS idx_stats_score ON conversion_stats(score DESC);
`);

// Migration: Add is_admin column if it doesn't exist
try {
  db.exec(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`);
} catch (e) {
  // Column already exists
}

// Update admin status based on ADMIN_USER_IDS environment variable
if (ADMIN_USER_IDS.length > 0) {
  db.prepare(`UPDATE users SET is_admin = 0`).run();
  const placeholders = ADMIN_USER_IDS.map(() => '?').join(',');
  db.prepare(`UPDATE users SET is_admin = 1 WHERE provider_id IN (${placeholders})`).run(...ADMIN_USER_IDS);
}

console.log('Database initialized at:', DATABASE_PATH);
console.log('Admin user IDs configured:', ADMIN_USER_IDS.length);

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================

const app = express();

// Trust Fly.io proxy for correct client IP detection
app.set('trust proxy', 1);

app.use(express.json());
app.use(cookieParser());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  message: { error: 'Too many requests, please try again later' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts, please try again later' }
});

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

function generateUserId() {
  return 'u_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function generateConversionId() {
  return 'c_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function authenticateToken(req, res, next) {
  const token = req.cookies.auth_token;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);

    if (user && !user.is_banned) {
      req.user = user;
    } else {
      req.user = null;
      res.clearCookie('auth_token');
    }
  } catch (err) {
    req.user = null;
    res.clearCookie('auth_token');
  }

  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function setAuthCookie(res, userId) {
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });
}

// ============================================================================
// OAUTH ROUTES - DISCORD
// ============================================================================

app.get('/auth/discord', authLimiter, (req, res) => {
  if (!DISCORD_CLIENT_ID) {
    return res.status(503).send('Discord OAuth not configured');
  }

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: `${BASE_URL}/auth/discord/callback`,
    response_type: 'code',
    scope: 'identify'
  });

  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

app.get('/auth/discord/callback', authLimiter, async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect('/?error=auth_failed');
  }

  try {
    // Exchange code for token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${BASE_URL}/auth/discord/callback`
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error('Discord token error:', tokenData);
      return res.redirect('/?error=auth_failed');
    }

    // Get user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const discordUser = await userResponse.json();

    // Find or create user
    let user = db.prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?')
      .get('discord', discordUser.id);

    if (!user) {
      const userId = generateUserId();
      const avatarUrl = discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : null;

      db.prepare(`
        INSERT INTO users (id, provider, provider_id, username, avatar_url)
        VALUES (?, ?, ?, ?, ?)
      `).run(userId, 'discord', discordUser.id, discordUser.username, avatarUrl);

      user = { id: userId };
    }

    setAuthCookie(res, user.id);
    res.redirect('/?login=success');

  } catch (err) {
    console.error('Discord OAuth error:', err);
    res.redirect('/?error=auth_failed');
  }
});

// ============================================================================
// AUTH API ROUTES
// ============================================================================

app.post('/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  if (!req.user) {
    return res.json({ user: null });
  }

  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      avatar_url: req.user.avatar_url,
      provider: req.user.provider,
      is_admin: !!req.user.is_admin
    }
  });
});

// ============================================================================
// COMMUNITY API ROUTES
// ============================================================================

// Browse conversions
app.get('/api/community/conversions', apiLimiter, authenticateToken, (req, res) => {
  const {
    search = '',
    tier = '',
    type = '',
    sort = 'popular',
    page = 1,
    limit = 20
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const safeLimit = Math.min(parseInt(limit), 50);

  let whereClause = 'c.is_published = 1';
  const params = [];

  if (search) {
    whereClause += ' AND c.name LIKE ?';
    params.push(`%${search}%`);
  }

  if (tier) {
    whereClause += ' AND c.tier = ?';
    params.push(tier);
  }

  if (type) {
    whereClause += ' AND c.adv_type = ?';
    params.push(type);
  }

  let orderBy = 'cs.score DESC, c.created_at DESC';
  if (sort === 'newest') {
    orderBy = 'c.created_at DESC';
  } else if (sort === 'oldest') {
    orderBy = 'c.created_at ASC';
  }

  const countQuery = db.prepare(`
    SELECT COUNT(*) as total
    FROM conversions c
    LEFT JOIN conversion_stats cs ON c.id = cs.conversion_id
    WHERE ${whereClause}
  `);

  const selectQuery = db.prepare(`
    SELECT
      c.*,
      u.username,
      u.avatar_url,
      COALESCE(cs.upvotes, 0) as upvotes,
      COALESCE(cs.downvotes, 0) as downvotes,
      COALESCE(cs.score, 0) as score
    FROM conversions c
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN conversion_stats cs ON c.id = cs.conversion_id
    WHERE ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `);

  const total = countQuery.get(...params).total;
  const conversions = selectQuery.all(...params, safeLimit, offset);

  // Get user's votes if authenticated
  let userVotes = {};
  if (req.user) {
    const conversionIds = conversions.map(c => c.id);
    if (conversionIds.length > 0) {
      const votesQuery = db.prepare(`
        SELECT conversion_id, vote FROM votes
        WHERE user_id = ? AND conversion_id IN (${conversionIds.map(() => '?').join(',')})
      `);
      const votes = votesQuery.all(req.user.id, ...conversionIds);
      votes.forEach(v => { userVotes[v.conversion_id] = v.vote; });
    }
  }

  res.json({
    conversions: conversions.map(c => ({
      id: c.id,
      name: c.name,
      tier: c.tier,
      advType: c.adv_type,
      sourceSystem: c.source_system,
      data: JSON.parse(c.data),
      createdAt: c.created_at,
      author: {
        username: c.username,
        avatarUrl: c.avatar_url
      },
      upvotes: c.upvotes,
      downvotes: c.downvotes,
      score: c.score,
      userVote: userVotes[c.id] || 0
    })),
    pagination: {
      page: parseInt(page),
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit)
    }
  });
});

// Get single conversion
app.get('/api/community/conversions/:id', apiLimiter, authenticateToken, (req, res) => {
  const conversion = db.prepare(`
    SELECT
      c.*,
      u.username,
      u.avatar_url,
      COALESCE(cs.upvotes, 0) as upvotes,
      COALESCE(cs.downvotes, 0) as downvotes,
      COALESCE(cs.score, 0) as score
    FROM conversions c
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN conversion_stats cs ON c.id = cs.conversion_id
    WHERE c.id = ? AND c.is_published = 1
  `).get(req.params.id);

  if (!conversion) {
    return res.status(404).json({ error: 'Conversion not found' });
  }

  let userVote = 0;
  if (req.user) {
    const vote = db.prepare('SELECT vote FROM votes WHERE user_id = ? AND conversion_id = ?')
      .get(req.user.id, conversion.id);
    if (vote) userVote = vote.vote;
  }

  res.json({
    id: conversion.id,
    name: conversion.name,
    tier: conversion.tier,
    advType: conversion.adv_type,
    sourceSystem: conversion.source_system,
    data: JSON.parse(conversion.data),
    createdAt: conversion.created_at,
    author: {
      username: conversion.username,
      avatarUrl: conversion.avatar_url
    },
    upvotes: conversion.upvotes,
    downvotes: conversion.downvotes,
    score: conversion.score,
    userVote,
    isOwner: req.user?.id === conversion.user_id
  });
});

// Submit new conversion
app.post('/api/community/conversions', apiLimiter, authenticateToken, requireAuth, (req, res) => {
  const { name, tier, advType, sourceSystem, data } = req.body;

  if (!name || !tier || !advType || !data) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const id = generateConversionId();

  try {
    db.prepare(`
      INSERT INTO conversions (id, user_id, name, tier, adv_type, source_system, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.user.id, name, tier, advType, sourceSystem || null, JSON.stringify(data));

    // Initialize stats
    db.prepare(`
      INSERT INTO conversion_stats (conversion_id, upvotes, downvotes, score)
      VALUES (?, 0, 0, 0)
    `).run(id);

    res.status(201).json({ id, message: 'Conversion submitted successfully' });

  } catch (err) {
    console.error('Error creating conversion:', err);
    res.status(500).json({ error: 'Failed to submit conversion' });
  }
});

// Update own conversion
app.put('/api/community/conversions/:id', apiLimiter, authenticateToken, requireAuth, (req, res) => {
  const conversion = db.prepare('SELECT * FROM conversions WHERE id = ?').get(req.params.id);

  if (!conversion) {
    return res.status(404).json({ error: 'Conversion not found' });
  }

  if (conversion.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only edit your own conversions' });
  }

  const { name, tier, advType, sourceSystem, data } = req.body;

  db.prepare(`
    UPDATE conversions
    SET name = ?, tier = ?, adv_type = ?, source_system = ?, data = ?
    WHERE id = ?
  `).run(
    name || conversion.name,
    tier || conversion.tier,
    advType || conversion.adv_type,
    sourceSystem ?? conversion.source_system,
    data ? JSON.stringify(data) : conversion.data,
    req.params.id
  );

  res.json({ message: 'Conversion updated' });
});

// Delete own conversion
app.delete('/api/community/conversions/:id', apiLimiter, authenticateToken, requireAuth, (req, res) => {
  const conversion = db.prepare('SELECT * FROM conversions WHERE id = ?').get(req.params.id);

  if (!conversion) {
    return res.status(404).json({ error: 'Conversion not found' });
  }

  if (conversion.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete your own conversions' });
  }

  db.prepare('DELETE FROM votes WHERE conversion_id = ?').run(req.params.id);
  db.prepare('DELETE FROM conversion_stats WHERE conversion_id = ?').run(req.params.id);
  db.prepare('DELETE FROM conversions WHERE id = ?').run(req.params.id);

  res.json({ message: 'Conversion deleted' });
});

// Vote on conversion
app.post('/api/community/conversions/:id/vote', apiLimiter, authenticateToken, requireAuth, (req, res) => {
  const { vote } = req.body; // 1 = upvote, -1 = downvote, 0 = remove vote

  if (![1, -1, 0].includes(vote)) {
    return res.status(400).json({ error: 'Invalid vote value' });
  }

  const conversion = db.prepare('SELECT * FROM conversions WHERE id = ? AND is_published = 1')
    .get(req.params.id);

  if (!conversion) {
    return res.status(404).json({ error: 'Conversion not found' });
  }

  // Can't vote on own conversion
  if (conversion.user_id === req.user.id) {
    return res.status(400).json({ error: 'Cannot vote on your own conversion' });
  }

  const existingVote = db.prepare('SELECT vote FROM votes WHERE user_id = ? AND conversion_id = ?')
    .get(req.user.id, req.params.id);

  const transaction = db.transaction(() => {
    if (vote === 0) {
      // Remove vote
      if (existingVote) {
        db.prepare('DELETE FROM votes WHERE user_id = ? AND conversion_id = ?')
          .run(req.user.id, req.params.id);
      }
    } else {
      // Add or update vote
      db.prepare(`
        INSERT OR REPLACE INTO votes (user_id, conversion_id, vote)
        VALUES (?, ?, ?)
      `).run(req.user.id, req.params.id, vote);
    }

    // Recalculate stats
    const stats = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END), 0) as upvotes,
        COALESCE(SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END), 0) as downvotes
      FROM votes WHERE conversion_id = ?
    `).get(req.params.id);

    const score = stats.upvotes - stats.downvotes;

    db.prepare(`
      INSERT OR REPLACE INTO conversion_stats (conversion_id, upvotes, downvotes, score)
      VALUES (?, ?, ?, ?)
    `).run(req.params.id, stats.upvotes, stats.downvotes, score);

    return { upvotes: stats.upvotes, downvotes: stats.downvotes, score };
  });

  const newStats = transaction();

  res.json({
    success: true,
    userVote: vote,
    ...newStats
  });
});

// Get user's submissions
app.get('/api/community/my-submissions', apiLimiter, authenticateToken, requireAuth, (req, res) => {
  const conversions = db.prepare(`
    SELECT
      c.*,
      COALESCE(cs.upvotes, 0) as upvotes,
      COALESCE(cs.downvotes, 0) as downvotes,
      COALESCE(cs.score, 0) as score
    FROM conversions c
    LEFT JOIN conversion_stats cs ON c.id = cs.conversion_id
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC
  `).all(req.user.id);

  res.json({
    conversions: conversions.map(c => ({
      id: c.id,
      name: c.name,
      tier: c.tier,
      advType: c.adv_type,
      sourceSystem: c.source_system,
      data: JSON.parse(c.data),
      createdAt: c.created_at,
      isPublished: !!c.is_published,
      upvotes: c.upvotes,
      downvotes: c.downvotes,
      score: c.score
    }))
  });
});

// ============================================================================
// ADMIN API ROUTES
// ============================================================================

// Get admin statistics
app.get('/api/admin/stats', apiLimiter, authenticateToken, requireAdmin, (req, res) => {
  const stats = {
    totalUsers: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
    totalConversions: db.prepare('SELECT COUNT(*) as count FROM conversions').get().count,
    publishedConversions: db.prepare('SELECT COUNT(*) as count FROM conversions WHERE is_published = 1').get().count,
    totalVotes: db.prepare('SELECT COUNT(*) as count FROM votes').get().count,
    bannedUsers: db.prepare('SELECT COUNT(*) as count FROM users WHERE is_banned = 1').get().count,

    // Conversions by tier
    conversionsByTier: db.prepare(`
      SELECT tier, COUNT(*) as count FROM conversions GROUP BY tier ORDER BY tier
    `).all(),

    // Conversions by type
    conversionsByType: db.prepare(`
      SELECT adv_type as type, COUNT(*) as count FROM conversions GROUP BY adv_type ORDER BY count DESC
    `).all(),

    // Top contributors
    topContributors: db.prepare(`
      SELECT u.username, u.avatar_url, COUNT(c.id) as count
      FROM users u
      JOIN conversions c ON u.id = c.user_id
      GROUP BY u.id
      ORDER BY count DESC
      LIMIT 10
    `).all(),

    // Recent activity (last 7 days)
    recentConversions: db.prepare(`
      SELECT COUNT(*) as count FROM conversions
      WHERE created_at >= datetime('now', '-7 days')
    `).get().count,

    recentUsers: db.prepare(`
      SELECT COUNT(*) as count FROM users
      WHERE created_at >= datetime('now', '-7 days')
    `).get().count
  };

  res.json(stats);
});

// Get all conversions (admin view - includes unpublished)
app.get('/api/admin/conversions', apiLimiter, authenticateToken, requireAdmin, (req, res) => {
  const { search = '', page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const safeLimit = Math.min(parseInt(limit), 100);

  let whereClause = '1=1';
  const params = [];

  if (search) {
    whereClause += ' AND (c.name LIKE ? OR u.username LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM conversions c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE ${whereClause}
  `).get(...params).count;

  const conversions = db.prepare(`
    SELECT
      c.*,
      u.username,
      u.avatar_url,
      u.is_banned as author_banned,
      COALESCE(cs.upvotes, 0) as upvotes,
      COALESCE(cs.downvotes, 0) as downvotes,
      COALESCE(cs.score, 0) as score
    FROM conversions c
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN conversion_stats cs ON c.id = cs.conversion_id
    WHERE ${whereClause}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, safeLimit, offset);

  res.json({
    conversions: conversions.map(c => ({
      id: c.id,
      name: c.name,
      tier: c.tier,
      advType: c.adv_type,
      sourceSystem: c.source_system,
      createdAt: c.created_at,
      isPublished: !!c.is_published,
      author: {
        id: c.user_id,
        username: c.username,
        avatarUrl: c.avatar_url,
        isBanned: !!c.author_banned
      },
      upvotes: c.upvotes,
      downvotes: c.downvotes,
      score: c.score
    })),
    pagination: {
      page: parseInt(page),
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit)
    }
  });
});

// Get all users (admin view)
app.get('/api/admin/users', apiLimiter, authenticateToken, requireAdmin, (req, res) => {
  const { search = '', page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const safeLimit = Math.min(parseInt(limit), 100);

  let whereClause = '1=1';
  const params = [];

  if (search) {
    whereClause += ' AND username LIKE ?';
    params.push(`%${search}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM users WHERE ${whereClause}`).get(...params).count;

  const users = db.prepare(`
    SELECT
      u.*,
      (SELECT COUNT(*) FROM conversions WHERE user_id = u.id) as conversion_count,
      (SELECT COUNT(*) FROM votes WHERE user_id = u.id) as vote_count
    FROM users u
    WHERE ${whereClause}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, safeLimit, offset);

  res.json({
    users: users.map(u => ({
      id: u.id,
      username: u.username,
      avatarUrl: u.avatar_url,
      provider: u.provider,
      providerId: u.provider_id,
      createdAt: u.created_at,
      isBanned: !!u.is_banned,
      isAdmin: !!u.is_admin,
      conversionCount: u.conversion_count,
      voteCount: u.vote_count
    })),
    pagination: {
      page: parseInt(page),
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit)
    }
  });
});

// Admin delete any conversion
app.delete('/api/admin/conversions/:id', apiLimiter, authenticateToken, requireAdmin, (req, res) => {
  const conversion = db.prepare('SELECT * FROM conversions WHERE id = ?').get(req.params.id);

  if (!conversion) {
    return res.status(404).json({ error: 'Conversion not found' });
  }

  db.prepare('DELETE FROM votes WHERE conversion_id = ?').run(req.params.id);
  db.prepare('DELETE FROM conversion_stats WHERE conversion_id = ?').run(req.params.id);
  db.prepare('DELETE FROM conversions WHERE id = ?').run(req.params.id);

  console.log(`Admin ${req.user.username} deleted conversion ${req.params.id} (${conversion.name})`);
  res.json({ message: 'Conversion deleted' });
});

// Admin toggle publish status
app.patch('/api/admin/conversions/:id/publish', apiLimiter, authenticateToken, requireAdmin, (req, res) => {
  const { isPublished } = req.body;

  const conversion = db.prepare('SELECT * FROM conversions WHERE id = ?').get(req.params.id);
  if (!conversion) {
    return res.status(404).json({ error: 'Conversion not found' });
  }

  db.prepare('UPDATE conversions SET is_published = ? WHERE id = ?').run(isPublished ? 1 : 0, req.params.id);

  console.log(`Admin ${req.user.username} ${isPublished ? 'published' : 'unpublished'} conversion ${req.params.id}`);
  res.json({ message: `Conversion ${isPublished ? 'published' : 'unpublished'}` });
});

// Admin ban/unban user
app.patch('/api/admin/users/:id/ban', apiLimiter, authenticateToken, requireAdmin, (req, res) => {
  const { isBanned } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Can't ban yourself
  if (user.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot ban yourself' });
  }

  // Can't ban other admins
  if (user.is_admin) {
    return res.status(400).json({ error: 'Cannot ban an admin' });
  }

  db.prepare('UPDATE users SET is_banned = ? WHERE id = ?').run(isBanned ? 1 : 0, req.params.id);

  console.log(`Admin ${req.user.username} ${isBanned ? 'banned' : 'unbanned'} user ${user.username}`);
  res.json({ message: `User ${isBanned ? 'banned' : 'unbanned'}` });
});

// ============================================================================
// STATIC FILES
// ============================================================================

// Serve static files from current directory
app.use(express.static(__dirname, {
  index: 'index.html'
}));

// Serve parsers directory
app.use('/parsers', express.static(path.join(__dirname, 'parsers')));

// SPA fallback - serve index.html for client-side routing
app.get('/community/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Discord OAuth configured:', !!DISCORD_CLIENT_ID);
});
