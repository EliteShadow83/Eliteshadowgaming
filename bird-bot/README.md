# Standalone Bird Identification Discord Bot

This is a fully standalone Discord bot that identifies bird species from image attachments posted in configured channels.

## Setup

1. Install dependencies:
   ```bash
   cd bird-bot
   npm install
   ```
2. Create your environment file:
   ```bash
   cp .env.example .env
   ```
3. Fill in required values:
   - `DISCORD_TOKEN`
   - `BIRD_ID_CHANNEL_IDS` (comma-separated channel IDs)
   - `HUGGINGFACE_API_TOKEN`
4. Start the bot:
   ```bash
   npm start
   ```

## Optional configuration

- `BIRD_ID_MODEL` (default: `chriamue/bird-species-classifier`)
- `BIRD_ID_MIN_SCORE` (default: `0.4`)
