import db from './db.js';

const defaultSettings = {
  prefix: '!',
  welcome_enabled: 1,
  welcome_channel_id: null,
  leave_enabled: 0,
  leave_channel_id: null,
  join_message: '👋 Welcome {user} to **{server}**!',
  leave_message: '👋 {user_tag} has left **{server}**.',
  autorole_enabled: 0,
  autorole_role_id: null,
  logging_enabled: 0,
  moderation_log_channel_id: null,
  log_member_events: 1,
  log_message_edits: 1,
  log_message_deletes: 1,
  log_voice_events: 0,
  log_moderation_events: 1,
  log_automod_events: 1,
  automod_enabled: 1,
  block_links: 0,
  block_invites: 1,
  max_mentions: 5,
  automod_mute_enabled: 0,
  automod_mute_threshold: 5,
  automod_mute_window_minutes: 10,
  automod_mute_duration_minutes: 15,
  leveling_enabled: 1
};

export function getGuildSettings(guildId) {
  const row = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
  if (!row) {
    db.prepare(`INSERT INTO guild_settings (
      guild_id, prefix, welcome_enabled, welcome_channel_id, leave_enabled, leave_channel_id,
      join_message, leave_message, autorole_enabled, autorole_role_id, logging_enabled, moderation_log_channel_id,
      log_member_events, log_message_edits, log_message_deletes, log_voice_events, log_moderation_events, log_automod_events,
      automod_enabled, block_links, block_invites, max_mentions,
      automod_mute_enabled, automod_mute_threshold, automod_mute_window_minutes, automod_mute_duration_minutes,
      leveling_enabled
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        guildId,
        defaultSettings.prefix,
        defaultSettings.welcome_enabled,
        defaultSettings.welcome_channel_id,
        defaultSettings.leave_enabled,
        defaultSettings.leave_channel_id,
        defaultSettings.join_message,
        defaultSettings.leave_message,
        defaultSettings.autorole_enabled,
        defaultSettings.autorole_role_id,
        defaultSettings.logging_enabled,
        defaultSettings.moderation_log_channel_id,
        defaultSettings.log_member_events,
        defaultSettings.log_message_edits,
        defaultSettings.log_message_deletes,
        defaultSettings.log_voice_events,
        defaultSettings.log_moderation_events,
        defaultSettings.log_automod_events,
        defaultSettings.automod_enabled,
        defaultSettings.block_links,
        defaultSettings.block_invites,
        defaultSettings.max_mentions,
        defaultSettings.automod_mute_enabled,
        defaultSettings.automod_mute_threshold,
        defaultSettings.automod_mute_window_minutes,
        defaultSettings.automod_mute_duration_minutes,
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
    leave_enabled = ?,
    leave_channel_id = ?,
    join_message = ?,
    leave_message = ?,
    autorole_enabled = ?,
    autorole_role_id = ?,
    logging_enabled = ?,
    moderation_log_channel_id = ?,
    log_member_events = ?,
    log_message_edits = ?,
    log_message_deletes = ?,
    log_voice_events = ?,
    log_moderation_events = ?,
    log_automod_events = ?,
    automod_enabled = ?,
    block_links = ?,
    block_invites = ?,
    max_mentions = ?,
    automod_mute_enabled = ?,
    automod_mute_threshold = ?,
    automod_mute_window_minutes = ?,
    automod_mute_duration_minutes = ?,
    leveling_enabled = ?,
    updated_at = CURRENT_TIMESTAMP
    WHERE guild_id = ?`).run(
    next.prefix,
    next.welcome_enabled ? 1 : 0,
    next.welcome_channel_id,
    next.leave_enabled ? 1 : 0,
    next.leave_channel_id,
    next.join_message,
    next.leave_message,
    next.autorole_enabled ? 1 : 0,
    next.autorole_role_id,
    next.logging_enabled ? 1 : 0,
    next.moderation_log_channel_id,
    next.log_member_events ? 1 : 0,
    next.log_message_edits ? 1 : 0,
    next.log_message_deletes ? 1 : 0,
    next.log_voice_events ? 1 : 0,
    next.log_moderation_events ? 1 : 0,
    next.log_automod_events ? 1 : 0,
    next.automod_enabled ? 1 : 0,
    next.block_links ? 1 : 0,
    next.block_invites ? 1 : 0,
    Number(next.max_mentions || 5),
    next.automod_mute_enabled ? 1 : 0,
    Number(next.automod_mute_threshold || 5),
    Number(next.automod_mute_window_minutes || 10),
    Number(next.automod_mute_duration_minutes || 15),
    next.leveling_enabled ? 1 : 0,
    guildId
  );
  return getGuildSettings(guildId);
}

export function listAutomodTerms(guildId) {
  return db.prepare('SELECT term FROM automod_terms WHERE guild_id = ? ORDER BY term ASC').all(guildId).map((r) => r.term);
}
export function addAutomodTerm(guildId, term) {
  db.prepare('INSERT OR IGNORE INTO automod_terms (guild_id, term) VALUES (?, ?)').run(guildId, term.trim().toLowerCase());
  return listAutomodTerms(guildId);
}
export function removeAutomodTerm(guildId, term) {
  db.prepare('DELETE FROM automod_terms WHERE guild_id = ? AND term = ?').run(guildId, term.trim().toLowerCase());
  return listAutomodTerms(guildId);
}

export function recordAutomodRemoval(guildId, userId) {
  db.prepare('INSERT INTO automod_violations (guild_id, user_id) VALUES (?, ?)').run(guildId, userId);
}
export function countRecentAutomodRemovals(guildId, userId, windowMinutes) {
  return db.prepare(`SELECT COUNT(*) as total FROM automod_violations
    WHERE guild_id = ? AND user_id = ? AND created_at >= datetime('now', ?)`)
    .get(guildId, userId, `-${windowMinutes} minutes`).total;
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
  db.prepare('UPDATE leveling SET xp = ?, level = ? WHERE guild_id = ? AND user_id = ?').run(xp, nextLevel, guildId, userId);
  return { levelUp, level: nextLevel, xp };
}

export function getLeaderboard(guildId, limit = 10) {
  return db.prepare('SELECT * FROM leveling WHERE guild_id = ? ORDER BY xp DESC LIMIT ?').all(guildId, limit);
}
