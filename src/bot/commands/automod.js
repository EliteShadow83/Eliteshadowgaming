import {
  addAutomodTerm,
  getGuildSettings,
  listAutomodTerms,
  removeAutomodTerm,
  updateGuildSettings
} from '../../services/guildSettings.js';

export const automodCommand = {
  data: {
    name: 'automod',
    description: 'Manage automod words and filters',
    options: [
      {
        name: 'action',
        description: 'Operation to run',
        type: 3,
        required: true,
        choices: [
          { name: 'view', value: 'view' },
          { name: 'add-word', value: 'add-word' },
          { name: 'remove-word', value: 'remove-word' },
          { name: 'configure', value: 'configure' }
        ]
      },
      { name: 'word', description: 'Word to add/remove', type: 3, required: false },
      { name: 'block_links', description: 'Block all links', type: 5, required: false },
      { name: 'block_invites', description: 'Block Discord invites', type: 5, required: false },
      { name: 'max_mentions', description: 'Max mentions per message (1-20)', type: 4, required: false },
      { name: 'mute_on_violations', description: 'Enable tempmute after repeated removals', type: 5, required: false },
      { name: 'mute_threshold', description: 'Removed messages before mute (1-20)', type: 4, required: false },
      { name: 'mute_window_minutes', description: 'Window to count removals (1-120)', type: 4, required: false },
      { name: 'mute_duration_minutes', description: 'Tempmute duration (1-1440)', type: 4, required: false }
    ]
  },
  async execute(interaction) {
    if (!interaction.memberPermissions?.has('ManageGuild')) {
      await interaction.reply({ content: 'You need Manage Server permission.', flags: 64 });
      return;
    }

    const action = interaction.options.getString('action', true);

    if (action === 'view') {
      const settings = getGuildSettings(interaction.guildId);
      const terms = listAutomodTerms(interaction.guildId);
      await interaction.reply({
        flags: 64,
        content: `Automod settings:\n- Enabled: ${Boolean(settings.automod_enabled)}\n- Block links: ${Boolean(settings.block_links)}\n- Block invites: ${Boolean(settings.block_invites)}\n- Max mentions: ${settings.max_mentions}\n- Tempmute on violations: ${Boolean(settings.automod_mute_enabled)}\n- Mute threshold: ${settings.automod_mute_threshold} removals\n- Mute window: ${settings.automod_mute_window_minutes} minutes\n- Mute duration: ${settings.automod_mute_duration_minutes} minutes\n- Custom words: ${terms.length ? terms.join(', ') : 'None'}`
      });
      return;
    }

    if (action === 'add-word') {
      const word = interaction.options.getString('word');
      if (!word) {
        await interaction.reply({ content: 'Provide a word to add.', flags: 64 });
        return;
      }
      const terms = addAutomodTerm(interaction.guildId, word);
      await interaction.reply({ content: `Added word. Current list: ${terms.join(', ')}`, flags: 64 });
      return;
    }

    if (action === 'remove-word') {
      const word = interaction.options.getString('word');
      if (!word) {
        await interaction.reply({ content: 'Provide a word to remove.', flags: 64 });
        return;
      }
      const terms = removeAutomodTerm(interaction.guildId, word);
      await interaction.reply({ content: `Removed word. Current list: ${terms.length ? terms.join(', ') : 'None'}`, flags: 64 });
      return;
    }

    const blockLinks = interaction.options.getBoolean('block_links');
    const blockInvites = interaction.options.getBoolean('block_invites');
    const maxMentions = interaction.options.getInteger('max_mentions');
    const muteEnabled = interaction.options.getBoolean('mute_on_violations');
    const muteThreshold = interaction.options.getInteger('mute_threshold');
    const muteWindow = interaction.options.getInteger('mute_window_minutes');
    const muteDuration = interaction.options.getInteger('mute_duration_minutes');

    const updated = updateGuildSettings(interaction.guildId, {
      ...(blockLinks !== null ? { block_links: blockLinks } : {}),
      ...(blockInvites !== null ? { block_invites: blockInvites } : {}),
      ...(maxMentions !== null ? { max_mentions: Math.max(1, Math.min(20, maxMentions)) } : {}),
      ...(muteEnabled !== null ? { automod_mute_enabled: muteEnabled } : {}),
      ...(muteThreshold !== null ? { automod_mute_threshold: Math.max(1, Math.min(20, muteThreshold)) } : {}),
      ...(muteWindow !== null ? { automod_mute_window_minutes: Math.max(1, Math.min(120, muteWindow)) } : {}),
      ...(muteDuration !== null ? { automod_mute_duration_minutes: Math.max(1, Math.min(1440, muteDuration)) } : {})
    });

    await interaction.reply({
      flags: 64,
      content: `Updated automod config: block_links=${Boolean(updated.block_links)}, block_invites=${Boolean(updated.block_invites)}, max_mentions=${updated.max_mentions}, tempmute=${Boolean(updated.automod_mute_enabled)} (${updated.automod_mute_threshold} removals/${updated.automod_mute_window_minutes}m => ${updated.automod_mute_duration_minutes}m mute)`
    });
  }
};
