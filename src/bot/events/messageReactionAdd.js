import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createTicketChannel, getOpenTicketForUser } from '../../services/ticketing.js';
import { getTicketButtonIds } from '../interactions/tickets.js';

const OPEN_EMOJI = '🎫';

async function resolveReactionMessage(reaction) {
  if (reaction.partial) {
    await reaction.fetch().catch(() => null);
  }
  return reaction.message;
}

export async function onMessageReactionAdd(reaction, user) {
  if (!user || user.bot) return;

  const message = await resolveReactionMessage(reaction);
  if (!message?.guild) return;

  const emoji = reaction.emoji?.name;
  if (emoji !== OPEN_EMOJI) return;

  if (message.author?.id !== message.client.user.id) return;
  if ((message.embeds?.[0]?.title || '') !== 'Support Tickets') return;

  const existing = getOpenTicketForUser(message.guild.id, user.id);
  if (existing) {
    await user.send(`You already have an open ticket in **${message.guild.name}**: <#${existing.channel_id}>`).catch(() => null);
    return;
  }

  try {
    const { ticketChannel, settings } = await createTicketChannel({ guild: message.guild, user });
    const { CLAIM_ID, CLOSE_ID } = getTicketButtonIds();
    const controls = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(CLAIM_ID).setLabel('Claim Ticket').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(CLOSE_ID).setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
    );

    const supportPing = settings.support_role_id ? `<@&${settings.support_role_id}> ` : '';
    await ticketChannel.send({
      content: `${supportPing}Hello <@${user.id}>, thanks for opening a ticket. Staff will help you here.`,
      components: [controls],
      allowedMentions: { users: [user.id], roles: settings.support_role_id ? [settings.support_role_id] : [] }
    });

    console.log(`[tickets] created via emoji guild=${message.guild.id} user=${user.id} channel=${ticketChannel.id}`);
  } catch (err) {
    console.error(`[tickets] emoji create failed guild=${message.guild.id} user=${user.id}`, err);
  }
}
