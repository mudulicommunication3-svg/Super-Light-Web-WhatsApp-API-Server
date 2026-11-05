#!/usr/bin/env node
/**
 * Standalone Admin Seed Script (create-admin.js)
 *
 * Ensures that the SQLite database schema is initialized and the default
 * admin user exists before starting the server.
 *
 * Usage:
 *   node create-admin.js
 *   npm run build
 *   npm run seed:admin
 */

require('dotenv').config();

const crypto = require('crypto');
const { db, initializeSchema, close, DB_PATH } = require('./src/config/database');
const bcrypt = require('./src/utils/bcrypt-compat');

const DEFAULT_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@gmail.com').toLowerCase();
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_DASHBOARD_PASSWORD || 'admin123';
const DEFAULT_ADMIN_ROLE = 'admin';

async function seedAdmin() {
    try {
        console.log(`[Seed] Initializing SQLite database at: ${DB_PATH}`);
        initializeSchema();

        const existingAdmin = db
            .prepare('SELECT id, email, role, is_active FROM users WHERE email = ?')
            .get(DEFAULT_ADMIN_EMAIL);

        if (existingAdmin) {
            // Ensure role is 'admin' and account is active
            if (existingAdmin.role !== 'admin' || existingAdmin.is_active !== 1) {
                db.prepare("UPDATE users SET role = 'admin', is_active = 1 WHERE id = ?").run(existingAdmin.id);
                console.log(`[Seed] Updated existing user '${DEFAULT_ADMIN_EMAIL}' to active admin role.`);
            } else {
                console.log(`[Seed] Admin user '${DEFAULT_ADMIN_EMAIL}' already exists (id: ${existingAdmin.id}).`);
            }
            return;
        }

        const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
        const id = crypto.randomUUID();

        db.prepare(`
            INSERT INTO users (id, email, password, role, created_by, created_at, is_active)
            VALUES (?, ?, ?, ?, 'system', datetime('now'), 1)
        `).run(id, DEFAULT_ADMIN_EMAIL, hashedPassword, DEFAULT_ADMIN_ROLE);

        console.log(`[Seed] Successfully created default admin user:`);
        console.log(`       Email: ${DEFAULT_ADMIN_EMAIL}`);
        console.log(`       Role:  ${DEFAULT_ADMIN_ROLE}`);
        console.log(`       ID:    ${id}`);
    } catch (err) {
        console.error('[Seed] Failed to seed admin user:', err.message);
        process.exitCode = 1;
    } finally {
        try {
            close();
        } catch (err) {
            // Ignore close errors
        }
    }
}

seedAdmin();
