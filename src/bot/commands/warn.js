import { addWarning } from '../../services/guildSettings.js';
import { sendGuildLog } from '../../services/logger.js';

export const warnCommand = {
  data: {
    name: 'warn',
    description: 'Warn a user and track moderation history',
    options: [
      { name: 'user', description: 'User to warn', type: 6, required: true },
      { name: 'reason', description: 'Reason for warning', type: 3, required: true }
    ]
  },
  async execute(interaction) {
    if (!interaction.memberPermissions?.has('ModerateMembers')) {
      await interaction.reply({ content: 'You need Moderate Members permission.', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);

    addWarning({
      guildId: interaction.guildId,
      userId: user.id,
      moderatorId: interaction.user.id,
      reason
    });

    await sendGuildLog({
      guild: interaction.guild,
      eventType: 'moderation',
      title: 'Member Warned',
      description: `${user.tag} was warned by ${interaction.user.tag}.`,
      color: '#E67E22',
      fields: [
        { name: 'Reason', value: reason.slice(0, 1024) },
        { name: 'User ID', value: user.id, inline: true },
        { name: 'Moderator ID', value: interaction.user.id, inline: true }
      ]
    });

    await interaction.reply(`⚠️ ${user.tag} was warned for: ${reason}`);
  }
};
