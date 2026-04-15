import { getGuildSettings } from '../../services/guildSettings.js';
import { sendGuildLog } from '../../services/logger.js';

function renderTemplate(template, member) {
  return (template || '👋 {user_tag} has left **{server}**.')
    .replaceAll('{user}', member.user.username)
    .replaceAll('{user_tag}', member.user.tag)
    .replaceAll('{server}', member.guild.name);
}

export async function onGuildMemberRemove(member) {
  const settings = getGuildSettings(member.guild.id);

  if (settings.leave_enabled && settings.leave_channel_id) {
    const channel = await member.guild.channels.fetch(settings.leave_channel_id).catch(() => null);
    if (channel?.isTextBased()) {
      await channel.send(renderTemplate(settings.leave_message, member)).catch(() => null);
    }
  }

  await sendGuildLog({
    guild: member.guild,
    eventType: 'member',
    title: 'Member Left',
    description: `${member.user.tag} left the server.`,
    color: '#E74C3C',
    fields: [
      { name: 'User', value: member.user.tag, inline: true },
      { name: 'User ID', value: member.id, inline: true }
    ]
  });
}
