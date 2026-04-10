import {
  countRecentAutomodRemovals,
  getGuildSettings,
  incrementXP,
  listAutomodTerms,
  recordAutomodRemoval
} from '../../services/guildSettings.js';

const inviteRegex = /(discord\.gg|discord\.com\/invite)\/[a-zA-Z0-9-]+/i;
const linkRegex = /(https?:\/\/|www\.)\S+/i;

export async function onMessageCreate(message) {
  if (!message.guild || message.author.bot) return;

  const settings = getGuildSettings(message.guild.id);

  if (settings.automod_enabled) {
    const lower = message.content.toLowerCase();
    const terms = listAutomodTerms(message.guild.id);

    const hitsCustomWord = terms.some((word) => lower.includes(word));
    const tooManyMentions = message.mentions.users.size + message.mentions.roles.size > Number(settings.max_mentions || 5);
    const hasInvite = Boolean(settings.block_invites) && inviteRegex.test(message.content);
    const hasLink = Boolean(settings.block_links) && linkRegex.test(message.content);

    if (hitsCustomWord || tooManyMentions || hasInvite || hasLink) {
      await message.delete().catch(() => null);
      recordAutomodRemoval(message.guild.id, message.author.id);

      if (settings.automod_mute_enabled && message.member?.moderatable) {
        const recentCount = countRecentAutomodRemovals(
          message.guild.id,
          message.author.id,
          Number(settings.automod_mute_window_minutes || 10)
        );

        if (recentCount >= Number(settings.automod_mute_threshold || 5)) {
          const timeoutMs = Number(settings.automod_mute_duration_minutes || 15) * 60 * 1000;
          await message.member.timeout(timeoutMs, 'Automod: too many removed messages').catch(() => null);
          await message.channel.send(`${message.author} has been temporarily muted for repeated automod violations.`);
          return;
        }
      }

      await message.channel.send(`${message.author}, your message was removed by automod.`);
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
