import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import {
  claimTicketRecord,
  closeTicketRecord,
  createTicketChannel,
  getOpenTicketForUser,
  getTicketByChannel,
  getTicketSettings
} from '../../services/ticketing.js';

export async function handleTicketButton(interaction) {
  if (!interaction.guild) return;

  if (interaction.customId === 'ticket_open') {
    const existing = getOpenTicketForUser(interaction.guildId, interaction.user.id);
    if (existing) {
      await interaction.reply({ content: `You already have an open ticket: <#${existing.channel_id}>`, ephemeral: true });
      return;
    }

    try {
      const { ticketChannel, settings } = await createTicketChannel({ guild: interaction.guild, user: interaction.user });
      const controls = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim Ticket').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
      );

      const supportPing = settings.support_role_id ? `<@&${settings.support_role_id}> ` : '';
      await ticketChannel.send({
        content: `${supportPing}Hello ${interaction.user}, our team will help you here. Use the buttons below to claim/close.`,
        components: [controls],
        allowedMentions: { roles: settings.support_role_id ? [settings.support_role_id] : [] }
      });

      await interaction.reply({ content: `Ticket created: ${ticketChannel}`, ephemeral: true });
    } catch (err) {
      await interaction.reply({ content: err.message || 'Unable to create ticket right now.', ephemeral: true });
    }

    return;
  }

  if (interaction.customId === 'ticket_claim') {
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

  if (interaction.customId === 'ticket_close') {
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

    closeTicketRecord(interaction.channelId, interaction.user.id);
    await interaction.reply('Closing ticket in 3 seconds...');
    setTimeout(() => {
      interaction.channel.delete('Ticket closed').catch(() => null);
    }, 3000);
  }
}
