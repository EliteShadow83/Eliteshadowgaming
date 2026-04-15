import Database from 'better-sqlite3';

const db = new Database('data.sqlite');

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  prefix TEXT DEFAULT '!',
  welcome_enabled INTEGER DEFAULT 1,
  welcome_channel_id TEXT,
  moderation_log_channel_id TEXT,
  automod_enabled INTEGER DEFAULT 1,
  block_links INTEGER DEFAULT 0,
  block_invites INTEGER DEFAULT 1,
  max_mentions INTEGER DEFAULT 5,
  automod_mute_enabled INTEGER DEFAULT 0,
  automod_mute_threshold INTEGER DEFAULT 5,
  automod_mute_window_minutes INTEGER DEFAULT 10,
  automod_mute_duration_minutes INTEGER DEFAULT 15,
  leveling_enabled INTEGER DEFAULT 1,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS automod_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  term TEXT NOT NULL,
  UNIQUE(guild_id, term)
);

CREATE TABLE IF NOT EXISTS automod_violations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leveling (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  PRIMARY KEY (guild_id, user_id)
);


CREATE TABLE IF NOT EXISTS license_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_key TEXT NOT NULL UNIQUE,
  plan TEXT DEFAULT 'premium',
  status TEXT DEFAULT 'unused',
  max_servers INTEGER DEFAULT 1,
  redeemed_count INTEGER DEFAULT 0,
  bot_slug TEXT DEFAULT 'default',
  expires_at TEXT,
  created_by TEXT,
  redeemed_by_user_id TEXT,
  redeemed_guild_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  redeemed_at TEXT
);

CREATE TABLE IF NOT EXISTS guild_licenses (
  guild_id TEXT PRIMARY KEY,
  key_id INTEGER NOT NULL,
  bot_slug TEXT DEFAULT 'default',
  plan TEXT DEFAULT 'premium',
  status TEXT DEFAULT 'active',
  activated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS bot_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret TEXT,
  bot_token TEXT,
  permissions TEXT DEFAULT '8',
  status TEXT DEFAULT 'online',
  activity_type TEXT DEFAULT 'Playing',
  activity_name TEXT DEFAULT 'Managing your server',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bot_presence_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT DEFAULT 'online',
  activity_type TEXT DEFAULT 'Playing',
  activity_name TEXT DEFAULT 'Managing your server',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ticket_settings (
  guild_id TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 1,
  panel_channel_id TEXT,
  category_channel_id TEXT,
  support_role_id TEXT,
  transcript_log_channel_id TEXT,
  opener_can_close INTEGER DEFAULT 1,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  claimed_by_user_id TEXT,
  claimed_at TEXT,
  closed_by_user_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT
);
`);

export default db;
