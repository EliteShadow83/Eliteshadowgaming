import {
  countRecentAutomodRemovals,
  getGuildSettings,
  incrementXP,
  listAutomodTerms,
  listLevelRoleRewardsInRange,
  recordAutomodRemoval
} from '../../services/guildSettings.js';
import { sendGuildLog } from '../../services/logger.js';

const inviteRegex = /(discord\.gg|discord\.com\/invite)\/[a-zA-Z0-9-]+/i;
const linkRegex = /(https?:\/\/|www\.)\S+/i;

function buildLevelRewardMessage(template, { userMention, roleMention, level }) {
  if (!template) return `🏅 ${userMention} reached level **${level}** and received ${roleMention}!`;
  return template
    .replaceAll('{user}', userMention)
    .replaceAll('{role}', roleMention)
    .replaceAll('{level}', String(level));
}

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

      await sendGuildLog({
        guild: message.guild,
        eventType: 'automod',
        title: 'Automod Message Removal',
        description: `${message.author.tag} had a message removed in <#${message.channelId}>.`,
        color: '#F39C12',
        fields: [
          { name: 'Reason', value: [hitsCustomWord && 'Blocked word', tooManyMentions && 'Too many mentions', hasInvite && 'Invite link', hasLink && 'External link'].filter(Boolean).join(', ') || 'Policy violation' },
          { name: 'Content', value: (message.content || '[empty]').slice(0, 1024) }
        ]
      });

      await message.channel.send(`${message.author}, your message was removed by automod.`);
      return;
    }
  }

  if (settings.leveling_enabled) {
    const result = incrementXP(message.guild.id, message.author.id);
    if (result.levelUp) {
      await message.channel.send(`🎉 ${message.author} leveled up to **${result.level}**!`);

      const milestones = listLevelRoleRewardsInRange(message.guild.id, result.previousLevel, result.level);
      for (const reward of milestones) {
        const role = await message.guild.roles.fetch(reward.role_id).catch(() => null);
        if (!role || !message.member || message.member.roles.cache.has(role.id)) continue;

        await message.member.roles.add(role, `Level milestone reward: ${reward.level}`).catch(() => null);
        const rewardMessage = buildLevelRewardMessage(reward.reward_message, {
          userMention: `${message.author}`,
          roleMention: `<@&${role.id}>`,
          level: reward.level
        });
        await message.channel.send(rewardMessage).catch(() => null);
      }
    }
  }
}
