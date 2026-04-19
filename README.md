# Elite Discord Suite (Premium-style bot + dashboard)

This project gives you a **multi-server Discord bot** with the same categories of capabilities premium bots usually expose:

- Moderation commands (`/warn`)
- Auto moderation (custom blocked words, links/invite filter, mention limit, and tempmute on repeated removals)
- XP + leveling engine with milestone role rewards + custom reward messages
- Welcome messages
- Per-guild settings storage
- Configurable per-server logging (choose channel + toggle event categories)
- Web dashboard with Discord login
- Admin bot manager (add/edit bots, client secrets/tokens, default presence, and start/stop variants)
- Variants with configured bot tokens auto-start on service startup
- Per-server bot presence controls on each server page
- Non-admins can only switch to bots already invited in that server
- Multi-bot support with per-bot license key assignment
- License-key paywall for bot invites + manual key creation (configurable server-count per key)
- License keys are tied to a specific bot variant; redeeming auto-selects the tied bot
- Database manager in dashboard (browse/edit SQLite tables + debug table drop)
- Developer secret unlock required for DB manager and viewing recent license keys
- Embed creator in dashboard (build + send rich embeds with live preview)
- Ticketing system (support role ping/access, claim tickets, opener-close toggle, and transcript threads in transcript channel)
- Optional temporary VC manager (auto-create channels from a join-to-create lobby and auto-delete when empty)
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


## Run on Windows (step-by-step)

1. **Install prerequisites**
   - Install **Node.js 20+** from https://nodejs.org/
   - Install **Git for Windows** from https://git-scm.com/download/win
   - (Optional) Install **Visual Studio Code**

2. **Clone the repository**
   ```powershell
   git clone <your-repo-url>
   cd Eliteshadowgaming
   ```

3. **Install dependencies**
   ```powershell
   npm install
   ```

4. **Create your environment file**
   ```powershell
   copy .env.example .env
   ```

5. **Configure Discord app + bot values in `.env`**
   - `DISCORD_TOKEN`: Bot token from Discord Developer Portal
   - `DISCORD_CLIENT_ID`: Application Client ID
   - `DISCORD_CLIENT_SECRET`: OAuth2 client secret
   - `DISCORD_CALLBACK_URL`: For local runs use `http://localhost:3000/auth/discord/callback`
   - `SESSION_SECRET`: Any strong random secret string
   - `DASHBOARD_ADMIN_SECRET`: Required for manual key creation in license manager
   - `BOT_VARIANTS_JSON`: Optional JSON array of bot variants for multi-bot invites and key assignment (supports clientSecret and botToken fields)
   - `RUNNING_BOT_SLUG`: Which configured bot variant this runtime should apply presence settings for

6. **Enable required intents in Discord Developer Portal**
   - In your bot settings, enable privileged intents as needed (for this starter, Message Content and Server Members are used).

7. **Start the app**
   ```powershell
   npm start
   ```

8. **Open the dashboard**
   - Visit `http://localhost:3000`
   - Click **Login with Discord**
   - Click **Add bot to a server** and authorize

9. **Initialize features in your server**
   - Run `/ticketpanel` to post the ticket open reaction panel (🎫)
   - Use `/config` for toggles (automod/leveling/prefix)
   - Use `/automod action:view` and `/automod action:configure` for advanced automod config
   - Run `/poll` to post quick reaction polls
   - Run `/giveaway` to launch timed button-entry giveaways
   - Run `/vcmanager action:configure` to enable join-to-create temporary voice channels
   - Run `/logs action:configure` to choose a log channel and event types
   - Use dashboard pages for embeds, giveaway embed customization (including image + thumbnail URLs), ticket settings, logging settings, and VC manager settings

10. **Common Windows troubleshooting**
    - If `npm install` fails for native modules, install **Visual Studio Build Tools** and run install again.
    - If PowerShell blocks scripts, run terminal as Administrator and execute:
      ```powershell
      Set-ExecutionPolicy RemoteSigned
      ```
    - If OAuth callback fails, verify callback URL in Discord portal exactly matches your `.env` value.
