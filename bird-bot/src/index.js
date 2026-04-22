import 'dotenv/config';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { findImageAttachment, identifyBirdFromImage, isBirdIdEnabledForChannel } from './services/birdIdentifier.js';

if (!process.env.DISCORD_TOKEN) {
  throw new Error('Missing required environment variable: DISCORD_TOKEN');
}

if (!process.env.BIRD_ID_CHANNEL_IDS) {
  throw new Error('Missing required environment variable: BIRD_ID_CHANNEL_IDS');
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel, Partials.Message]
});

client.once('ready', () => {
  console.log(`Bird ID bot online as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;
  if (!isBirdIdEnabledForChannel(message.channelId)) return;

  const image = findImageAttachment(message);
  if (!image) return;

  const result = await identifyBirdFromImage(image.url).catch((error) => ({
    ok: false,
    reason: 'runtime_error',
    message: `Bird classifier error: ${error.message}`
  }));

  if (result.ok) {
    await message.reply(`🦜 I think this is **${result.species}** (confidence ${(result.confidence * 100).toFixed(1)}%).`);
    return;
  }

  if (result.reason === 'low_confidence') {
    await message.reply(`🦉 I couldn't confidently identify this bird. ${result.message}`);
    return;
  }

  if (result.reason !== 'missing_token') {
    await message.reply(`🦉 I couldn't identify the bird in that image. ${result.message}`);
  }
});

client.login(process.env.DISCORD_TOKEN);
