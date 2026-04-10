import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { onMessageCreate } from './events/messageCreate.js';
import { onGuildMemberAdd } from './events/guildMemberAdd.js';
import { pingCommand } from './commands/ping.js';
import { configCommand } from './commands/config.js';
import { warnCommand } from './commands/warn.js';
import { automodCommand } from './commands/automod.js';
import { ticketPanelCommand } from './commands/ticketpanel.js';
import { handleTicketButton } from './interactions/tickets.js';

const commandList = [pingCommand, configCommand, warnCommand, automodCommand, ticketPanelCommand];

export function createBotClient() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
  });

  client.commands = new Collection(commandList.map((cmd) => [cmd.data.name, cmd]));

  client.once('ready', async () => {
    console.log(`Bot online as ${client.user.tag}`);
    await client.application.commands.set(commandList.map((c) => c.data));
  });

  client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
      await handleTicketButton(interaction);
      return;
    }

    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);
      const payload = { content: 'Something went wrong running that command.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    }
  });

  client.on('messageCreate', onMessageCreate);
  client.on('guildMemberAdd', onGuildMemberAdd);

  return client;
}
