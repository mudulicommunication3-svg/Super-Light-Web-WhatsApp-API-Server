/**
 * Authentication Routes
 * Handles login, logout, and user authentication
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { requireAuth, requireAdmin, getCurrentUser } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const response = require('../utils/response');

// Environment config
const ADMIN_PASSWORD = process.env.ADMIN_DASHBOARD_PASSWORD;

// Per-IP+user login throttling: 5 failed attempts -> 15 minute lockout.
// Keying on IP+username avoids locking out every user behind a shared
// proxy IP; the map is bounded to prevent unbounded growth.
const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const LOGIN_TRACK_MAX_ENTRIES = 5000;
const loginAttempts = new Map(); // `${ip}|${email}` -> { failures, firstFailureAt, lockedUntil }

function loginKey(ip, email) {
    return `${ip}|${String(email || 'unknown').toLowerCase()}`;
}

function pruneLoginAttempts() {
    if (loginAttempts.size <= LOGIN_TRACK_MAX_ENTRIES) return;
    const now = Date.now();
    for (const [key, state] of loginAttempts) {
        if (now - state.firstFailureAt > LOGIN_LOCKOUT_MS) {
            loginAttempts.delete(key);
        }
        if (loginAttempts.size <= LOGIN_TRACK_MAX_ENTRIES) break;
    }
    // Still over the cap: evict oldest entries (Map iterates in insertion order)
    while (loginAttempts.size > LOGIN_TRACK_MAX_ENTRIES) {
        loginAttempts.delete(loginAttempts.keys().next().value);
    }
}

function recordLoginFailure(ip, email) {
    pruneLoginAttempts();
    const now = Date.now();
    const key = loginKey(ip, email);
    const state = loginAttempts.get(key) || { failures: 0, firstFailureAt: now, lockedUntil: 0 };
    // Reset counter if last failure was more than lockout window ago
    if (now - state.firstFailureAt > LOGIN_LOCKOUT_MS) {
        state.failures = 0;
        state.firstFailureAt = now;
    }
    state.failures += 1;
    if (state.failures >= LOGIN_MAX_FAILURES) {
        state.lockedUntil = now + LOGIN_LOCKOUT_MS;
    }
    loginAttempts.set(key, state);
}

function recordLoginSuccess(ip, email) {
    loginAttempts.delete(loginKey(ip, email));
}

function isLoginLocked(ip, email) {
    const state = loginAttempts.get(loginKey(ip, email));
    if (state && state.lockedUntil && Date.now() < state.lockedUntil) {
        return true;
    }
    if (state && state.lockedUntil && Date.now() >= state.lockedUntil) {
        loginAttempts.delete(loginKey(ip, email));
    }
    return false;
}

// Constant-time string comparison (avoids timing oracles on the legacy password)
function safeEqual(a, b) {
    const ba = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
}

/**
 * POST /admin/login
 * Login with email/password or legacy password-only
 */
router.post('/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    // Throttle brute-force attempts per IP + username
    if (isLoginLocked(ip, email)) {
        await ActivityLog.logLogin(email || 'unknown', ip, userAgent, false);
        return response.error(res, 'Too many failed login attempts. Try again later.', 429);
    }

    const establishSession = (userData, done) => {
        // Regenerate the session ID on login to prevent session fixation
        req.session.regenerate(async (err) => {
            if (err) {
                console.error('Session regenerate error:', err);
                return response.serverError(res, 'Session error');
            }
            req.session.adminAuthed = true;
            req.session.userEmail = userData.email;
            req.session.userRole = userData.role;
            req.session.userId = userData.id;

            // Preserve SameSite=None; Secure; Partitioned after session.regenerate when over HTTPS/proxy
            const isHttps = req.secure || req.headers['x-forwarded-proto']?.split(',')[0]?.trim() === 'https';
            if (isHttps && req.session.cookie) {
                req.session.cookie.secure = true;
                req.session.cookie.sameSite = 'none';
                req.session.cookie.partitioned = true;
            }

            req.session.save((saveErr) => {
                if (saveErr) {
                    console.error('Session save error:', saveErr);
                    return response.serverError(res, 'Session error');
                }
                recordLoginSuccess(ip, userData.email);
                ActivityLog.logLogin(userData.email, ip, userAgent, true);
                done();
            });
        });
    };

    // Legacy password-only login for admin (username 'admin' with ADMIN_DASHBOARD_PASSWORD)
    if (email === 'admin' && password) {
        if (ADMIN_PASSWORD && safeEqual(password, ADMIN_PASSWORD)) {
            return establishSession(
                { email: 'admin@gmail.com', role: 'admin', id: 'legacy-admin' },
                () => response.success(res, { role: 'admin', email: 'admin@gmail.com' })
            );
        }
    }

    // Email/password login (also allow shorthand 'admin' -> 'admin@gmail.com')
    if (email && password) {
        const normalizedLookup = email.trim().toLowerCase() === 'admin' ? 'admin@gmail.com' : email.trim();
        const user = await User.authenticate(normalizedLookup, password);
        if (user) {
            return establishSession(
                { email: user.email, role: user.role, id: user.id },
                () => response.success(res, { role: user.role, email: user.email })
            );
        }
    }

    recordLoginFailure(ip, email);
    await ActivityLog.logLogin(email || 'unknown', ip, userAgent, false);
    return response.unauthorized(res, 'Invalid credentials');
}));

/**
 * POST /admin/logout
 * Logout and destroy session
 */
router.post('/logout', requireAuth, (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        return response.success(res, { redirect: '/admin/login.html' });
    });
});

/**
 * GET /admin/me
 * Get current user info
 */
router.get('/me', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    return response.success(res, user);
});

/**
 * GET /admin/ws-token
 * Get WebSocket authentication token
 */
router.get('/ws-token', requireAuth, (req, res) => {
    const token = crypto.randomBytes(32).toString('hex');

    // Store in session for validation
    req.session.wsToken = token;
    req.session.save((err) => {
        if (err) {
            console.error('Session save error:', err);
            return response.serverError(res, 'Session error');
        }
        return response.success(res, { token });
    });
});

module.exports = router;
