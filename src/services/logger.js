import { EmbedBuilder } from 'discord.js';
import { getGuildSettings } from './guildSettings.js';

const EVENT_FLAG_MAP = {
  member: 'log_member_events',
  message_delete: 'log_message_deletes',
  message_edit: 'log_message_edits',
  voice: 'log_voice_events',
  moderation: 'log_moderation_events',
  automod: 'log_automod_events'
};

export async function sendGuildLog({ guild, eventType, title, description, color = '#5865F2', fields = [] }) {
  if (!guild) return false;

  const settings = getGuildSettings(guild.id);
  if (!settings.logging_enabled || !settings.moderation_log_channel_id) return false;

  const flag = EVENT_FLAG_MAP[eventType];
  if (flag && !settings[flag]) return false;

  const channel = await guild.channels.fetch(settings.moderation_log_channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) return false;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();

  if (fields.length) {
    embed.addFields(fields.slice(0, 25));
  }

  await channel.send({ embeds: [embed] }).catch(() => null);
  return true;
}
