import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { updateTicketSettings } from '../../services/ticketing.js';

export const ticketPanelCommand = {
  data: {
    name: 'ticketpanel',
    description: 'Post a ticket panel in a channel',
    options: [
      { name: 'channel', description: 'Channel to post the panel', type: 7, required: false },
      { name: 'support_role', description: 'Role that can access tickets', type: 8, required: false },
      { name: 'category', description: 'Category where ticket channels are created', type: 7, required: false }
    ]
  },
  async execute(interaction) {
    if (!interaction.memberPermissions?.has('ManageGuild')) {
      await interaction.reply({ content: 'You need Manage Server permission.', ephemeral: true });
      return;
    }

    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const supportRole = interaction.options.getRole('support_role');
    const category = interaction.options.getChannel('category');

    if (!targetChannel?.isTextBased()) {
      await interaction.reply({ content: 'Please provide a text channel.', ephemeral: true });
      return;
    }

    updateTicketSettings(interaction.guildId, {
      panel_channel_id: targetChannel.id,
      support_role_id: supportRole?.id ?? null,
      category_channel_id: category?.id ?? null,
      enabled: 1
    });

    const embed = new EmbedBuilder()
      .setTitle('Support Tickets')
      .setDescription('Click **Open Ticket** to create a private support channel with staff.')
      .setColor('#5865F2');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_open').setLabel('Open Ticket').setStyle(ButtonStyle.Primary)
    );

    await targetChannel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `Ticket panel posted in ${targetChannel}.`, ephemeral: true });
  }
};
