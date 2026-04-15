import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

const activeGiveaways = new Map();

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = (minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1);
  return `${hours} hour${hours === '1' ? '' : 's'}`;
}

function pickWinners(entries, count) {
  const pool = [...entries];
  const winners = [];

  while (pool.length && winners.length < count) {
    const idx = Math.floor(Math.random() * pool.length);
    winners.push(pool[idx]);
    pool.splice(idx, 1);
  }

  return winners;
}

async function finalizeGiveaway(client, giveaway) {
  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
  if (!message) return;

  const winners = pickWinners(giveaway.entries, giveaway.winnerCount);
  const endedEmbed = EmbedBuilder.from(message.embeds[0])
    .setTitle('🎉 Giveaway Ended')
    .setColor('#2ECC71')
    .setFooter({ text: `Ended • ${giveaway.entries.size} entr${giveaway.entries.size === 1 ? 'y' : 'ies'}` });

  const disabledButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('giveaway_closed').setLabel('Giveaway Ended').setStyle(ButtonStyle.Secondary).setDisabled(true)
  );

  await message.edit({ embeds: [endedEmbed], components: [disabledButton] }).catch(() => null);

  if (!winners.length) {
    await channel.send(`No valid entries for **${giveaway.prize}**. Giveaway ended with no winners.`);
    return;
  }

  const winnerMentions = winners.map((id) => `<@${id}>`).join(', ');
  await channel.send(`🎉 Congratulations ${winnerMentions}! You won **${giveaway.prize}**.`);
}

export function handleGiveawayButton(interaction) {
  const [prefix, messageId] = interaction.customId.split(':');
  if (prefix !== 'giveaway_enter' || !messageId) return false;

  const giveaway = activeGiveaways.get(messageId);
  if (!giveaway) {
    interaction.reply({ content: 'This giveaway is no longer active.', ephemeral: true }).catch(() => null);
    return true;
  }

  giveaway.entries.add(interaction.user.id);
  interaction.reply({ content: `✅ You entered **${giveaway.prize}**. Good luck!`, ephemeral: true }).catch(() => null);
  return true;
}

export const giveawayCommand = {
  data: {
    name: 'giveaway',
    description: 'Create a giveaway users can enter with one click',
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

    const embed = new EmbedBuilder()
      .setColor('#F1C40F')
      .setTitle('🎉 Giveaway')
      .setDescription(`Prize: **${prize}**\nWinners: **${winnerCount}**\nEnds: <t:${Math.floor(endsAt.getTime() / 1000)}:R>`)
      .setFooter({ text: `Hosted by ${interaction.user.tag}` })
      .setTimestamp();

    const message = await targetChannel.send({
      embeds: [embed],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('giveaway_enter:pending').setLabel('Enter Giveaway').setStyle(ButtonStyle.Success)
        )
      ]
    });

    const activeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`giveaway_enter:${message.id}`).setLabel('Enter Giveaway').setStyle(ButtonStyle.Success)
    );

    await message.edit({ components: [activeRow] });

    activeGiveaways.set(message.id, {
      messageId: message.id,
      channelId: message.channelId,
      guildId: interaction.guildId,
      prize,
      winnerCount,
      entries: new Set(),
      endsAt
    });

    setTimeout(async () => {
      const giveaway = activeGiveaways.get(message.id);
      activeGiveaways.delete(message.id);
      if (!giveaway) return;
      await finalizeGiveaway(interaction.client, giveaway);
    }, durationMinutes * 60 * 1000);

    await interaction.reply({
      content: `Giveaway started in ${targetChannel} for **${prize}**. Ends in ${formatDuration(durationMinutes)}.`,
      ephemeral: true
    });
  }
};
