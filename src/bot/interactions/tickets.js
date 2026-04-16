import {
  createTicketChannel,
  getOpenTicketForUser
} from '../../services/ticketing.js';

const OPEN_ID = 'tickets:open';
const CLAIM_ID = 'tickets:claim';
const CLOSE_ID = 'tickets:close';
const EPHEMERAL_FLAG = 64;

export async function handleTicketButton(interaction) {
  if (!interaction.guild) return false;

  if (![OPEN_ID, CLAIM_ID, CLOSE_ID, 'ticket_open', 'ticket_claim', 'ticket_close'].includes(interaction.customId)) {
    return false;
  }

  if (interaction.customId === OPEN_ID || interaction.customId === 'ticket_open') {
    const existing = getOpenTicketForUser(interaction.guildId, interaction.user.id);
    if (existing) {
      await interaction.reply({ content: `You already have an open ticket: <#${existing.channel_id}>`, flags: EPHEMERAL_FLAG });
      return true;
    }

    await interaction.deferReply({ flags: EPHEMERAL_FLAG });

    try {
      const { ticketChannel, settings } = await createTicketChannel({ guild: interaction.guild, user: interaction.user });

      const supportPing = settings.support_role_id ? `<@&${settings.support_role_id}> ` : '';
      const controls = await ticketChannel.send({
        content: `${supportPing}Hello ${interaction.user}, thanks for opening a ticket. Staff will help you here.`,
        allowedMentions: { roles: settings.support_role_id ? [settings.support_role_id] : [] }
      });
      await controls.react('✅').catch(() => null);
      await controls.react('🔒').catch(() => null);

      await interaction.editReply({ content: `✅ Ticket created: ${ticketChannel}` });
    } catch (err) {
      await interaction.editReply({ content: err.message || 'Unable to create ticket right now.' }).catch(() => null);
    }

    return true;
  }

  if (interaction.customId === CLAIM_ID || interaction.customId === 'ticket_claim' || interaction.customId === CLOSE_ID || interaction.customId === 'ticket_close') {
    await interaction.reply({
      content: 'This server uses emoji-based ticket controls now. Use ✅ to claim and 🔒 to close.',
      flags: EPHEMERAL_FLAG
    });
    return true;
  }

  return true;
}

export function getTicketButtonIds() {
  return { OPEN_ID, CLAIM_ID, CLOSE_ID };
}
