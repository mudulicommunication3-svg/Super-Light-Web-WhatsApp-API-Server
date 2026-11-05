#!/usr/bin/env node
/**
 * Standalone Admin Seed Script (create-admin.js)
 *
 * Ensures that the SQLite database schema is initialized and the default
 * admin user (admin@gmail.com / admin123) exists before starting the server.
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

const rawEnvPass = process.env.ADMIN_DASHBOARD_PASSWORD;
const isPlaceholder = typeof rawEnvPass === 'string' && /^change_me|^replace_with/i.test(rawEnvPass.trim());

const DEFAULT_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@gmail.com').toLowerCase();
const DEFAULT_ADMIN_PASSWORD = (!rawEnvPass || isPlaceholder) ? 'admin123' : rawEnvPass;
const DEFAULT_ADMIN_ROLE = 'admin';

async function seedAdmin() {
    try {
        console.log(`[Seed] Initializing SQLite database at: ${DB_PATH}`);
        initializeSchema();

        const existingAdmin = db
            .prepare('SELECT id, email, password, role, is_active FROM users WHERE email = ?')
            .get(DEFAULT_ADMIN_EMAIL);

        const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);

        if (existingAdmin) {
            const passwordMatches = await bcrypt.compare(DEFAULT_ADMIN_PASSWORD, existingAdmin.password);
            if (!passwordMatches || existingAdmin.role !== 'admin' || existingAdmin.is_active !== 1) {
                db.prepare("UPDATE users SET password = ?, role = 'admin', is_active = 1 WHERE id = ?")
                    .run(hashedPassword, existingAdmin.id);
                console.log(`[Seed] Reset credentials and active admin role for '${DEFAULT_ADMIN_EMAIL}'.`);
            } else {
                console.log(`[Seed] Admin user '${DEFAULT_ADMIN_EMAIL}' already exists and credentials match (id: ${existingAdmin.id}).`);
            }
            return;
        }

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
