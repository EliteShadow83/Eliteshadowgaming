import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { onMessageCreate } from './events/messageCreate.js';
import { onGuildMemberAdd } from './events/guildMemberAdd.js';
import { onGuildMemberRemove } from './events/guildMemberRemove.js';
import { onMessageDelete } from './events/messageDelete.js';
import { onMessageUpdate } from './events/messageUpdate.js';
import { onMessageReactionAdd } from './events/messageReactionAdd.js';
import { pingCommand } from './commands/ping.js';
import { configCommand } from './commands/config.js';
import { warnCommand } from './commands/warn.js';
import { automodCommand } from './commands/automod.js';
import { ticketPanelCommand } from './commands/ticketpanel.js';
import { pollCommand } from './commands/poll.js';
import { giveawayCommand } from './commands/giveaway.js';
import { vcManagerCommand } from './commands/vcmanager.js';
import { logsCommand } from './commands/logs.js';
import { handleGiveawayButton, startGiveawayScheduler } from './interactions/giveaways.js';
import { handleTicketButton } from './interactions/tickets.js';
import { onVoiceStateUpdate } from './events/voiceStateUpdate.js';

const commandList = [pingCommand, configCommand, warnCommand, automodCommand, ticketPanelCommand, pollCommand, giveawayCommand, vcManagerCommand, logsCommand];

export function createBotClient() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User]
  });

  client.commands = new Collection(commandList.map((cmd) => [cmd.data.name, cmd]));

  client.once('ready', async () => {
    console.log(`Bot online as ${client.user.tag}`);
    await client.application.commands.set(commandList.map((c) => c.data));
    startGiveawayScheduler(client);
  });

  client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
      const wasGiveawayButton = handleGiveawayButton(interaction);
      if (wasGiveawayButton) return;
      const wasTicketButton = await handleTicketButton(interaction);
      if (wasTicketButton) return;
      return;
    }

    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);
      const payload = { content: 'Something went wrong running that command.', flags: 64 };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    }
  });

  client.on('messageCreate', onMessageCreate);
  client.on('guildMemberAdd', onGuildMemberAdd);
  client.on('guildMemberRemove', onGuildMemberRemove);
  client.on('messageDelete', onMessageDelete);
  client.on('messageUpdate', onMessageUpdate);
  client.on('messageReactionAdd', onMessageReactionAdd);
  client.on('voiceStateUpdate', onVoiceStateUpdate);

  return client;
}
