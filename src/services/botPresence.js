import { ActivityType } from 'discord.js';
import db from './db.js';

const defaults = {
  status: 'online',
  activity_type: 'Playing',
  activity_name: 'Managing your server'
};

export function getBotPresenceSettings() {
  let row = db.prepare('SELECT * FROM bot_presence_settings WHERE id = 1').get();
  if (!row) {
    db.prepare('INSERT INTO bot_presence_settings (id, status, activity_type, activity_name) VALUES (1, ?, ?, ?)')
      .run(defaults.status, defaults.activity_type, defaults.activity_name);
    row = db.prepare('SELECT * FROM bot_presence_settings WHERE id = 1').get();
  }
  return row;
}

export function updateBotPresenceSettings(patch) {
  const current = getBotPresenceSettings();
  const next = { ...current, ...patch };
  db.prepare(`UPDATE bot_presence_settings SET
    status = ?,
    activity_type = ?,
    activity_name = ?,
    updated_at = CURRENT_TIMESTAMP
    WHERE id = 1`).run(next.status, next.activity_type, next.activity_name);
  return getBotPresenceSettings();
}

export function applyBotPresence(client, settings = getBotPresenceSettings()) {
  if (!client.user) return;

  const map = {
    Playing: ActivityType.Playing,
    Streaming: ActivityType.Streaming,
    Listening: ActivityType.Listening,
    Watching: ActivityType.Watching,
    Competing: ActivityType.Competing
  };

  const type = map[settings.activity_type] ?? ActivityType.Playing;
  client.user.setPresence({
    status: settings.status,
    activities: settings.activity_name ? [{ name: settings.activity_name, type }] : []
  });
}
