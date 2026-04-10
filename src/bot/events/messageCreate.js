import { getGuildSettings, incrementXP } from '../../services/guildSettings.js';

const badWords = ['slur1', 'slur2', 'offensive-placeholder'];

export async function onMessageCreate(message) {
  if (!message.guild || message.author.bot) return;

  const settings = getGuildSettings(message.guild.id);

  if (settings.automod_enabled) {
    const lower = message.content.toLowerCase();
    if (badWords.some((w) => lower.includes(w))) {
      await message.delete().catch(() => null);
      await message.channel.send(`${message.author}, that language is not allowed.`);
      return;
    }
  }

  if (settings.leveling_enabled) {
    const result = incrementXP(message.guild.id, message.author.id);
    if (result.levelUp) {
      await message.channel.send(`🎉 ${message.author} leveled up to **${result.level}**!`);
    }
  }
}
