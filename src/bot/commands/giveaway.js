import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { createGiveaway, setGiveawayMessageId } from '../../services/giveaways.js';
import { getGuildSettings } from '../../services/guildSettings.js';

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = (minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1);
  return `${hours} hour${hours === '1' ? '' : 's'}`;
}

export const giveawayCommand = {
  data: {
    name: 'giveaway',
    description: 'Create a giveaway users can enter with a button',
    options: [
      { name: 'prize', description: 'What are you giving away?', type: 3, required: true },
      { name: 'duration_minutes', description: 'How long until it ends?', type: 4, required: true },
      { name: 'winner_count', description: 'Number of winners', type: 4, required: false },
      { name: 'channel', description: 'Where the giveaway should be posted', type: 7, required: false }
    ]
  },
  async execute(interaction) {
    if (!interaction.memberPermissions?.has('ManageGuild')) {
      await interaction.reply({ content: 'You need Manage Server permission.', ephemeral: true });
      return;
    }

    const prize = interaction.options.getString('prize', true);
    const durationMinutes = interaction.options.getInteger('duration_minutes', true);
    const winnerCount = Math.max(1, interaction.options.getInteger('winner_count') || 1);
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    if (!targetChannel?.isTextBased()) {
      await interaction.reply({ content: 'Please provide a text channel.', ephemeral: true });
      return;
    }

    if (durationMinutes < 1 || durationMinutes > 10080) {
      await interaction.reply({ content: 'Duration must be between 1 and 10080 minutes (7 days).', ephemeral: true });
      return;
    }

    const endsAt = new Date(Date.now() + durationMinutes * 60 * 1000);
    const settings = getGuildSettings(interaction.guildId);
    const endsAtDiscord = `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`;

    const giveaway = createGiveaway({
      guildId: interaction.guildId,
      channelId: targetChannel.id,
      hostUserId: interaction.user.id,
      prize,
      winnerCount,
      endsAt
    });

    const title = (settings.giveaway_embed_title || '🎉 Giveaway')
      .replaceAll('{prize}', prize)
      .replaceAll('{winners}', String(winnerCount))
      .replaceAll('{ends_at}', endsAtDiscord)
      .replaceAll('{host_tag}', interaction.user.tag);

    const description = (settings.giveaway_embed_description || 'Prize: **{prize}**\nWinners: **{winners}**\nEnds: {ends_at}\n\nClick the button below to enter.')
      .replaceAll('{prize}', prize)
      .replaceAll('{winners}', String(winnerCount))
      .replaceAll('{ends_at}', endsAtDiscord)
      .replaceAll('{host_tag}', interaction.user.tag);

    const footer = (settings.giveaway_embed_footer || 'Hosted by {host_tag}')
      .replaceAll('{prize}', prize)
      .replaceAll('{winners}', String(winnerCount))
      .replaceAll('{ends_at}', endsAtDiscord)
      .replaceAll('{host_tag}', interaction.user.tag);

    const embed = new EmbedBuilder()
      .setColor(settings.giveaway_embed_color || '#F1C40F')
      .setTitle(title.slice(0, 256))
      .setDescription(description.slice(0, 4096))
      .setFooter({ text: footer.slice(0, 2048) })
      .setTimestamp();
    if (settings.giveaway_embed_image_url) embed.setImage(settings.giveaway_embed_image_url);
    if (settings.giveaway_embed_thumbnail_url) embed.setThumbnail(settings.giveaway_embed_thumbnail_url);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`giveaway_enter:${giveaway.id}`)
        .setLabel((settings.giveaway_button_label || 'Enter Giveaway').slice(0, 80))
        .setStyle(ButtonStyle.Success)
    );

    const message = await targetChannel.send({ embeds: [embed], components: [row] });
    setGiveawayMessageId(giveaway.id, message.id);

    await interaction.reply({
      content: `Giveaway started in ${targetChannel} for **${prize}**. Ends in ${formatDuration(durationMinutes)}.`,
      ephemeral: true
    });
  }
};
