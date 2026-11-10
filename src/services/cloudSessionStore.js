/**
 * Cloud Session Store
 * Persists WhatsApp Baileys auth_info_baileys credentials, session tokens,
 * and recent chat_messages to Google Sheet (WA_Config) so Render container
 * restarts and redeployments never log out the WhatsApp session.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { db } = require('../config/database');

const DEFAULT_CLOUD_BACKUP_URL =
    process.env.CLOUD_BACKUP_WEBHOOK_URL ||
    'https://script.google.com/macros/s/AKfycbyBG-2536FNp4Kdux8GSBjKMyHjaSBWqSIaJpHDQ68GtzKpyUYR9x_N9QthMdvXPNhE/exec';

const AUTH_DIR = path.join(__dirname, '../../auth_info_baileys');
const CHUNK_SIZE = 38000; // Safe below Google Sheets 50,000 char per cell limit

let backupTimer = null;
let backupInFlight = false;
let pendingBackupAfterFlight = false;
let lastBackupHash = '';
let lastBackupAt = null;

/**
 * Collect session files for a given session folder, keeping all essential
 * auth files (creds.json, app-state-sync, session, sender-key, lid-mapping)
 * and capping pre-keys to the newest 35 files so backup stays fast and compact.
 */
function readSessionAuthFiles(sessionDir) {
    if (!fs.existsSync(sessionDir)) return {};
    const entries = fs.readdirSync(sessionDir, { withFileTypes: true })
        .filter(d => d.isFile() && d.name.endsWith('.json'));

    const credsFile = entries.find(e => e.name === 'creds.json');
    if (!credsFile) return {};

    const preKeys = [];
    const otherFiles = [];

    for (const entry of entries) {
        const fullPath = path.join(sessionDir, entry.name);
        if (entry.name.startsWith('pre-key-')) {
            let mtimeMs = 0;
            try {
                mtimeMs = fs.statSync(fullPath).mtimeMs;
            } catch (_) {}
            preKeys.push({ name: entry.name, fullPath, mtimeMs });
        } else {
            otherFiles.push({ name: entry.name, fullPath });
        }
    }

    // Keep newest 35 pre-keys
    preKeys.sort((a, b) => b.mtimeMs - a.mtimeMs);
    const selectedFiles = [...otherFiles, ...preKeys.slice(0, 35)];

    const filesMap = {};
    for (const file of selectedFiles) {
        try {
            filesMap[file.name] = fs.readFileSync(file.fullPath, 'utf8');
        } catch (_) {}
    }
    return filesMap;
}

/**
 * Build full backup snapshot from local SQLite + auth_info_baileys
 */
function buildBackupSnapshot() {
    const sessions = db.prepare('SELECT * FROM whatsapp_sessions ORDER BY created_at DESC').all();
    const authFiles = {};

    if (fs.existsSync(AUTH_DIR)) {
        const dirs = fs.readdirSync(AUTH_DIR, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name);

        for (const sessionId of dirs) {
            const sessionFiles = readSessionAuthFiles(path.join(AUTH_DIR, sessionId));
            if (sessionFiles['creds.json']) {
                authFiles[sessionId] = sessionFiles;
            }
        }
    }

    let chatMessages = [];
    try {
        chatMessages = db.prepare(`
            SELECT id, session_id, remote_jid, sender_name, from_me, message_type, body, timestamp
            FROM chat_messages
            ORDER BY timestamp DESC
            LIMIT 80
        `).all();
    } catch (_) {}

    return {
        version: 1,
        savedAt: new Date().toISOString(),
        sessions,
        authFiles,
        chatMessages
    };
}

/**
 * Immediately back up sessions and Baileys credentials to Google Sheet WA_Config
 */
async function backupToCloudNow(reason = 'manual') {
    if (!DEFAULT_CLOUD_BACKUP_URL) return { ok: false, reason: 'No backup URL' };
    if (backupInFlight) {
        pendingBackupAfterFlight = true;
        return { ok: true, queued: true };
    }

    backupInFlight = true;
    try {
        const snapshot = buildBackupSnapshot();
        const sessionIdsWithAuth = Object.keys(snapshot.authFiles);

        // Do not overwrite an existing cloud backup with an empty state if no sessions have creds.json yet
        if (sessionIdsWithAuth.length === 0 && snapshot.sessions.length === 0 && reason !== 'session-deleted') {
            return { ok: false, skipped: true, reason: 'No authenticated sessions to back up' };
        }

        // Compute content hash (excluding savedAt) to skip redundant network writes
        const hashSource = JSON.stringify({
            s: snapshot.sessions.map(s => ({ id: s.id, token: s.token, owner: s.owner_email })),
            a: snapshot.authFiles,
            m: snapshot.chatMessages.length
        });
        if (hashSource === lastBackupHash && reason !== 'manual' && reason !== 'shutdown') {
            return { ok: true, skipped: true, reason: 'Unchanged' };
        }

        const rawJson = JSON.stringify(snapshot);
        const compressed = zlib.gzipSync(Buffer.from(rawJson, 'utf8'), { level: 9 });
        const base64Data = compressed.toString('base64');

        const chunks = [];
        for (let i = 0; i < base64Data.length; i += CHUNK_SIZE) {
            chunks.push(base64Data.slice(i, i + CHUNK_SIZE));
        }

        const payload = {
            action: 'update_wa_settings',
            WA_CLOUD_BACKUP_CHUNKS: String(chunks.length),
            WA_CLOUD_BACKUP_UPDATED_AT: snapshot.savedAt
        };

        for (let i = 0; i < chunks.length; i++) {
            payload[`WA_CLOUD_BACKUP_${i}`] = chunks[i];
        }
        // Clear any leftover higher chunk slots up to 6
        for (let i = chunks.length; i < 6; i++) {
            payload[`WA_CLOUD_BACKUP_${i}`] = '';
        }

        // Also keep SESSION_ID and API_BEARER_TOKEN in sync with the primary active session
        const primarySession =
            snapshot.sessions.find(s => snapshot.authFiles[s.id]) ||
            snapshot.sessions[0];
        if (primarySession && primarySession.id && primarySession.token) {
            payload.SESSION_ID = primarySession.id;
            payload.API_BEARER_TOKEN = primarySession.token;
        }

        const res = await fetch(DEFAULT_CLOUD_BACKUP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data && (data.ok || data.status === 'success')) {
            lastBackupHash = hashSource;
            lastBackupAt = snapshot.savedAt;
            console.log(`[CloudSessionStore] Backed up ${sessionIdsWithAuth.length} WhatsApp session(s) to cloud (${chunks.length} chunk(s), ${(base64Data.length / 1024).toFixed(1)} KB, reason: ${reason})`);
            return {
                ok: true,
                sessionsBackedUp: sessionIdsWithAuth,
                chunks: chunks.length,
                sizeKb: Number((base64Data.length / 1024).toFixed(1)),
                savedAt: snapshot.savedAt
            };
        }
        return { ok: false, error: data?.message || 'Cloud backup failed' };
    } catch (err) {
        console.warn(`[CloudSessionStore] Backup warning (${reason}):`, err.message);
        return { ok: false, error: err.message };
    } finally {
        backupInFlight = false;
        if (pendingBackupAfterFlight) {
            pendingBackupAfterFlight = false;
            scheduleBackup('queued-followup', 2500);
        }
    }
}

/**
 * Debounced cloud backup trigger so rapid key/creds updates batch into a single request
 */
function scheduleBackup(reason = 'auto', delayMs = 3000) {
    if (backupTimer) {
        clearTimeout(backupTimer);
    }
    backupTimer = setTimeout(() => {
        backupTimer = null;
        backupToCloudNow(reason).catch(() => {});
    }, delayMs);
    if (typeof backupTimer.unref === 'function') {
        backupTimer.unref();
    }
}

/**
 * Restore sessions, auth_info_baileys files, and recent chat_messages from Cloud on server boot
 */
async function restoreFromCloud() {
    if (!DEFAULT_CLOUD_BACKUP_URL) return { ok: false, restored: 0 };

    try {
        console.log('[CloudSessionStore] Checking cloud storage for saved WhatsApp sessions...');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(`${DEFAULT_CLOUD_BACKUP_URL}?action=get_wa_settings`, {
            signal: controller.signal
        });
        clearTimeout(timeout);

        const data = await res.json();
        const settings = data?.settings || {};

        const chunkCount = Number.parseInt(String(settings.WA_CLOUD_BACKUP_CHUNKS || '0'), 10);
        let restoredSessionsCount = 0;

        if (chunkCount > 0 && chunkCount <= 20) {
            let base64Data = '';
            for (let i = 0; i < chunkCount; i++) {
                base64Data += String(settings[`WA_CLOUD_BACKUP_${i}`] || '');
            }

            if (base64Data) {
                const decompressed = zlib.gunzipSync(Buffer.from(base64Data, 'base64')).toString('utf8');
                const snapshot = JSON.parse(decompressed);

                // 1. Restore auth_info_baileys/<sessionId>/* files
                if (snapshot.authFiles && typeof snapshot.authFiles === 'object') {
                    if (!fs.existsSync(AUTH_DIR)) {
                        fs.mkdirSync(AUTH_DIR, { recursive: true });
                    }
                    for (const [sessionId, filesMap] of Object.entries(snapshot.authFiles)) {
                        if (!filesMap || typeof filesMap !== 'object' || !filesMap['creds.json']) continue;
                        const sessionDir = path.join(AUTH_DIR, sessionId);
                        if (!fs.existsSync(sessionDir)) {
                            fs.mkdirSync(sessionDir, { recursive: true });
                        }
                        for (const [fileName, fileContent] of Object.entries(filesMap)) {
                            // Prevent path traversal
                            const safeName = path.basename(fileName);
                            if (!safeName.endsWith('.json')) continue;
                            const targetPath = path.join(sessionDir, safeName);
                            if (!fs.existsSync(targetPath)) {
                                fs.writeFileSync(targetPath, String(fileContent), 'utf8');
                            }
                        }
                        restoredSessionsCount++;
                    }
                }

                // 2. Restore whatsapp_sessions rows (preserving original token!)
                if (Array.isArray(snapshot.sessions)) {
                    const adminUser = db.prepare(
                        "SELECT email FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1"
                    ).get();
                    const fallbackOwner = adminUser ? adminUser.email : null;

                    const upsertSession = db.prepare(`
                        INSERT INTO whatsapp_sessions (id, owner_email, token, status, detail, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))
                        ON CONFLICT(id) DO UPDATE SET
                            token = excluded.token
                    `);

                    for (const s of snapshot.sessions) {
                        if (!s || !s.id || !s.token) continue;
                        // Only restore if session has auth files or matches active SESSION_ID
                        const hasAuth = fs.existsSync(path.join(AUTH_DIR, s.id, 'creds.json'));
                        if (hasAuth || s.id === settings.SESSION_ID) {
                            let ownerEmail = null;
                            if (s.owner_email) {
                                const u = db.prepare('SELECT email FROM users WHERE email = ?').get(s.owner_email);
                                if (u) ownerEmail = u.email;
                            }
                            if (!ownerEmail) ownerEmail = fallbackOwner;
                            upsertSession.run(
                                s.id,
                                ownerEmail,
                                s.token,
                                hasAuth ? 'CONNECTED' : (s.status || 'DISCONNECTED'),
                                s.detail || 'Restored from cloud backup',
                                s.created_at || null
                            );
                        }
                    }
                }

                // 3. Restore recent chat_messages so Find IDs & Edit Old Message work across restarts
                if (Array.isArray(snapshot.chatMessages) && snapshot.chatMessages.length > 0) {
                    const insertMsg = db.prepare(`
                        INSERT OR IGNORE INTO chat_messages (id, session_id, remote_jid, sender_name, from_me, message_type, body, timestamp, is_read)
                        VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), 1)
                    `);
                    for (const m of snapshot.chatMessages) {
                        if (!m || !m.id || !m.session_id || !m.remote_jid) continue;
                        try {
                            insertMsg.run(
                                m.id,
                                m.session_id,
                                m.remote_jid,
                                m.sender_name || null,
                                m.from_me ? 1 : 0,
                                m.message_type || 'text',
                                m.body || '',
                                m.timestamp || null
                            );
                        } catch (_) {}
                    }
                }

                console.log(`[CloudSessionStore] Restored ${restoredSessionsCount} WhatsApp session(s) and ${snapshot.chatMessages?.length || 0} chat message(s) from cloud backup (saved at ${snapshot.savedAt})`);
            }
        }

        // Ensure primary SESSION_ID and API_BEARER_TOKEN from WA_Config are aligned in DB
        const cfgSessionId = String(settings.SESSION_ID || '').trim();
        const cfgToken = String(settings.API_BEARER_TOKEN || '').trim();
        if (cfgSessionId && cfgToken) {
            const existing = db.prepare('SELECT * FROM whatsapp_sessions WHERE id = ?').get(cfgSessionId);
            if (existing && existing.token !== cfgToken) {
                db.prepare('UPDATE whatsapp_sessions SET token = ? WHERE id = ?').run(cfgToken, cfgSessionId);
                console.log(`[CloudSessionStore] Synced Bearer token for session "${cfgSessionId}" from WA_Config`);
            } else if (!existing && fs.existsSync(path.join(AUTH_DIR, cfgSessionId, 'creds.json'))) {
                const adminUser = db.prepare("SELECT email FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1").get();
                db.prepare(`
                    INSERT OR IGNORE INTO whatsapp_sessions (id, owner_email, token, status, detail, created_at, updated_at)
                    VALUES (?, ?, ?, 'CONNECTED', 'Restored from WA_Config', datetime('now'), datetime('now'))
                `).run(cfgSessionId, adminUser ? adminUser.email : null, cfgToken);
            }
        }

        return { ok: true, restored: restoredSessionsCount };
    } catch (err) {
        console.warn('[CloudSessionStore] Cloud restore skipped or failed:', err.message);
        return { ok: false, restored: 0, error: err.message };
    }
}

function getBackupStatus() {
    return {
        cloudBackupEnabled: Boolean(DEFAULT_CLOUD_BACKUP_URL),
        lastBackupAt
    };
}

module.exports = {
    scheduleBackup,
    backupToCloudNow,
    restoreFromCloud,
    getBackupStatus
};
