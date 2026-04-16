import { getGuildSettings, updateGuildSettings } from '../../services/guildSettings.js';

export const logsCommand = {
  data: {
    name: 'logs',
    description: 'Configure per-server logging settings',
    options: [
      {
        name: 'action',
        description: 'Choose an action',
        type: 3,
        required: true,
        choices: [
          { name: 'view', value: 'view' },
          { name: 'configure', value: 'configure' },
          { name: 'disable', value: 'disable' }
        ]
      },
      { name: 'channel', description: 'Channel where logs are sent', type: 7, required: false },
      { name: 'member_events', description: 'Log join/leave events', type: 5, required: false },
      { name: 'message_edits', description: 'Log message edits', type: 5, required: false },
      { name: 'message_deletes', description: 'Log message deletions', type: 5, required: false },
      { name: 'voice_events', description: 'Log voice state updates', type: 5, required: false },
      { name: 'moderation_events', description: 'Log moderation actions', type: 5, required: false },
      { name: 'automod_events', description: 'Log automod removals/timeouts', type: 5, required: false }
    ]
  },
  async execute(interaction) {
    if (!interaction.memberPermissions?.has('ManageGuild')) {
      await interaction.reply({ content: 'You need Manage Server permission.', ephemeral: true });
      return;
    }

    const action = interaction.options.getString('action', true);

    if (action === 'view') {
      const settings = getGuildSettings(interaction.guildId);
      await interaction.reply({
        ephemeral: true,
        content: [
          `Logging: **${settings.logging_enabled ? 'Enabled' : 'Disabled'}**`,
          `Channel: ${settings.moderation_log_channel_id ? `<#${settings.moderation_log_channel_id}>` : 'Not set'}`,
          `Member events: ${Boolean(settings.log_member_events)}`,
          `Message edits: ${Boolean(settings.log_message_edits)}`,
          `Message deletes: ${Boolean(settings.log_message_deletes)}`,
          `Voice events: ${Boolean(settings.log_voice_events)}`,
          `Moderation events: ${Boolean(settings.log_moderation_events)}`,
          `Automod events: ${Boolean(settings.log_automod_events)}`
        ].join('\n')
      });
      return;
    }

    if (action === 'disable') {
      updateGuildSettings(interaction.guildId, { logging_enabled: 0 });
      await interaction.reply({ content: 'Logging has been disabled for this server.', ephemeral: true });
      return;
    }

    const channel = interaction.options.getChannel('channel');
    const memberEvents = interaction.options.getBoolean('member_events');
    const messageEdits = interaction.options.getBoolean('message_edits');
    const messageDeletes = interaction.options.getBoolean('message_deletes');
    const voiceEvents = interaction.options.getBoolean('voice_events');
    const moderationEvents = interaction.options.getBoolean('moderation_events');
    const automodEvents = interaction.options.getBoolean('automod_events');

    if (channel && !channel.isTextBased()) {
      await interaction.reply({ content: 'The log channel must be text-based.', ephemeral: true });
      return;
    }

    const current = getGuildSettings(interaction.guildId);
    const updated = updateGuildSettings(interaction.guildId, {
      logging_enabled: 1,
      moderation_log_channel_id: channel?.id ?? current.moderation_log_channel_id,
      ...(memberEvents !== null ? { log_member_events: memberEvents } : {}),
      ...(messageEdits !== null ? { log_message_edits: messageEdits } : {}),
      ...(messageDeletes !== null ? { log_message_deletes: messageDeletes } : {}),
      ...(voiceEvents !== null ? { log_voice_events: voiceEvents } : {}),
      ...(moderationEvents !== null ? { log_moderation_events: moderationEvents } : {}),
      ...(automodEvents !== null ? { log_automod_events: automodEvents } : {})
    });

    if (!updated.moderation_log_channel_id) {
      await interaction.reply({
        content: 'Logging is enabled but no log channel is set. Re-run with the `channel` option.',
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      content: `Logging configured. Updates will be sent to <#${updated.moderation_log_channel_id}>.`,
      ephemeral: true
    });
  }
};
