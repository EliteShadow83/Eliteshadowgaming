import db from './db.js';

const defaultSettings = {
  enabled: 0,
  lobby_channel_id: null,
  category_channel_id: null,
  channel_name_template: '{user}\'s VC'
};

export function getVcManagerSettings(guildId) {
  const row = db.prepare('SELECT * FROM vc_manager_settings WHERE guild_id = ?').get(guildId);
  if (row) return row;

  db.prepare(`INSERT INTO vc_manager_settings (
    guild_id, enabled, lobby_channel_id, category_channel_id, channel_name_template
  ) VALUES (?, ?, ?, ?, ?)`)
    .run(
      guildId,
      defaultSettings.enabled,
      defaultSettings.lobby_channel_id,
      defaultSettings.category_channel_id,
      defaultSettings.channel_name_template
    );

  return { guild_id: guildId, ...defaultSettings };
}

export function updateVcManagerSettings(guildId, patch) {
  const current = getVcManagerSettings(guildId);
  const next = { ...current, ...patch };

  db.prepare(`UPDATE vc_manager_settings SET
    enabled = ?,
    lobby_channel_id = ?,
    category_channel_id = ?,
    channel_name_template = ?,
    updated_at = CURRENT_TIMESTAMP
    WHERE guild_id = ?`)
    .run(
      next.enabled ? 1 : 0,
      next.lobby_channel_id,
      next.category_channel_id,
      next.channel_name_template || defaultSettings.channel_name_template,
      guildId
    );

  return getVcManagerSettings(guildId);
}

export function addTemporaryVoiceChannel(guildId, channelId, ownerUserId) {
  db.prepare('INSERT OR REPLACE INTO temp_voice_channels (guild_id, channel_id, owner_user_id) VALUES (?, ?, ?)')
    .run(guildId, channelId, ownerUserId);
}

export function getTemporaryVoiceChannel(channelId) {
  return db.prepare('SELECT * FROM temp_voice_channels WHERE channel_id = ?').get(channelId);
}

export function removeTemporaryVoiceChannel(channelId) {
  db.prepare('DELETE FROM temp_voice_channels WHERE channel_id = ?').run(channelId);
}
