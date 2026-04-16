import { ChannelType, EmbedBuilder } from 'discord.js';
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
      await interaction.reply({ content: 'You need Manage Server permission.', flags: 64 });
      return;
    }

    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const supportRole = interaction.options.getRole('support_role');
    const category = interaction.options.getChannel('category');

    if (!targetChannel?.isTextBased()) {
      await interaction.reply({ content: 'Please provide a text channel.', flags: 64 });
      return;
    }
    if (category && category.type !== ChannelType.GuildCategory) {
      await interaction.reply({ content: 'Category must be a category channel.', flags: 64 });
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
      .setDescription('React with 🎫 to open a private support ticket.')
      .setColor('#5865F2');
    const panel = await targetChannel.send({ embeds: [embed] });
    await panel.react('🎫').catch(() => null);
    await interaction.reply({ content: `Ticket panel posted in ${targetChannel}.`, flags: 64 });
  }
};
