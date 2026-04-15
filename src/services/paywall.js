import crypto from 'crypto';
import db from './db.js';

export function hasActiveLicense(guildId, botSlug = 'default') {
  const row = db.prepare(`SELECT * FROM guild_licenses
    WHERE guild_id = ? AND bot_slug = ? AND status = 'active'
    AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))`).get(guildId, botSlug);
  return Boolean(row);
}

export function getGuildLicense(guildId, botSlug = 'default') {
  return db.prepare(`SELECT gl.*, lk.license_key FROM guild_licenses gl
    LEFT JOIN license_keys lk ON lk.id = gl.key_id
    WHERE gl.guild_id = ? AND gl.bot_slug = ?`).get(guildId, botSlug);
}

export function redeemLicenseKey({ licenseKey, guildId, userId, botSlug = 'default' }) {
  const key = db.prepare(`SELECT * FROM license_keys
    WHERE license_key = ?
    AND bot_slug = ?
    AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))`).get(licenseKey.trim(), botSlug);

  if (!key) {
    throw new Error('Invalid key for selected bot.');
  }

  if (Number(key.redeemed_count || 0) >= Number(key.max_servers || 1)) {
    throw new Error('This key has reached its server limit.');
  }

  if (hasActiveLicense(guildId, botSlug)) {
    throw new Error('This guild already has an active license for this bot.');
  }

  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO guild_licenses (guild_id, key_id, bot_slug, plan, status, activated_at, expires_at)
      VALUES (?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, ?)`) 
      .run(guildId, key.id, botSlug, key.plan, key.expires_at);

    const nextCount = Number(key.redeemed_count || 0) + 1;
    const nextStatus = nextCount >= Number(key.max_servers || 1) ? 'redeemed' : 'partially_redeemed';

    db.prepare(`UPDATE license_keys SET
      status = ?,
      redeemed_by_user_id = ?,
      redeemed_guild_id = ?,
      redeemed_count = ?,
      redeemed_at = CURRENT_TIMESTAMP
      WHERE id = ?`).run(nextStatus, userId, guildId, nextCount, key.id);
  });

  tx();
  return getGuildLicense(guildId, botSlug);
}

export function createManualLicenseKey({ plan = 'premium', botSlug = 'default', maxServers = 1, expiresAt = null, createdBy = 'manual' }) {
  const licenseKey = `EDS-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  db.prepare(`INSERT INTO license_keys (license_key, plan, status, max_servers, redeemed_count, bot_slug, expires_at, created_by)
    VALUES (?, ?, 'unused', ?, 0, ?, ?, ?)`).run(
    licenseKey,
    plan,
    Math.max(1, Number(maxServers || 1)),
    botSlug,
    expiresAt || null,
    createdBy
  );
  return db.prepare('SELECT * FROM license_keys WHERE license_key = ?').get(licenseKey);
}

export function listRecentLicenseKeys(limit = 25) {
  return db.prepare('SELECT * FROM license_keys ORDER BY created_at DESC LIMIT ?').all(limit);
}
