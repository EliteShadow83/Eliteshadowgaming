import { ChannelType } from 'discord.js';
import { getVcManagerSettings, updateVcManagerSettings } from '../../services/vcManager.js';

export const vcManagerCommand = {
  data: {
    name: 'vcmanager',
    description: 'Configure automatic temporary voice channel management',
    options: [
      {
        name: 'action',
        description: 'What to do',
        type: 3,
        required: true,
        choices: [
          { name: 'view', value: 'view' },
          { name: 'configure', value: 'configure' },
          { name: 'disable', value: 'disable' }
        ]
      },
      {
        name: 'create_channel',
        description: 'Voice channel users join to create temporary VCs',
        type: 7,
        required: false
      },
      {
        name: 'category',
        description: 'Category where temporary VCs are created',
        type: 7,
        required: false
      },
      {
        name: 'name_template',
        description: 'Name format, use {user} placeholder (e.g. {user}\'s VC)',
        type: 3,
        required: false
      }
    ]
  },
  async execute(interaction) {
    if (!interaction.memberPermissions?.has('ManageGuild')) {
      await interaction.reply({ content: 'You need Manage Server permission.', ephemeral: true });
      return;
    }

    const action = interaction.options.getString('action', true);

    if (action === 'view') {
      const settings = getVcManagerSettings(interaction.guildId);
      await interaction.reply({
        ephemeral: true,
        content: [
          `VC Manager status: **${settings.enabled ? 'Enabled' : 'Disabled'}**`,
          `Create channel: ${settings.lobby_channel_id ? `<#${settings.lobby_channel_id}>` : 'Not set'}`,
          `Category: ${settings.category_channel_id ? `<#${settings.category_channel_id}>` : 'Not set'}`,
          `Name template: \`${settings.channel_name_template || "{user}'s VC"}\``
        ].join('\n')
      });
      return;
    }

    if (action === 'disable') {
      const settings = updateVcManagerSettings(interaction.guildId, { enabled: 0 });
      await interaction.reply({ content: `VC Manager is now **${settings.enabled ? 'Enabled' : 'Disabled'}**.`, ephemeral: true });
      return;
    }

    const createChannel = interaction.options.getChannel('create_channel');
    const category = interaction.options.getChannel('category');
    const nameTemplate = interaction.options.getString('name_template');

    if (createChannel && createChannel.type !== ChannelType.GuildVoice) {
      await interaction.reply({ content: 'The create channel must be a voice channel.', ephemeral: true });
      return;
    }

    if (category && category.type !== ChannelType.GuildCategory) {
      await interaction.reply({ content: 'The category must be a category channel.', ephemeral: true });
      return;
    }

    const current = getVcManagerSettings(interaction.guildId);
    const next = updateVcManagerSettings(interaction.guildId, {
      enabled: 1,
      lobby_channel_id: createChannel?.id ?? current.lobby_channel_id,
      category_channel_id: category?.id ?? current.category_channel_id,
      channel_name_template: nameTemplate?.trim() || current.channel_name_template || "{user}'s VC"
    });

    if (!next.lobby_channel_id || !next.category_channel_id) {
      await interaction.reply({
        content: 'VC Manager was enabled, but setup is incomplete. Provide both `create_channel` and `category` in `/vcmanager action:configure`.',
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      content: `VC Manager enabled. Users joining <#${next.lobby_channel_id}> will get a temporary VC in <#${next.category_channel_id}>.`,
      ephemeral: true
    });
  }
};
