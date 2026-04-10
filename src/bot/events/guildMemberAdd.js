import { getGuildSettings } from '../../services/guildSettings.js';

export async function onGuildMemberAdd(member) {
  const settings = getGuildSettings(member.guild.id);
  if (!settings.welcome_enabled || !settings.welcome_channel_id) return;

  const channel = await member.guild.channels.fetch(settings.welcome_channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  await channel.send(`👋 Welcome ${member} to **${member.guild.name}**!`);
}
