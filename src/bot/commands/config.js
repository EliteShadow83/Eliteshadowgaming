import { getGuildSettings, updateGuildSettings } from '../../services/guildSettings.js';

export const configCommand = {
  data: {
    name: 'config',
    description: 'View or update core guild settings',
    options: [
      {
        name: 'prefix',
        description: 'Set a new prefix',
        type: 3,
        required: false
      },
      {
        name: 'automod',
        description: 'Enable or disable automod',
        type: 5,
        required: false
      },
      {
        name: 'leveling',
        description: 'Enable or disable leveling',
        type: 5,
        required: false
      }
    ]
  },
  async execute(interaction) {
    if (!interaction.memberPermissions?.has('ManageGuild')) {
      await interaction.reply({ content: 'You need Manage Server permission.', flags: 64 });
      return;
    }

    const prefix = interaction.options.getString('prefix');
    const automod = interaction.options.getBoolean('automod');
    const leveling = interaction.options.getBoolean('leveling');

    if (prefix === null && automod === null && leveling === null) {
      const settings = getGuildSettings(interaction.guildId);
      await interaction.reply({
        flags: 64,
        content: `Current settings:\n- Prefix: ${settings.prefix}\n- Automod: ${Boolean(settings.automod_enabled)}\n- Leveling: ${Boolean(settings.leveling_enabled)}`
      });
      return;
    }

    const updated = updateGuildSettings(interaction.guildId, {
      ...(prefix !== null ? { prefix } : {}),
      ...(automod !== null ? { automod_enabled: automod } : {}),
      ...(leveling !== null ? { leveling_enabled: leveling } : {})
    });

    await interaction.reply({
      content: `Updated settings for **${interaction.guild.name}**. Prefix: ${updated.prefix}, Automod: ${Boolean(updated.automod_enabled)}, Leveling: ${Boolean(updated.leveling_enabled)}`,
      flags: 64
    });
  }
};
