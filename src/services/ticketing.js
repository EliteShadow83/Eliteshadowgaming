import { ChannelType, PermissionFlagsBits } from 'discord.js';
import db from './db.js';

const defaultTicketSettings = {
  enabled: 1,
  panel_channel_id: null,
  category_channel_id: null,
  support_role_id: null,
  transcript_log_channel_id: null,
  opener_can_close: 1
};

export function getTicketSettings(guildId) {
  const row = db.prepare('SELECT * FROM ticket_settings WHERE guild_id = ?').get(guildId);
  if (row) return row;

  db.prepare(`INSERT INTO ticket_settings (
    guild_id, enabled, panel_channel_id, category_channel_id, support_role_id, transcript_log_channel_id, opener_can_close
  ) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(
      guildId,
      defaultTicketSettings.enabled,
      defaultTicketSettings.panel_channel_id,
      defaultTicketSettings.category_channel_id,
      defaultTicketSettings.support_role_id,
      defaultTicketSettings.transcript_log_channel_id,
      defaultTicketSettings.opener_can_close
    );

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
    opener_can_close = ?,
    updated_at = CURRENT_TIMESTAMP
    WHERE guild_id = ?`)
    .run(
      next.enabled ? 1 : 0,
      next.panel_channel_id || null,
      next.category_channel_id || null,
      next.support_role_id || null,
      next.transcript_log_channel_id || null,
      next.opener_can_close ? 1 : 0,
      guildId
    );

  return getTicketSettings(guildId);
}

export function getOpenTicketForUser(guildId, userId) {
  return db.prepare("SELECT * FROM tickets WHERE guild_id = ? AND owner_user_id = ? AND status = 'open'").get(guildId, userId);
}

export function getTicketByChannel(channelId) {
  return db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channelId);
}

export function claimTicketRecord(channelId, claimerUserId) {
  db.prepare(`UPDATE tickets
    SET claimed_by_user_id = ?, claimed_at = CURRENT_TIMESTAMP
    WHERE channel_id = ? AND status = 'open' AND claimed_by_user_id IS NULL`)
    .run(claimerUserId, channelId);
  return getTicketByChannel(channelId);
}

export function closeTicketRecord(channelId, closerUserId) {
  db.prepare(`UPDATE tickets
    SET status = 'closed', closed_by_user_id = ?, closed_at = CURRENT_TIMESTAMP
    WHERE channel_id = ? AND status = 'open'`)
    .run(closerUserId, channelId);
}

function sanitizeTicketName(username) {
  const base = (username || 'user').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 18);
  return `ticket-${base || 'user'}`;
}

export async function createTicketChannel({ guild, user }) {
  const settings = getTicketSettings(guild.id);
  if (!settings.enabled) {
    throw new Error('Ticketing is disabled for this server.');
  }

  const existing = getOpenTicketForUser(guild.id, user.id);
  if (existing) {
    throw new Error(`You already have an open ticket: <#${existing.channel_id}>`);
  }

  const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (!botMember) {
    throw new Error('Bot member was not found in this server.');
  }

  const parentCategory = settings.category_channel_id
    ? await guild.channels.fetch(settings.category_channel_id).catch(() => null)
    : null;
  const parentId = parentCategory?.type === ChannelType.GuildCategory ? parentCategory.id : null;

  const supportRole = settings.support_role_id
    ? await guild.roles.fetch(settings.support_role_id).catch(() => null)
    : null;

  const channelName = sanitizeTicketName(user.username);

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: parentId,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: botMember.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages
        ]
      },
      {
        id: user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
      },
      ...(supportRole
        ? [{
          id: supportRole.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        }]
        : [])
    ],
    reason: `Support ticket opened by ${user.tag}`
  });

  db.prepare(`INSERT INTO tickets (guild_id, channel_id, owner_user_id, status)
    VALUES (?, ?, ?, 'open')`)
    .run(guild.id, ticketChannel.id, user.id);

  return { ticketChannel, settings };
}
