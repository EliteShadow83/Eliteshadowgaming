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
  giveaway_embed_title: '🎉 Giveaway',
  giveaway_embed_description: 'Prize: **{prize}**\nWinners: **{winners}**\nEnds: {ends_at}\n\nClick the button below to enter.',
  giveaway_embed_color: '#F1C40F',
  giveaway_embed_footer: 'Hosted by {host_tag}',
  giveaway_embed_image_url: null,
  giveaway_embed_thumbnail_url: null,
  giveaway_button_label: 'Enter Giveaway',
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
      giveaway_embed_title, giveaway_embed_description, giveaway_embed_color, giveaway_embed_footer, giveaway_embed_image_url, giveaway_embed_thumbnail_url, giveaway_button_label,
      automod_enabled, block_links, block_invites, max_mentions,
      automod_mute_enabled, automod_mute_threshold, automod_mute_window_minutes, automod_mute_duration_minutes,
      leveling_enabled
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
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
        defaultSettings.giveaway_embed_title,
        defaultSettings.giveaway_embed_description,
        defaultSettings.giveaway_embed_color,
        defaultSettings.giveaway_embed_footer,
        defaultSettings.giveaway_embed_image_url,
        defaultSettings.giveaway_embed_thumbnail_url,
        defaultSettings.giveaway_button_label,
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
    giveaway_embed_title = ?,
    giveaway_embed_description = ?,
    giveaway_embed_color = ?,
    giveaway_embed_footer = ?,
    giveaway_embed_image_url = ?,
    giveaway_embed_thumbnail_url = ?,
    giveaway_button_label = ?,
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
    next.giveaway_embed_title || defaultSettings.giveaway_embed_title,
    next.giveaway_embed_description || defaultSettings.giveaway_embed_description,
    next.giveaway_embed_color || defaultSettings.giveaway_embed_color,
    next.giveaway_embed_footer || defaultSettings.giveaway_embed_footer,
    next.giveaway_embed_image_url || null,
    next.giveaway_embed_thumbnail_url || null,
    next.giveaway_button_label || defaultSettings.giveaway_button_label,
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
    return { levelUp: false, level: 1, xp: amount, previousLevel: 1 };
  }
  const xp = existing.xp + amount;
  const nextLevel = Math.floor(0.1 * Math.sqrt(xp)) + 1;
  const levelUp = nextLevel > existing.level;
  db.prepare('UPDATE leveling SET xp = ?, level = ? WHERE guild_id = ? AND user_id = ?').run(xp, nextLevel, guildId, userId);
  return { levelUp, level: nextLevel, xp, previousLevel: existing.level };
}

export function getLeaderboard(guildId, limit = 10) {
  return db.prepare('SELECT * FROM leveling WHERE guild_id = ? ORDER BY xp DESC LIMIT ?').all(guildId, limit);
}


export function listLevelRoleRewards(guildId) {
  return db.prepare('SELECT * FROM level_role_rewards WHERE guild_id = ? ORDER BY level ASC').all(guildId);
}

export function upsertLevelRoleReward(guildId, { level, roleId, rewardMessage = null }) {
  const normalizedLevel = Math.max(1, Number(level || 1));
  const normalizedRoleId = String(roleId || '').trim();
  if (!normalizedRoleId) throw new Error('role_id is required');

  db.prepare(`INSERT INTO level_role_rewards (guild_id, level, role_id, reward_message)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id, level)
    DO UPDATE SET role_id = excluded.role_id, reward_message = excluded.reward_message, updated_at = CURRENT_TIMESTAMP`)
    .run(guildId, normalizedLevel, normalizedRoleId, rewardMessage || null);

  return listLevelRoleRewards(guildId);
}

export function removeLevelRoleReward(guildId, level) {
  db.prepare('DELETE FROM level_role_rewards WHERE guild_id = ? AND level = ?').run(guildId, Math.max(1, Number(level || 1)));
  return listLevelRoleRewards(guildId);
}

export function listLevelRoleRewardsInRange(guildId, minLevel, maxLevel) {
  return db.prepare('SELECT * FROM level_role_rewards WHERE guild_id = ? AND level > ? AND level <= ? ORDER BY level ASC')
    .all(guildId, Number(minLevel || 0), Number(maxLevel || 0));
}
