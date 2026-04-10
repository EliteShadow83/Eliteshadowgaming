import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import { EmbedBuilder } from 'discord.js';
import { getGuildSettings, updateGuildSettings } from '../services/guildSettings.js';
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
    res.send(`
      <h1>Elite Discord Suite</h1>
      <p>Premium-style moderation, automod, leveling, and dashboard controls.</p>
      <p><a href="/auth/discord">Login with Discord</a></p>
      <p><a href="${inviteUrl}">Add bot to a server</a></p>
    `);
  });

  app.get('/auth/discord', passport.authenticate('discord'));
  app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => res.redirect('/dashboard'));

  app.get('/dashboard', ensureAuth, (req, res) => {
    const manageableGuilds = req.user.guilds
      .filter((g) => (BigInt(g.permissions) & 0x20n) === 0x20n)
      .map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.icon,
        inBot: client.guilds.cache.has(g.id)
      }));

    const items = manageableGuilds.map((g) => `
      <li>
        <strong>${g.name}</strong> - ${g.inBot ? 'Connected' : 'Bot not added'}
        ${g.inBot ? `<a href="/dashboard/${g.id}">Manage</a>` : ''}
      </li>`).join('');

    res.send(`<h1>Your Servers</h1><ul>${items}</ul>`);
  });

  app.get('/dashboard/:guildId', ensureAuth, (req, res) => {
    const { guildId } = req.params;
    if (!userCanManageGuild(req.user, guildId)) {
      res.status(403).send('You do not have Manage Server permission for this guild.');
      return;
    }

    const settings = getGuildSettings(guildId);
    res.send(`
      <h1>Guild Settings: ${guildId}</h1>
      <p><a href="/dashboard/${guildId}/embed">Open Embed Creator</a> | <a href="/dashboard/${guildId}/tickets">Ticketing Setup</a></p>
      <form method="post" action="/api/guilds/${guildId}/settings">
        <label>Prefix <input name="prefix" value="${settings.prefix}" /></label><br />
        <label>Automod <input type="checkbox" name="automod_enabled" ${settings.automod_enabled ? 'checked' : ''} /></label><br />
        <label>Leveling <input type="checkbox" name="leveling_enabled" ${settings.leveling_enabled ? 'checked' : ''} /></label><br />
        <button type="submit">Save</button>
      </form>
    `);
  });

  app.get('/dashboard/:guildId/embed', ensureAuth, async (req, res) => {
    const { guildId } = req.params;
    if (!userCanManageGuild(req.user, guildId)) {
      res.status(403).send('You do not have Manage Server permission for this guild.');
      return;
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      res.status(404).send('Bot is not in this guild yet.');
      return;
    }

    const channels = await guild.channels.fetch();
    const textChannels = channels
      .filter((channel) => channel?.isTextBased() && !channel.isDMBased())
      .map((channel) => `<option value="${channel.id}">#${channel.name}</option>`)
      .join('');

    res.send(`
      <h1>Embed Creator (${guild.name})</h1>
      <p><a href="/dashboard/${guildId}">Back to settings</a></p>
      <form method="post" action="/api/guilds/${guildId}/embed/send">
        <label>Target channel</label><br />
        <select name="channelId" required>${textChannels}</select><br /><br />

        <label>Title</label><br />
        <input name="title" maxlength="256" /><br /><br />

        <label>Description</label><br />
        <textarea name="description" rows="6" cols="60" maxlength="4096"></textarea><br /><br />

        <label>Color (hex, e.g. #5865F2)</label><br />
        <input name="color" value="#5865F2" /><br /><br />

        <label>Footer text</label><br />
        <input name="footer" maxlength="2048" /><br /><br />

        <label>Image URL</label><br />
        <input name="imageUrl" type="url" /><br /><br />

        <label>Thumbnail URL</label><br />
        <input name="thumbnailUrl" type="url" /><br /><br />

        <button type="submit">Send Embed</button>
      </form>
    `);
  });


  app.get('/dashboard/:guildId/tickets', ensureAuth, (req, res) => {
    const { guildId } = req.params;
    if (!userCanManageGuild(req.user, guildId)) {
      res.status(403).send('You do not have Manage Server permission for this guild.');
      return;
    }

    const settings = getTicketSettings(guildId);
    res.send(`
      <h1>Ticketing Setup: ${guildId}</h1>
      <p><a href="/dashboard/${guildId}">Back to settings</a></p>
      <p>Use <code>/ticketpanel</code> after setting IDs to publish the ticket button panel.</p>
      <form method="post" action="/api/guilds/${guildId}/tickets">
        <label>Enabled <input type="checkbox" name="enabled" ${settings.enabled ? 'checked' : ''} /></label><br /><br />

        <label>Category channel ID (optional)</label><br />
        <input name="category_channel_id" value="${settings.category_channel_id ?? ''}" /><br /><br />

        <label>Support role ID (optional)</label><br />
        <input name="support_role_id" value="${settings.support_role_id ?? ''}" /><br /><br />

        <label>Transcript log channel ID (optional)</label><br />
        <input name="transcript_log_channel_id" value="${settings.transcript_log_channel_id ?? ''}" /><br /><br />

        <button type="submit">Save Ticket Settings</button>
      </form>
    `);
  });

  app.post('/api/guilds/:guildId/settings', ensureAuth, (req, res) => {
    const { guildId } = req.params;
    if (!userCanManageGuild(req.user, guildId)) {
      res.status(403).json({ ok: false, error: 'forbidden' });
      return;
    }

    const updated = updateGuildSettings(guildId, {
      prefix: req.body.prefix ?? '!',
      automod_enabled: Boolean(req.body.automod_enabled),
      leveling_enabled: Boolean(req.body.leveling_enabled)
    });

    if (req.headers['content-type']?.includes('application/json')) {
      res.json({ ok: true, settings: updated });
      return;
    }

    res.redirect(`/dashboard/${guildId}`);
  });


  app.post('/api/guilds/:guildId/tickets', ensureAuth, (req, res) => {
    const { guildId } = req.params;
    if (!userCanManageGuild(req.user, guildId)) {
      res.status(403).json({ ok: false, error: 'forbidden' });
      return;
    }

    const updated = updateTicketSettings(guildId, {
      enabled: Boolean(req.body.enabled),
      category_channel_id: req.body.category_channel_id || null,
      support_role_id: req.body.support_role_id || null,
      transcript_log_channel_id: req.body.transcript_log_channel_id || null
    });

    if (req.headers['content-type']?.includes('application/json')) {
      res.json({ ok: true, settings: updated });
      return;
    }

    res.redirect(`/dashboard/${guildId}/tickets`);
  });

  app.post('/api/guilds/:guildId/embed/send', ensureAuth, async (req, res) => {
    const { guildId } = req.params;
    if (!userCanManageGuild(req.user, guildId)) {
      res.status(403).json({ ok: false, error: 'forbidden' });
      return;
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      res.status(404).json({ ok: false, error: 'guild_not_found' });
      return;
    }

    const channel = await guild.channels.fetch(req.body.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      res.status(400).json({ ok: false, error: 'invalid_channel' });
      return;
    }

    const embed = new EmbedBuilder();

    if (req.body.title) embed.setTitle(req.body.title.slice(0, 256));
    if (req.body.description) embed.setDescription(req.body.description.slice(0, 4096));
    if (req.body.color) embed.setColor(req.body.color);
    if (req.body.footer) embed.setFooter({ text: req.body.footer.slice(0, 2048) });
    if (req.body.imageUrl) embed.setImage(req.body.imageUrl);
    if (req.body.thumbnailUrl) embed.setThumbnail(req.body.thumbnailUrl);

    await channel.send({ embeds: [embed] });

    if (req.headers['content-type']?.includes('application/json')) {
      res.json({ ok: true });
      return;
    }

    res.redirect(`/dashboard/${guildId}/embed`);
  });

  app.get('/healthz', (req, res) => res.json({ ok: true }));

  return app;
}

function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/auth/discord');
}

function userCanManageGuild(user, guildId) {
  const guild = user.guilds.find((g) => g.id === guildId);
  if (!guild) return false;
  return (BigInt(guild.permissions) & 0x20n) === 0x20n;
}
