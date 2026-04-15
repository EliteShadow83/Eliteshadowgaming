import { ChannelType, PermissionFlagsBits } from 'discord.js';
import {
  addTemporaryVoiceChannel,
  getTemporaryVoiceChannel,
  getVcManagerSettings,
  removeTemporaryVoiceChannel
} from '../../services/vcManager.js';
import { sendGuildLog } from '../../services/logger.js';

function renderChannelName(template, member) {
  const base = (template || '{user}\'s VC').replaceAll('{user}', member.displayName || member.user.username);
  return base.slice(0, 95);
}

async function maybeDeleteTemporaryChannel(oldState) {
  const oldChannel = oldState.channel;
  if (!oldChannel || oldChannel.type !== ChannelType.GuildVoice) return;

  const tracked = getTemporaryVoiceChannel(oldChannel.id);
  if (!tracked) return;

  const remainingMembers = oldChannel.members.filter((m) => !m.user.bot);
  if (remainingMembers.size > 0) return;

  removeTemporaryVoiceChannel(oldChannel.id);
  await oldChannel.delete('Temporary VC empty').catch(() => null);
}

export async function onVoiceStateUpdate(oldState, newState) {
  const guildId = newState.guild?.id || oldState.guild?.id;
  if (!guildId) return;

  const settings = getVcManagerSettings(guildId);
  if (!settings.enabled || !settings.lobby_channel_id || !settings.category_channel_id) {
    return;
  }

  if (oldState.channelId && oldState.channelId !== newState.channelId) {
    await maybeDeleteTemporaryChannel(oldState);
  }

  if (newState.member && !newState.member.user.bot && oldState.channelId !== newState.channelId) {
    const fromLabel = oldState.channelId ? `<#${oldState.channelId}>` : 'Disconnected';
    const toLabel = newState.channelId ? `<#${newState.channelId}>` : 'Disconnected';
    await sendGuildLog({
      guild: newState.guild,
      eventType: 'voice',
      title: 'Voice State Updated',
      description: `${newState.member.user.tag} moved voice channels.`,
      color: '#9B59B6',
      fields: [
        { name: 'From', value: fromLabel, inline: true },
        { name: 'To', value: toLabel, inline: true }
      ]
    });
  }

  const joinedCreateChannel = newState.channelId && newState.channelId === settings.lobby_channel_id;
  if (!joinedCreateChannel) return;

  const member = newState.member;
  if (!member || member.user.bot) return;

  const permissions = [
    {
      id: member.id,
      allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers]
    }
  ];

  const tempChannel = await newState.guild.channels.create({
    name: renderChannelName(settings.channel_name_template, member),
    type: ChannelType.GuildVoice,
    parent: settings.category_channel_id,
    permissionOverwrites: permissions,
    reason: `Temporary VC created for ${member.user.tag}`
  }).catch(() => null);

  if (!tempChannel) return;

  addTemporaryVoiceChannel(newState.guild.id, tempChannel.id, member.id);
  await member.voice.setChannel(tempChannel).catch(() => null);
}
