import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import {
  addGiveawayEntry,
  getActiveGiveawayByMessageId,
  listDueActiveGiveaways,
  listGiveawayEntries,
  markGiveawayEnded
} from '../../services/giveaways.js';

let schedulerStarted = false;

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

async function closeGiveaway(client, giveaway) {
  const channel = await client.channels.fetch(giveaway.channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    markGiveawayEnded(giveaway.id, []);
    return;
  }

  const entries = listGiveawayEntries(giveaway.id);
  const winners = pickWinners(entries, Number(giveaway.winner_count || 1));

  if (giveaway.message_id) {
    const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
    if (message) {
      const endedEmbed = EmbedBuilder.from(message.embeds[0] || new EmbedBuilder())
        .setTitle('🎉 Giveaway Ended')
        .setColor('#2ECC71')
        .setFooter({ text: `Ended • ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}` });

      const disabledButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('giveaway_closed').setLabel('Giveaway Ended').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );

      await message.edit({ embeds: [endedEmbed], components: [disabledButton] }).catch(() => null);
    }
  }

  if (winners.length) {
    await channel.send(`🎉 Congratulations ${winners.map((id) => `<@${id}>`).join(', ')}! You won **${giveaway.prize}**.`).catch(() => null);
  } else {
    await channel.send(`No valid entries for **${giveaway.prize}**. Giveaway ended with no winners.`).catch(() => null);
  }

  markGiveawayEnded(giveaway.id, winners);
}

export async function handleGiveawayButton(interaction) {
  const [prefix, giveawayIdRaw] = interaction.customId.split(':');
  if (prefix !== 'giveaway_enter') return false;

  const giveawayId = Number(giveawayIdRaw);
  if (!Number.isFinite(giveawayId)) {
    await interaction.reply({ content: 'This giveaway button is invalid.', ephemeral: true }).catch(() => null);
    return true;
  }

  const giveaway = getActiveGiveawayByMessageId(interaction.message.id);
  if (!giveaway || giveaway.id !== giveawayId) {
    await interaction.reply({ content: 'This giveaway is no longer active.', ephemeral: true }).catch(() => null);
    return true;
  }

  addGiveawayEntry(giveaway.id, interaction.user.id);
  await interaction.reply({ content: `✅ You entered **${giveaway.prize}**. Good luck!`, ephemeral: true }).catch(() => null);
  return true;
}

export function startGiveawayScheduler(client) {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const run = async () => {
    const due = listDueActiveGiveaways(new Date());
    for (const giveaway of due) {
      await closeGiveaway(client, giveaway);
    }
  };

  run().catch(() => null);
  setInterval(() => run().catch(() => null), 15000);
}
