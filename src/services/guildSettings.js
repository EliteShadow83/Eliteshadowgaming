import db from './db.js';

const defaultSettings = {
  prefix: '!',
  welcome_enabled: 1,
  welcome_channel_id: null,
  moderation_log_channel_id: null,
  automod_enabled: 1,
  leveling_enabled: 1
};

export function getGuildSettings(guildId) {
  const row = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
  if (!row) {
    db.prepare(`INSERT INTO guild_settings (
      guild_id, prefix, welcome_enabled, automod_enabled, leveling_enabled
    ) VALUES (?, ?, ?, ?, ?)`).run(
      guildId,
      defaultSettings.prefix,
      defaultSettings.welcome_enabled,
      defaultSettings.automod_enabled,
      defaultSettings.leveling_enabled
    );
    return { guild_id: guildId, ...defaultSettings };
  }
  return row;
}

export function updateGuildSettings(guildId, patch) {
  const current = getGuildSettings(guildId);
  const next = { ...current, ...patch };
  db.prepare(`UPDATE guild_settings SET
    prefix = ?,
    welcome_enabled = ?,
    welcome_channel_id = ?,
    moderation_log_channel_id = ?,
    automod_enabled = ?,
    leveling_enabled = ?,
    updated_at = CURRENT_TIMESTAMP
    WHERE guild_id = ?`).run(
    next.prefix,
    next.welcome_enabled ? 1 : 0,
    next.welcome_channel_id,
    next.moderation_log_channel_id,
    next.automod_enabled ? 1 : 0,
    next.leveling_enabled ? 1 : 0,
    guildId
  );
  return getGuildSettings(guildId);
}

export function addWarning({ guildId, userId, moderatorId, reason }) {
  db.prepare(`INSERT INTO warnings (guild_id, user_id, moderator_id, reason)
    VALUES (?, ?, ?, ?)`)
    .run(guildId, userId, moderatorId, reason);
}

export function incrementXP(guildId, userId, amount = 15) {
  const existing = db.prepare('SELECT * FROM leveling WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
  if (!existing) {
    db.prepare('INSERT INTO leveling (guild_id, user_id, xp, level) VALUES (?, ?, ?, ?)').run(guildId, userId, amount, 1);
    return { levelUp: false, level: 1, xp: amount };
  }

  const xp = existing.xp + amount;
  const nextLevel = Math.floor(0.1 * Math.sqrt(xp)) + 1;
  const levelUp = nextLevel > existing.level;

  db.prepare('UPDATE leveling SET xp = ?, level = ? WHERE guild_id = ? AND user_id = ?')
    .run(xp, nextLevel, guildId, userId);

  return { levelUp, level: nextLevel, xp };
}

export function getLeaderboard(guildId, limit = 10) {
  return db.prepare('SELECT * FROM leveling WHERE guild_id = ? ORDER BY xp DESC LIMIT ?').all(guildId, limit);
}
