import { addWarning } from '../../services/guildSettings.js';

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

    await interaction.reply(`⚠️ ${user.tag} was warned for: ${reason}`);
  }
};
