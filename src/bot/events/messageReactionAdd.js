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

async function ensureReactionObject(reaction) {
  if (reaction.partial) {
    await reaction.fetch().catch(() => null);
  }
  return reaction.message;
}

export async function onMessageReactionAdd(reaction, user) {
  if (!user || user.bot) return;

  const message = await ensureReactionObject(reaction);
  if (!message?.guild) return;

  const emoji = reaction.emoji?.name;
  if (!emoji) return;

  if (emoji === OPEN_EMOJI && message.author?.id === message.client.user.id) {
    const title = message.embeds?.[0]?.title || '';
    if (title !== 'Support Tickets') return;

    const existing = getOpenTicketForUser(message.guild.id, user.id);
    if (existing) {
      await user.send(`You already have an open ticket in **${message.guild.name}**: <#${existing.channel_id}>`).catch(() => null);
      return;
    }

    try {
      const { ticketChannel, settings } = await createTicketChannel({ guild: message.guild, user });
      const supportPing = settings.support_role_id ? `<@&${settings.support_role_id}> ` : '';
      const controlMessage = await ticketChannel.send({
        content: `${supportPing}Hello <@${user.id}>, thanks for opening a ticket.\nReact with ${CLAIM_EMOJI} to claim and ${CLOSE_EMOJI} to close.`,
        allowedMentions: { users: [user.id], roles: settings.support_role_id ? [settings.support_role_id] : [] }
      });

      await controlMessage.react(CLAIM_EMOJI).catch(() => null);
      await controlMessage.react(CLOSE_EMOJI).catch(() => null);
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
    if (!hasSupportRole && !member.permissions.has('ManageChannels')) return;
    if (ticket.claimed_by_user_id) return;

    claimTicketRecord(message.channelId, user.id);
    await message.channel.send(`✅ Ticket claimed by <@${user.id}>.`).catch(() => null);
    return;
  }

  const isOwner = ticket.owner_user_id === user.id;
  const canClose = member.permissions.has('ManageChannels') || hasSupportRole || (settings.opener_can_close && isOwner);
  if (!canClose) return;

  closeTicketRecord(message.channelId, user.id);
  await message.channel.send(`🔒 Ticket closed by <@${user.id}>. Deleting in 3 seconds...`).catch(() => null);
  console.log(`[tickets] closing via emoji guild=${message.guild.id} channel=${message.channelId} closed_by=${user.id}`);

  setTimeout(() => {
    message.channel.delete('Ticket closed').catch(() => null);
  }, 3000);
}
