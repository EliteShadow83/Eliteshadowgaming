import { getGuildSettings } from '../../services/guildSettings.js';
import { sendGuildLog } from '../../services/logger.js';

function renderTemplate(template, member) {
  return (template || '👋 Welcome {user} to **{server}**!')
    .replaceAll('{user}', `${member}`)
    .replaceAll('{user_tag}', member.user.tag)
    .replaceAll('{server}', member.guild.name);
}

export async function onGuildMemberAdd(member) {
  const settings = getGuildSettings(member.guild.id);

  if (settings.autorole_enabled && settings.autorole_role_id) {
    const role = await member.guild.roles.fetch(settings.autorole_role_id).catch(() => null);
    if (role) {
      await member.roles.add(role, 'Autorole enabled').catch(() => null);
    }
  }

  if (settings.welcome_enabled && settings.welcome_channel_id) {
    const channel = await member.guild.channels.fetch(settings.welcome_channel_id).catch(() => null);
    if (channel?.isTextBased()) {
      await channel.send(renderTemplate(settings.join_message, member)).catch(() => null);
    }
  }

  await sendGuildLog({
    guild: member.guild,
    eventType: 'member',
    title: 'Member Joined',
    description: `${member.user.tag} joined the server.`,
    color: '#2ECC71',
    fields: [
      { name: 'User', value: `<@${member.id}>`, inline: true },
      { name: 'User ID', value: member.id, inline: true }
    ]
  });
}
