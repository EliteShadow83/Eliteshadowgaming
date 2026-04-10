import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { closeTicketRecord, createTicketChannel, getOpenTicketForUser } from '../../services/ticketing.js';

export async function handleTicketButton(interaction) {
  if (!interaction.guild) return;

  if (interaction.customId === 'ticket_open') {
    const existing = getOpenTicketForUser(interaction.guildId, interaction.user.id);
    if (existing) {
      await interaction.reply({ content: `You already have an open ticket: <#${existing.channel_id}>`, ephemeral: true });
      return;
    }

    try {
      const channel = await createTicketChannel({ guild: interaction.guild, user: interaction.user });
      const controls = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `Hello ${interaction.user}, our team will help you here. When resolved, click **Close Ticket**.`,
        components: [controls]
      });

      await interaction.reply({ content: `Ticket created: ${channel}`, ephemeral: true });
    } catch (err) {
      await interaction.reply({ content: err.message || 'Unable to create ticket right now.', ephemeral: true });
    }

    return;
  }

  if (interaction.customId === 'ticket_close') {
    if (!interaction.memberPermissions?.has('ManageChannels')) {
      await interaction.reply({ content: 'You need Manage Channels permission to close tickets.', ephemeral: true });
      return;
    }

    closeTicketRecord(interaction.channelId, interaction.user.id);
    await interaction.reply('Closing ticket in 3 seconds...');
    setTimeout(() => {
      interaction.channel.delete('Ticket closed by staff').catch(() => null);
    }, 3000);
  }
}
