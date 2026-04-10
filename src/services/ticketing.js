import { ChannelType, PermissionFlagsBits } from 'discord.js';
import db from './db.js';

export function getTicketSettings(guildId) {
  const row = db.prepare('SELECT * FROM ticket_settings WHERE guild_id = ?').get(guildId);
  if (row) return row;

  db.prepare('INSERT INTO ticket_settings (guild_id, enabled) VALUES (?, 1)').run(guildId);
  return db.prepare('SELECT * FROM ticket_settings WHERE guild_id = ?').get(guildId);
}

export function updateTicketSettings(guildId, patch) {
  const current = getTicketSettings(guildId);
  const next = { ...current, ...patch };
  db.prepare(`UPDATE ticket_settings SET
    enabled = ?,
    panel_channel_id = ?,
    category_channel_id = ?,
    support_role_id = ?,
    transcript_log_channel_id = ?,
    updated_at = CURRENT_TIMESTAMP
    WHERE guild_id = ?`).run(
    next.enabled ? 1 : 0,
    next.panel_channel_id,
    next.category_channel_id,
    next.support_role_id,
    next.transcript_log_channel_id,
    guildId
  );
  return getTicketSettings(guildId);
}

export function getOpenTicketForUser(guildId, userId) {
  return db.prepare('SELECT * FROM tickets WHERE guild_id = ? AND owner_user_id = ? AND status = ?').get(guildId, userId, 'open');
}

export function createTicketRecord({ guildId, channelId, ownerUserId }) {
  db.prepare('INSERT INTO tickets (guild_id, channel_id, owner_user_id, status) VALUES (?, ?, ?, ?)')
    .run(guildId, channelId, ownerUserId, 'open');
}

export function closeTicketRecord(channelId, closerUserId) {
  db.prepare('UPDATE tickets SET status = ?, closed_by_user_id = ?, closed_at = CURRENT_TIMESTAMP WHERE channel_id = ? AND status = ?')
    .run('closed', closerUserId, channelId, 'open');
}

export async function createTicketChannel({ guild, user }) {
  const settings = getTicketSettings(guild.id);
  if (!settings.enabled) throw new Error('Ticketing is disabled for this server.');

  const duplicate = getOpenTicketForUser(guild.id, user.id);
  if (duplicate) throw new Error('You already have an open ticket.');

  const channelName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 18) || 'user'}`;

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: settings.category_channel_id || null,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      ...(settings.support_role_id ? [{ id: settings.support_role_id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : [])
    ]
  });

  createTicketRecord({ guildId: guild.id, channelId: ticketChannel.id, ownerUserId: user.id });
  return ticketChannel;
}
