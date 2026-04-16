import db from './db.js';

export function createGiveaway({ guildId, channelId, hostUserId, prize, winnerCount, endsAt }) {
  const result = db.prepare(`INSERT INTO giveaways (
    guild_id, channel_id, host_user_id, prize, winner_count, ends_at
  ) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(guildId, channelId, hostUserId, prize, winnerCount, endsAt.toISOString());

  return getGiveawayById(result.lastInsertRowid);
}

export function setGiveawayMessageId(giveawayId, messageId) {
  db.prepare('UPDATE giveaways SET message_id = ? WHERE id = ?').run(messageId, giveawayId);
  return getGiveawayById(giveawayId);
}

export function getGiveawayById(giveawayId) {
  return db.prepare('SELECT * FROM giveaways WHERE id = ?').get(giveawayId);
}

export function getActiveGiveawayByMessageId(messageId) {
  return db.prepare("SELECT * FROM giveaways WHERE message_id = ? AND status = 'active'").get(messageId);
}

export function addGiveawayEntry(giveawayId, userId) {
  db.prepare('INSERT OR IGNORE INTO giveaway_entries (giveaway_id, user_id) VALUES (?, ?)').run(giveawayId, userId);
}

export function listGiveawayEntries(giveawayId) {
  return db.prepare('SELECT user_id FROM giveaway_entries WHERE giveaway_id = ? ORDER BY created_at ASC').all(giveawayId).map((r) => r.user_id);
}

export function listDueActiveGiveaways(now = new Date()) {
  return db.prepare("SELECT * FROM giveaways WHERE status = 'active' AND ends_at <= ? ORDER BY ends_at ASC")
    .all(now.toISOString());
}

export function markGiveawayEnded(giveawayId, winners = []) {
  db.prepare(`UPDATE giveaways
    SET status = 'ended', winners_csv = ?, ended_at = CURRENT_TIMESTAMP
    WHERE id = ?`)
    .run(winners.join(','), giveawayId);
}
