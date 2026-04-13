import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import {
  claimTicketRecord,
  closeTicketRecord,
  createTicketChannel,
  getOpenTicketForUser,
  getTicketByChannel,
  getTicketSettings
} from '../../services/ticketing.js';

export async function handleTicketButton(interaction) {
  if (!interaction.guild) return;

  if (interaction.customId === 'ticket_open') {
    const existing = getOpenTicketForUser(interaction.guildId, interaction.user.id);
    if (existing) {
      await interaction.reply({ content: `You already have an open ticket: <#${existing.channel_id}>`, ephemeral: true });
      return;
    }

    try {
      const { ticketChannel, settings } = await createTicketChannel({ guild: interaction.guild, user: interaction.user });
      const controls = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim Ticket').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
      );

      const supportPing = settings.support_role_id ? `<@&${settings.support_role_id}> ` : '';
      await ticketChannel.send({
        content: `${supportPing}Hello ${interaction.user}, our team will help you here. Use the buttons below to claim/close.`,
        components: [controls],
        allowedMentions: { roles: settings.support_role_id ? [settings.support_role_id] : [] }
      });

      await interaction.reply({ content: `Ticket created: ${ticketChannel}`, ephemeral: true });
    } catch (err) {
      await interaction.reply({ content: err.message || 'Unable to create ticket right now.', ephemeral: true });
    }

    return;
  }

  if (interaction.customId === 'ticket_claim') {
    const ticket = getTicketByChannel(interaction.channelId);
    if (!ticket || ticket.status !== 'open') {
      await interaction.reply({ content: 'This is not an open ticket channel.', ephemeral: true });
      return;
    }

    const settings = getTicketSettings(interaction.guildId);
    const hasSupportRole = settings.support_role_id && interaction.member?.roles?.cache?.has(settings.support_role_id);
    const canClaim = hasSupportRole || interaction.memberPermissions?.has('ManageChannels');

    if (!canClaim) {
      await interaction.reply({ content: 'Only support staff can claim tickets.', ephemeral: true });
      return;
    }

    if (ticket.claimed_by_user_id) {
      await interaction.reply({ content: `Ticket already claimed by <@${ticket.claimed_by_user_id}>.`, ephemeral: true });
      return;
    }

    claimTicketRecord(interaction.channelId, interaction.user.id);
    await interaction.reply(`✅ Ticket claimed by ${interaction.user}.`);
    return;
  }

  if (interaction.customId === 'ticket_close') {
    const ticket = getTicketByChannel(interaction.channelId);
    if (!ticket || ticket.status !== 'open') {
      await interaction.reply({ content: 'This is not an open ticket channel.', ephemeral: true });
      return;
    }

    const settings = getTicketSettings(interaction.guildId);
    const isOwner = ticket.owner_user_id === interaction.user.id;
    const hasSupportRole = settings.support_role_id && interaction.member?.roles?.cache?.has(settings.support_role_id);
    const canClose = interaction.memberPermissions?.has('ManageChannels') || hasSupportRole || (settings.opener_can_close && isOwner);

    if (!canClose) {
      await interaction.reply({ content: 'You do not have permission to close this ticket.', ephemeral: true });
      return;
    }

    await interaction.reply('Closing ticket in 3 seconds...');

    if (settings.transcript_log_channel_id) {
      await createTranscriptThread({ interaction, ticket, settings }).catch(() => null);
    }

    closeTicketRecord(interaction.channelId, interaction.user.id);
    setTimeout(() => {
      interaction.channel.delete('Ticket closed').catch(() => null);
    }, 3000);
  }
}

async function createTranscriptThread({ interaction, ticket, settings }) {
  const logChannel = await interaction.guild.channels.fetch(settings.transcript_log_channel_id).catch(() => null);
  if (!logChannel || !logChannel.isTextBased() || !('threads' in logChannel)) return;

  const messages = await collectMessages(interaction.channel);
  const lines = messages
    .reverse()
    .map((msg) => `[${msg.createdAt.toISOString()}] ${msg.author?.tag || msg.author?.id}: ${msg.cleanContent || '[attachment/empty]'}`);

  const thread = await logChannel.threads.create({
    name: `transcript-${interaction.channel.name}-${Date.now().toString().slice(-5)}`,
    autoArchiveDuration: 10080,
    reason: `Transcript for closed ticket ${ticket.id}`
  });

  await thread.send(`Ticket transcript for <#${interaction.channelId}>\nOwner: <@${ticket.owner_user_id}>\nClosed by: <@${interaction.user.id}>`);

  if (!lines.length) {
    await thread.send('No messages were captured in this ticket.');
    return;
  }

  const chunks = chunkTranscript(lines.join('\n'), 1800);
  for (const chunk of chunks) {
    await thread.send(`\`\`\`txt\n${chunk}\n\`\`\``);
  }
}

async function collectMessages(channel) {
  const all = [];
  let before;

  while (all.length < 500) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch || batch.size === 0) break;
    const values = [...batch.values()];
    all.push(...values);
    before = values[values.length - 1].id;
  }

  return all;
}

function chunkTranscript(text, maxLength) {
  const lines = text.split('\n');
  const chunks = [];
  let current = '';

  for (const line of lines) {
    if ((current + line + '\n').length > maxLength) {
      chunks.push(current.trimEnd());
      current = '';
    }
    current += `${line}\n`;
  }

  if (current.trim()) chunks.push(current.trimEnd());
  return chunks;
}
