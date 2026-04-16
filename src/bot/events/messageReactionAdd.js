import { AttachmentBuilder } from 'discord.js';
import {
  claimTicketRecord,
  closeTicketRecord,
  createTicketChannel,
  getOpenTicketForUser,
  getTicketByChannel,
  getTicketSettings
} from '../../services/ticketing.js';

const OPEN_EMOJI = '🎫';
const CLAIM_EMOJI = '✅';
const CLOSE_EMOJI = '🔒';
const TRANSCRIPT_FETCH_BATCH = 100;
const TRANSCRIPT_FETCH_LIMIT = 1000;

async function resolveReactionMessage(reaction) {
  if (reaction.partial) {
    await reaction.fetch().catch(() => null);
  }
  return reaction.message;
}

async function removeMemberReaction(reaction, user) {
  if (!reaction?.users?.remove || !user?.id) return;
  await reaction.users.remove(user.id).catch(() => null);
}

function formatTranscriptLine(message) {
  const timestamp = message.createdAt?.toISOString?.() || new Date().toISOString();
  const author = message.author?.tag || message.author?.username || message.author?.id || 'unknown-user';
  const content = message.content?.trim() || '';
  const attachmentUrls = message.attachments?.size
    ? ` attachments=${[...message.attachments.values()].map((a) => a.url).join(',')}`
    : '';
  const stickerNames = message.stickers?.size
    ? ` stickers=${[...message.stickers.values()].map((s) => s.name).join(',')}`
    : '';
  const embedSummary = message.embeds?.length ? ` embeds=${message.embeds.length}` : '';
  return `[${timestamp}] ${author}: ${content || '(no text)'}${attachmentUrls}${stickerNames}${embedSummary}`;
}

async function buildTicketTranscript(channel) {
  let before;
  let fetchedCount = 0;
  const collected = [];

  while (fetchedCount < TRANSCRIPT_FETCH_LIMIT) {
    const remaining = TRANSCRIPT_FETCH_LIMIT - fetchedCount;
    const batchSize = Math.min(TRANSCRIPT_FETCH_BATCH, remaining);
    const batch = await channel.messages.fetch({ limit: batchSize, ...(before ? { before } : {}) }).catch(() => null);
    if (!batch || batch.size === 0) break;

    const messages = [...batch.values()];
    collected.push(...messages);
    fetchedCount += messages.length;
    before = messages[messages.length - 1]?.id;
    if (!before || messages.length < batchSize) break;
  }

  collected.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  if (!collected.length) return 'No messages found in ticket before closure.';

  return collected.map(formatTranscriptLine).join('\n');
}

async function sendTicketTranscript({ guild, settings, ticket, ticketChannel, closerUserId }) {
  if (!settings.transcript_log_channel_id) return;

  const logChannel = await guild.channels.fetch(settings.transcript_log_channel_id).catch(() => null);
  if (!logChannel?.isTextBased?.()) return;

  const transcriptText = await buildTicketTranscript(ticketChannel);
  const transcriptFile = new AttachmentBuilder(
    Buffer.from(transcriptText, 'utf8'),
    { name: `ticket-${ticket.id || ticketChannel.id}-transcript.txt` }
  );

  const header = `📄 Transcript for ${ticketChannel} | owner: <@${ticket.owner_user_id}> | closed by: <@${closerUserId}>`;
  const transcriptMessage = await logChannel.send({ content: header }).catch(() => null);
  if (!transcriptMessage) return;

  const threadName = `ticket-${ticket.id || ticketChannel.id}`;
  const thread = await transcriptMessage.startThread({
    name: threadName.slice(0, 100),
    autoArchiveDuration: 1440,
    reason: 'Ticket transcript archive'
  }).catch(() => null);

  if (thread?.isTextBased?.()) {
    await thread.send({
      content: `Ticket channel: ${ticket.channel_id}\nCreated: ${ticket.created_at || 'unknown'}\nClosed: ${new Date().toISOString()}`,
      files: [transcriptFile]
    }).catch(() => null);
    return;
  }

  await logChannel.send({ files: [transcriptFile] }).catch(() => null);
}

export async function onMessageReactionAdd(reaction, user) {
  if (!user || user.bot) return;

  const message = await resolveReactionMessage(reaction);
  if (!message?.guild) return;

  const emoji = reaction.emoji?.name;
  if (!emoji) return;

  if (emoji === OPEN_EMOJI) {
    if (message.author?.id !== message.client.user.id) return;
    if ((message.embeds?.[0]?.title || '') !== 'Support Tickets') return;

    const existing = getOpenTicketForUser(message.guild.id, user.id);
    if (existing) {
      await user.send(`You already have an open ticket in **${message.guild.name}**: <#${existing.channel_id}>`).catch(() => null);
      await removeMemberReaction(reaction, user);
      return;
    }

    try {
      const { ticketChannel, settings } = await createTicketChannel({ guild: message.guild, user });
      const supportPing = settings.support_role_id ? `<@&${settings.support_role_id}> ` : '';
      const controls = await ticketChannel.send({
        content: `${supportPing}Hello <@${user.id}>, thanks for opening a ticket. Staff will help you here.\nReact with ${CLAIM_EMOJI} to claim and ${CLOSE_EMOJI} to close.`,
        allowedMentions: { users: [user.id], roles: settings.support_role_id ? [settings.support_role_id] : [] }
      });
      await controls.react(CLAIM_EMOJI).catch(() => null);
      await controls.react(CLOSE_EMOJI).catch(() => null);
      await removeMemberReaction(reaction, user);

      console.log(`[tickets] created via emoji guild=${message.guild.id} user=${user.id} channel=${ticketChannel.id}`);
    } catch (err) {
      console.error(`[tickets] emoji create failed guild=${message.guild.id} user=${user.id}`, err);
    }
    return;
  }

  if (emoji !== CLAIM_EMOJI && emoji !== CLOSE_EMOJI) return;

  const ticket = getTicketByChannel(message.channelId);
  if (!ticket || ticket.status !== 'open') return;

  const member = await message.guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  const settings = getTicketSettings(message.guild.id);
  const hasSupportRole = settings.support_role_id && member.roles.cache.has(settings.support_role_id);

  if (emoji === CLAIM_EMOJI) {
    const isOwner = ticket.owner_user_id === user.id;
    const canClaim = hasSupportRole || member.permissions.has('ManageChannels') || isOwner;
    if (!canClaim) return;
    if (ticket.claimed_by_user_id) return;

    claimTicketRecord(message.channelId, user.id);
    await message.channel.send(`✅ Ticket claimed by <@${user.id}>.`).catch(() => null);
    await removeMemberReaction(reaction, user);
    return;
  }

  const isOwner = ticket.owner_user_id === user.id;
  const canClose = member.permissions.has('ManageChannels') || hasSupportRole || (settings.opener_can_close && isOwner);
  if (!canClose) return;

  await sendTicketTranscript({
    guild: message.guild,
    settings,
    ticket,
    ticketChannel: message.channel,
    closerUserId: user.id
  });

  closeTicketRecord(message.channelId, user.id);
  await message.channel.send(`🔒 Ticket closed by <@${user.id}>. Deleting in 3 seconds...`).catch(() => null);
  await removeMemberReaction(reaction, user);
  console.log(`[tickets] closing via emoji guild=${message.guild.id} channel=${message.channelId} closed_by=${user.id}`);

  setTimeout(() => {
    message.channel.delete('Ticket closed').catch(() => null);
  }, 3000);
}
