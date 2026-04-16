import Database from 'better-sqlite3';

const db = new Database('data.sqlite');

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  prefix TEXT DEFAULT '!',
  welcome_enabled INTEGER DEFAULT 1,
  welcome_channel_id TEXT,
  leave_enabled INTEGER DEFAULT 0,
  leave_channel_id TEXT,
  join_message TEXT DEFAULT '👋 Welcome {user} to **{server}**!',
  leave_message TEXT DEFAULT '👋 {user_tag} has left **{server}**.',
  autorole_enabled INTEGER DEFAULT 0,
  autorole_role_id TEXT,
  logging_enabled INTEGER DEFAULT 0,
  moderation_log_channel_id TEXT,
  log_member_events INTEGER DEFAULT 1,
  log_message_edits INTEGER DEFAULT 1,
  log_message_deletes INTEGER DEFAULT 1,
  log_voice_events INTEGER DEFAULT 0,
  log_moderation_events INTEGER DEFAULT 1,
  log_automod_events INTEGER DEFAULT 1,
  giveaway_embed_title TEXT DEFAULT '🎉 Giveaway',
  giveaway_embed_description TEXT DEFAULT 'Prize: **{prize}**\nWinners: **{winners}**\nEnds: {ends_at}\n\nClick the button below to enter.',
  giveaway_embed_color TEXT DEFAULT '#F1C40F',
  giveaway_embed_footer TEXT DEFAULT 'Hosted by {host_tag}',
  giveaway_embed_image_url TEXT,
  giveaway_embed_thumbnail_url TEXT,
  giveaway_button_label TEXT DEFAULT 'Enter Giveaway',
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

CREATE TABLE IF NOT EXISTS embed_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  title TEXT,
  description TEXT,
  color TEXT DEFAULT '#5865F2',
  footer TEXT,
  image_url TEXT,
  thumbnail_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
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


CREATE TABLE IF NOT EXISTS vc_manager_settings (
  guild_id TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 0,
  lobby_channel_id TEXT,
  category_channel_id TEXT,
  channel_name_template TEXT DEFAULT '{user}''s VC',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS temp_voice_channels (
  channel_id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
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

CREATE TABLE IF NOT EXISTS giveaways (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  host_user_id TEXT NOT NULL,
  prize TEXT NOT NULL,
  winner_count INTEGER DEFAULT 1,
  ends_at TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  winners_csv TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  ended_at TEXT
);

CREATE TABLE IF NOT EXISTS giveaway_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  giveaway_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(giveaway_id, user_id)
);
`);

export default db;
