# Elite Discord Suite (Premium-style bot + dashboard)

This project gives you a **multi-server Discord bot** with the same categories of capabilities premium bots usually expose:

- Moderation commands (`/warn`)
- Auto moderation (message filtering)
- XP + leveling engine
- Welcome messages
- Per-guild settings storage
- Web dashboard with Discord login
- Embed creator in dashboard (build + send rich embeds)
- Ticketing system (open/close private support channels)
- OAuth2 invite link to add the bot to any server you manage

## Quick start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy and edit environment variables:
   ```bash
   cp .env.example .env
   ```
3. Start the app:
   ```bash
   npm start
   ```

Dashboard runs on `http://localhost:3000` by default.

## Architecture

- `src/bot/*` — Discord client, slash commands, and event handlers.
- `src/dashboard/*` — Express app + Discord OAuth session login.
- `src/services/*` — SQLite persistence and guild configuration helpers.

## Production notes

To match enterprise/premium scale you should add:

- Redis queues + caching
- Sharding (`ShardingManager`) for large bot fleets
- Role menus, ticketing, custom command builder, analytics pipeline
- Full front-end (React/Next.js) + API auth layer
- Stripe/paywall and per-guild plan limits
