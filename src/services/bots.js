import { ActivityType } from 'discord.js';
import db from './db.js';

function envFallbackVariants() {
  const raw = process.env.BOT_VARIANTS_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed
          .filter((b) => b.slug && b.clientId)
          .map((b) => ({
            slug: String(b.slug),
            name: String(b.name || b.slug),
            client_id: String(b.clientId),
            permissions: String(b.permissions || process.env.DISCORD_BOT_INVITE_PERMISSIONS || '8'),
            status: String(b.status || 'online'),
            activity_type: String(b.activityType || 'Playing'),
            activity_name: String(b.activityName || 'Managing your server')
          }));
      }
    } catch {
      // ignore
    }
  }

  return [{
    slug: 'default',
    name: process.env.BOT_DISPLAY_NAME || 'Elite Discord Suite',
    client_id: process.env.DISCORD_CLIENT_ID,
    permissions: process.env.DISCORD_BOT_INVITE_PERMISSIONS || '8',
    status: 'online',
    activity_type: 'Playing',
    activity_name: 'Managing your server'
  }];
}

function ensureSeeded() {
  const count = db.prepare('SELECT COUNT(*) as total FROM bot_variants').get().total;
  if (count > 0) return;

  const fallback = envFallbackVariants();
  const stmt = db.prepare(`INSERT INTO bot_variants
    (slug, name, client_id, permissions, status, activity_type, activity_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);

  for (const bot of fallback) {
    stmt.run(bot.slug, bot.name, bot.client_id, bot.permissions, bot.status, bot.activity_type, bot.activity_name);
  }
}

export function getBotVariants() {
  ensureSeeded();
  return db.prepare('SELECT * FROM bot_variants ORDER BY created_at ASC').all();
}

export function getBotVariantBySlug(slug) {
  ensureSeeded();
  return db.prepare('SELECT * FROM bot_variants WHERE slug = ?').get(slug) || getBotVariants()[0];
}

export function createBotVariant({ slug, name, clientId, permissions = '8', status = 'online', activityType = 'Playing', activityName = '' }) {
  db.prepare(`INSERT INTO bot_variants
    (slug, name, client_id, permissions, status, activity_type, activity_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    slug,
    name,
    clientId,
    permissions,
    status,
    activityType,
    activityName
  );
  return getBotVariantBySlug(slug);
}

export function updateBotVariant(slug, patch) {
  const current = getBotVariantBySlug(slug);
  if (!current) return null;
  const next = {
    ...current,
    ...patch,
    client_id: patch.clientId ?? patch.client_id ?? current.client_id,
    activity_type: patch.activityType ?? patch.activity_type ?? current.activity_type,
    activity_name: patch.activityName ?? patch.activity_name ?? current.activity_name
  };

  db.prepare(`UPDATE bot_variants SET
    name = ?,
    client_id = ?,
    permissions = ?,
    status = ?,
    activity_type = ?,
    activity_name = ?,
    updated_at = CURRENT_TIMESTAMP
    WHERE slug = ?`).run(
    next.name,
    next.client_id,
    next.permissions,
    next.status,
    next.activity_type,
    next.activity_name,
    slug
  );

  return getBotVariantBySlug(slug);
}

export function applyBotVariantPresence(client, botVariant) {
  if (!client.user || !botVariant) return;

  const map = {
    Playing: ActivityType.Playing,
    Streaming: ActivityType.Streaming,
    Listening: ActivityType.Listening,
    Watching: ActivityType.Watching,
    Competing: ActivityType.Competing
  };

  client.user.setPresence({
    status: botVariant.status || 'online',
    activities: botVariant.activity_name
      ? [{ name: botVariant.activity_name, type: map[botVariant.activity_type] ?? ActivityType.Playing }]
      : []
  });
}
