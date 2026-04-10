import 'dotenv/config';
import { createBotClient } from './bot/client.js';
import { createDashboard } from './dashboard/app.js';

const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_CALLBACK_URL', 'SESSION_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const client = createBotClient();
const app = createDashboard({ client });

const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`Dashboard available on http://localhost:${port}`);
});

client.login(process.env.DISCORD_TOKEN);
