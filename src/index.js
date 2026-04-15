import 'dotenv/config';
import { createBotClient } from './bot/client.js';
import { createDashboard } from './dashboard/app.js';
import { applyBotVariantPresence, getBotVariantBySlug, getBotVariants } from './services/bots.js';

const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_CALLBACK_URL', 'SESSION_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const runningVariantClients = new Map();

const client = createBotClient();
const runningSlug = process.env.RUNNING_BOT_SLUG || 'default';

client.once('ready', async () => {
  const variant = getBotVariantBySlug(runningSlug);
  applyBotVariantPresence(client, variant);
  runningVariantClients.set(runningSlug, client);

  const variants = getBotVariants();
  for (const v of variants) {
    if (v.slug === runningSlug) continue;
    if (!v.bot_token) continue;
    try {
      await botRuntime.startVariant(v);
      console.log(`[bot-runtime] Auto-started variant: ${v.slug}`);
    } catch (err) {
      console.error(`[bot-runtime] Failed to auto-start ${v.slug}:`, err.message);
    }
  }
});

const botRuntime = {
  listRunningSlugs() {
    return [...runningVariantClients.keys()];
  },
  isVariantInGuild(slug, guildId) {
    const bot = runningVariantClients.get(slug);
    if (!bot) return false;
    return bot.guilds.cache.has(guildId);
  },
  async startVariant(variant) {
    if (!variant?.slug) throw new Error('Variant slug is required.');
    if (runningVariantClients.has(variant.slug)) return;
    if (!variant.bot_token) throw new Error('This variant has no bot token configured.');
    if ([...runningVariantClients.values()].some((c) => c.token === variant.bot_token)) {
      throw new Error('A running variant is already using this bot token.');
    }

    const bot = createBotClient();
    await bot.login(variant.bot_token);
    bot.once('ready', () => {
      applyBotVariantPresence(bot, variant);
    });
    runningVariantClients.set(variant.slug, bot);
  },
  async stopVariant(slug) {
    if (slug === runningSlug) throw new Error('Cannot stop the primary running bot from dashboard.');
    const bot = runningVariantClients.get(slug);
    if (!bot) return;
    await bot.destroy();
    runningVariantClients.delete(slug);
  }
};

const app = createDashboard({ client, botRuntime });

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Dashboard available on http://localhost:${port}`);
});

client.login(process.env.DISCORD_TOKEN);
