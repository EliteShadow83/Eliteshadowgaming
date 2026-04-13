import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import { EmbedBuilder } from 'discord.js';
import { addAutomodTerm, getGuildSettings, listAutomodTerms, removeAutomodTerm, updateGuildSettings } from '../services/guildSettings.js';
import { getTicketSettings, updateTicketSettings } from '../services/ticketing.js';

const scopes = ['identify', 'guilds'];

export function createDashboard({ client }) {
  const app = express();

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false }));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((obj, done) => done(null, obj));

  passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL,
    scope: scopes
  }, (accessToken, refreshToken, profile, done) => done(null, profile)));

  app.get('/', (req, res) => {
    const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=${process.env.DISCORD_BOT_INVITE_PERMISSIONS || '8'}&scope=bot%20applications.commands`;
    res.send(renderPage('Elite Discord Suite', `
      <div class="hero">
        <h1>Elite Discord Suite</h1>
        <p>Premium-style moderation, automod, leveling, ticketing, and embeds from one dashboard.</p>
        <div class="actions">
          <a class="btn primary" href="/auth/discord">Login with Discord</a>
          <a class="btn" href="${inviteUrl}">Add Bot to Server</a>
        </div>
      </div>
    `));
  });

  app.get('/auth/discord', passport.authenticate('discord'));
  app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => res.redirect('/dashboard'));

  app.get('/dashboard', ensureAuth, (req, res) => {
    const manageableGuilds = req.user.guilds
      .filter((g) => (BigInt(g.permissions) & 0x20n) === 0x20n)
      .map((g) => ({
        id: g.id,
        name: g.name,
        inBot: client.guilds.cache.has(g.id)
      }));

    const cards = manageableGuilds.map((g) => `
      <article class="card">
        <h3>${escapeHtml(g.name)}</h3>
        <p class="muted">${g.inBot ? 'Connected' : 'Bot not added yet'}</p>
        ${g.inBot ? `<a class="btn small" href="/dashboard/${g.id}">Manage Server</a>` : '<p class="muted">Invite the bot first</p>'}
      </article>
    `).join('') || '<p class="muted">No manageable servers found.</p>';

    res.send(renderPage('Your Servers', `
      <h1>Your Servers</h1>
      <div class="grid">${cards}</div>
    `, req.user));
  });

  app.get('/dashboard/:guildId', ensureAuth, (req, res) => {
    const { guildId } = req.params;
    if (!userCanManageGuild(req.user, guildId)) return forbidden(res);

    const settings = getGuildSettings(guildId);
    res.send(renderPage('Guild Settings', `
      <h1>Guild Settings</h1>
      <div class="tabs">
        <a class="btn small" href="/dashboard/${guildId}/automod">Automod Setup</a>
        <a class="btn small" href="/dashboard/${guildId}/embed">Embed Creator</a>
        <a class="btn small" href="/dashboard/${guildId}/tickets">Ticketing Setup</a>
      </div>
      <form class="card form" method="post" action="/api/guilds/${guildId}/settings">
        <label>Prefix<input name="prefix" value="${escapeHtml(settings.prefix)}" /></label>
        <label class="inline"><input type="checkbox" name="automod_enabled" ${settings.automod_enabled ? 'checked' : ''}/> Enable automod</label>
        <label class="inline"><input type="checkbox" name="leveling_enabled" ${settings.leveling_enabled ? 'checked' : ''}/> Enable leveling</label>
        <button class="btn primary" type="submit">Save Settings</button>
      </form>
    `, req.user));
  });

  app.get('/dashboard/:guildId/automod', ensureAuth, (req, res) => {
    const { guildId } = req.params;
    if (!userCanManageGuild(req.user, guildId)) return forbidden(res);

    const settings = getGuildSettings(guildId);
    const words = listAutomodTerms(guildId);

    res.send(renderPage('Automod Setup', `
      <h1>Automod Setup</h1>
      <a class="btn small" href="/dashboard/${guildId}">Back</a>
      <div class="grid two">
        <form class="card form" method="post" action="/api/guilds/${guildId}/automod/settings">
          <h3>Behavior</h3>
          <label class="inline"><input type="checkbox" name="automod_enabled" ${settings.automod_enabled ? 'checked' : ''}/> Enable automod</label>
          <label class="inline"><input type="checkbox" name="block_links" ${settings.block_links ? 'checked' : ''}/> Block links</label>
          <label class="inline"><input type="checkbox" name="block_invites" ${settings.block_invites ? 'checked' : ''}/> Block Discord invites</label>
          <label>Max mentions<input type="number" name="max_mentions" min="1" max="20" value="${settings.max_mentions || 5}" /></label>
          <label class="inline"><input type="checkbox" name="automod_mute_enabled" ${settings.automod_mute_enabled ? 'checked' : ''}/> Enable tempmute on repeated removals</label>
          <label>Removal threshold<input type="number" name="automod_mute_threshold" min="1" max="20" value="${settings.automod_mute_threshold || 5}" /></label>
          <label>Window (minutes)<input type="number" name="automod_mute_window_minutes" min="1" max="120" value="${settings.automod_mute_window_minutes || 10}" /></label>
          <label>Tempmute duration (minutes)<input type="number" name="automod_mute_duration_minutes" min="1" max="1440" value="${settings.automod_mute_duration_minutes || 15}" /></label>
          <button class="btn primary" type="submit">Save Automod</button>
        </form>

        <div class="card">
          <h3>Blocked Words</h3>
          <p class="muted">${words.length ? escapeHtml(words.join(', ')) : 'No custom words yet.'}</p>
          <form class="form" method="post" action="/api/guilds/${guildId}/automod/words/add">
            <label>Add word<input name="word" required /></label>
            <button class="btn" type="submit">Add</button>
          </form>
          <form class="form" method="post" action="/api/guilds/${guildId}/automod/words/remove">
            <label>Remove word<input name="word" required /></label>
            <button class="btn" type="submit">Remove</button>
          </form>
        </div>
      </div>
    `, req.user));
  });

  app.get('/dashboard/:guildId/embed', ensureAuth, async (req, res) => {
    const { guildId } = req.params;
    if (!userCanManageGuild(req.user, guildId)) return forbidden(res);

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).send(renderPage('Not Found', '<p>Bot is not in this guild yet.</p>', req.user));

    const channels = await guild.channels.fetch();
    const options = channels
      .filter((channel) => channel?.isTextBased() && !channel.isDMBased())
      .map((channel) => `<option value="${channel.id}">#${escapeHtml(channel.name)}</option>`)
      .join('');

    res.send(renderPage('Embed Creator', `
      <h1>Embed Creator</h1>
      <a class="btn small" href="/dashboard/${guildId}">Back</a>
      <form class="card form" method="post" action="/api/guilds/${guildId}/embed/send">
        <label>Target channel<select name="channelId" required>${options}</select></label>
        <label>Title<input name="title" maxlength="256" /></label>
        <label>Description<textarea name="description" rows="6" maxlength="4096"></textarea></label>
        <label>Color<input name="color" value="#5865F2" /></label>
        <label>Footer<input name="footer" maxlength="2048" /></label>
        <label>Image URL<input name="imageUrl" type="url" /></label>
        <label>Thumbnail URL<input name="thumbnailUrl" type="url" /></label>
        <button class="btn primary" type="submit">Send Embed</button>
      </form>
    `, req.user));
  });

  app.get('/dashboard/:guildId/tickets', ensureAuth, (req, res) => {
    const { guildId } = req.params;
    if (!userCanManageGuild(req.user, guildId)) return forbidden(res);

    const settings = getTicketSettings(guildId);
    res.send(renderPage('Ticketing Setup', `
      <h1>Ticketing Setup</h1>
      <a class="btn small" href="/dashboard/${guildId}">Back</a>
      <form class="card form" method="post" action="/api/guilds/${guildId}/tickets">
        <label class="inline"><input type="checkbox" name="enabled" ${settings.enabled ? 'checked' : ''}/> Enable ticketing</label>
        <label>Category channel ID<input name="category_channel_id" value="${settings.category_channel_id ?? ''}" /></label>
        <label>Support role ID<input name="support_role_id" value="${settings.support_role_id ?? ''}" /></label>
        <label>Transcript log channel ID<input name="transcript_log_channel_id" value="${settings.transcript_log_channel_id ?? ''}" /></label>
        <label class="inline"><input type="checkbox" name="opener_can_close" ${settings.opener_can_close ? 'checked' : ''}/> Allow ticket opener to close</label>
        <button class="btn primary" type="submit">Save Ticket Settings</button>
      </form>
      <p class="muted">After saving, run <code>/ticketpanel</code> to publish the open-ticket button.</p>
    `, req.user));
  });

  app.post('/api/guilds/:guildId/settings', ensureAuth, (req, res) => {
    const { guildId } = req.params;
    if (!userCanManageGuild(req.user, guildId)) return res.status(403).json({ ok: false, error: 'forbidden' });

    const updated = updateGuildSettings(guildId, {
      prefix: req.body.prefix ?? '!',
      automod_enabled: Boolean(req.body.automod_enabled),
      leveling_enabled: Boolean(req.body.leveling_enabled)
    });

    if (wantsJson(req)) return res.json({ ok: true, settings: updated });
    res.redirect(`/dashboard/${guildId}`);
  });

  app.post('/api/guilds/:guildId/automod/settings', ensureAuth, (req, res) => {
    const { guildId } = req.params;
    if (!userCanManageGuild(req.user, guildId)) return res.status(403).json({ ok: false, error: 'forbidden' });

    const updated = updateGuildSettings(guildId, {
      automod_enabled: Boolean(req.body.automod_enabled),
      block_links: Boolean(req.body.block_links),
      block_invites: Boolean(req.body.block_invites),
      max_mentions: Math.max(1, Math.min(20, Number(req.body.max_mentions || 5))),
      automod_mute_enabled: Boolean(req.body.automod_mute_enabled),
      automod_mute_threshold: Math.max(1, Math.min(20, Number(req.body.automod_mute_threshold || 5))),
      automod_mute_window_minutes: Math.max(1, Math.min(120, Number(req.body.automod_mute_window_minutes || 10))),
      automod_mute_duration_minutes: Math.max(1, Math.min(1440, Number(req.body.automod_mute_duration_minutes || 15)))
    });

    if (wantsJson(req)) return res.json({ ok: true, settings: updated });
    res.redirect(`/dashboard/${guildId}/automod`);
  });

  app.post('/api/guilds/:guildId/automod/words/add', ensureAuth, (req, res) => {
    const { guildId } = req.params;
    if (!userCanManageGuild(req.user, guildId)) return res.status(403).json({ ok: false, error: 'forbidden' });

    const words = addAutomodTerm(guildId, req.body.word || '');
    if (wantsJson(req)) return res.json({ ok: true, words });
    res.redirect(`/dashboard/${guildId}/automod`);
  });

  app.post('/api/guilds/:guildId/automod/words/remove', ensureAuth, (req, res) => {
    const { guildId } = req.params;
    if (!userCanManageGuild(req.user, guildId)) return res.status(403).json({ ok: false, error: 'forbidden' });

    const words = removeAutomodTerm(guildId, req.body.word || '');
    if (wantsJson(req)) return res.json({ ok: true, words });
    res.redirect(`/dashboard/${guildId}/automod`);
  });

  app.post('/api/guilds/:guildId/tickets', ensureAuth, (req, res) => {
    const { guildId } = req.params;
    if (!userCanManageGuild(req.user, guildId)) return res.status(403).json({ ok: false, error: 'forbidden' });

    const updated = updateTicketSettings(guildId, {
      enabled: Boolean(req.body.enabled),
      category_channel_id: req.body.category_channel_id || null,
      support_role_id: req.body.support_role_id || null,
      transcript_log_channel_id: req.body.transcript_log_channel_id || null,
      opener_can_close: Boolean(req.body.opener_can_close)
    });

    if (wantsJson(req)) return res.json({ ok: true, settings: updated });
    res.redirect(`/dashboard/${guildId}/tickets`);
  });

  app.post('/api/guilds/:guildId/embed/send', ensureAuth, async (req, res) => {
    const { guildId } = req.params;
    if (!userCanManageGuild(req.user, guildId)) return res.status(403).json({ ok: false, error: 'forbidden' });

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ ok: false, error: 'guild_not_found' });

    const channel = await guild.channels.fetch(req.body.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return res.status(400).json({ ok: false, error: 'invalid_channel' });

    const embed = new EmbedBuilder();
    if (req.body.title) embed.setTitle(req.body.title.slice(0, 256));
    if (req.body.description) embed.setDescription(req.body.description.slice(0, 4096));
    if (req.body.color) embed.setColor(req.body.color);
    if (req.body.footer) embed.setFooter({ text: req.body.footer.slice(0, 2048) });
    if (req.body.imageUrl) embed.setImage(req.body.imageUrl);
    if (req.body.thumbnailUrl) embed.setThumbnail(req.body.thumbnailUrl);

    await channel.send({ embeds: [embed] });

    if (wantsJson(req)) return res.json({ ok: true });
    res.redirect(`/dashboard/${guildId}/embed`);
  });

  app.get('/healthz', (req, res) => res.json({ ok: true }));

  return app;
}

function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/auth/discord');
}

function userCanManageGuild(user, guildId) {
  const guild = user.guilds.find((g) => g.id === guildId);
  if (!guild) return false;
  return (BigInt(guild.permissions) & 0x20n) === 0x20n;
}

function wantsJson(req) {
  return req.headers['content-type']?.includes('application/json');
}

function forbidden(res) {
  return res.status(403).send(renderPage('Forbidden', '<p>You do not have Manage Server permission for this guild.</p>'));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderPage(title, body, user) {
  return `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Inter, Segoe UI, Arial, sans-serif; background: radial-gradient(circle at top, #1f2937 0%, #0b1020 45%); color: #e5e7eb; }
      .wrap { max-width: 1080px; margin: 0 auto; padding: 28px 20px 40px; }
      .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
      .logo { font-weight: 700; text-decoration: none; color: #fff; }
      .muted { color: #9ca3af; }
      .hero, .card { background: rgba(17,24,39,.7); border: 1px solid rgba(148,163,184,.25); backdrop-filter: blur(4px); border-radius: 14px; padding: 20px; }
      .hero h1, h1 { margin: 0 0 10px; }
      .actions, .tabs { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
      .btn { display: inline-block; padding: 10px 14px; border-radius: 10px; text-decoration: none; color: #e5e7eb; border: 1px solid #374151; background: #111827; }
      .btn:hover { border-color: #60a5fa; }
      .btn.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
      .btn.small { padding: 8px 12px; font-size: .9rem; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; margin-top: 14px; }
      .grid.two { grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); }
      .form { display: grid; gap: 12px; margin-top: 12px; }
      label { display: grid; gap: 6px; font-size: .95rem; }
      label.inline { display: flex; align-items: center; gap: 8px; }
      input, textarea, select { width: 100%; border-radius: 10px; border: 1px solid #374151; background: #0b1220; color: #e5e7eb; padding: 10px 12px; }
      code { background: #111827; border: 1px solid #334155; border-radius: 6px; padding: 2px 6px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="top">
        <a class="logo" href="/dashboard">⚡ Elite Discord Suite</a>
        <span class="muted">${user ? `Logged in as ${escapeHtml(user.username || user.id)}` : 'Discord Dashboard'}</span>
      </div>
      ${body}
    </div>
  </body>
  </html>`;
}
