import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import {
  claimTicketRecord,
  closeTicketRecord,
  createTicketChannel,
  getOpenTicketForUser,
  getTicketByChannel,
  getTicketSettings
} from '../../services/ticketing.js';

const OPEN_ID = 'tickets:open';
const CLAIM_ID = 'tickets:claim';
const CLOSE_ID = 'tickets:close';

export async function handleTicketButton(interaction) {
  if (!interaction.guild) return;

  if (interaction.customId === OPEN_ID || interaction.customId === 'ticket_open') {
    console.log(`[tickets] request received guild=${interaction.guildId} user=${interaction.user.id}`);
    const existing = getOpenTicketForUser(interaction.guildId, interaction.user.id);
    if (existing) {
      console.log(`[tickets] request blocked (existing open) guild=${interaction.guildId} user=${interaction.user.id} channel=${existing.channel_id}`);
      await interaction.reply({ content: `You already have an open ticket: <#${existing.channel_id}>`, ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const { ticketChannel, settings } = await createTicketChannel({ guild: interaction.guild, user: interaction.user });

      const controls = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(CLAIM_ID).setLabel('Claim Ticket').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(CLOSE_ID).setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
      );

      const supportPing = settings.support_role_id ? `<@&${settings.support_role_id}> ` : '';
      await ticketChannel.send({
        content: `${supportPing}Hello ${interaction.user}, thanks for opening a ticket. Staff will help you here.`,
        components: [controls],
        allowedMentions: { roles: settings.support_role_id ? [settings.support_role_id] : [] }
      });

      console.log(`[tickets] created guild=${interaction.guildId} user=${interaction.user.id} channel=${ticketChannel.id}`);
      await interaction.editReply({ content: `✅ Ticket created: ${ticketChannel}` });
    } catch (err) {
      console.error(`[tickets] create failed guild=${interaction.guildId} user=${interaction.user.id}`, err);
      await interaction.editReply({ content: err.message || 'Unable to create ticket right now.' }).catch(() => null);
    }

    return;
  }

  if (interaction.customId === CLAIM_ID || interaction.customId === 'ticket_claim') {
    const ticket = getTicketByChannel(interaction.channelId);
    if (!ticket || ticket.status !== 'open') {
      await interaction.reply({ content: 'This is not an open ticket channel.', ephemeral: true });
      return;
    }

    const settings = getTicketSettings(interaction.guildId);
    const hasSupportRole = settings.support_role_id && interaction.member?.roles?.cache?.has(settings.support_role_id);
    const canClaim = hasSupportRole || interaction.memberPermissions?.has('ManageChannels');

    if (!canClaim) {
      await interaction.reply({ content: 'Only support staff can claim tickets.', ephemeral: true });
      return;
    }

    if (ticket.claimed_by_user_id) {
      await interaction.reply({ content: `Ticket already claimed by <@${ticket.claimed_by_user_id}>.`, ephemeral: true });
      return;
    }

    claimTicketRecord(interaction.channelId, interaction.user.id);
    await interaction.reply(`✅ Ticket claimed by ${interaction.user}.`);
    return;
  }

  if (interaction.customId === CLOSE_ID || interaction.customId === 'ticket_close') {
    const ticket = getTicketByChannel(interaction.channelId);
    if (!ticket || ticket.status !== 'open') {
      await interaction.reply({ content: 'This is not an open ticket channel.', ephemeral: true });
      return;
    }

    const settings = getTicketSettings(interaction.guildId);
    const isOwner = ticket.owner_user_id === interaction.user.id;
    const hasSupportRole = settings.support_role_id && interaction.member?.roles?.cache?.has(settings.support_role_id);
    const canClose = interaction.memberPermissions?.has('ManageChannels') || hasSupportRole || (settings.opener_can_close && isOwner);

    if (!canClose) {
      await interaction.reply({ content: 'You do not have permission to close this ticket.', ephemeral: true });
      return;
    }

    await interaction.reply('Closing ticket in 3 seconds...');

    closeTicketRecord(interaction.channelId, interaction.user.id);
    console.log(`[tickets] closing guild=${interaction.guildId} channel=${interaction.channelId} closed_by=${interaction.user.id}`);
    setTimeout(() => {
      interaction.channel.delete('Ticket closed').catch(() => null);
    }, 3000);
  }
}

export function getTicketButtonIds() {
  return { OPEN_ID, CLAIM_ID, CLOSE_ID };
}
