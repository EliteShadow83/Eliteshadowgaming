import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import { EmbedBuilder } from 'discord.js';
import { addAutomodTerm, getGuildSettings, listAutomodTerms, removeAutomodTerm, updateGuildSettings } from '../services/guildSettings.js';
import { getTicketSettings, updateTicketSettings } from '../services/ticketing.js';
import { getVcManagerSettings, updateVcManagerSettings } from '../services/vcManager.js';
import db from '../services/db.js';
import { createManualLicenseKey, getGuildLicense, hasActiveLicense, listRecentLicenseKeys, redeemLicenseKey } from '../services/paywall.js';
import { applyBotVariantPresence, createBotVariant, getBotVariantBySlug, getBotVariants, updateBotVariant } from '../services/bots.js';

const scopes = ['identify', 'guilds'];

export function createDashboard({ client, botRuntime }) {
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
          <a class="btn" href="/dashboard/licenses">Manage License Keys</a>
        </div>
      </div>
    `));
  });

  app.get('/auth/discord', passport.authenticate('discord'));
  app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => res.redirect('/dashboard'));


  app.post('/dashboard/admin/unlock', ensureAuth, (req, res) => {
    const returnTo = req.body.returnTo || '/dashboard';
    if (!process.env.DASHBOARD_ADMIN_SECRET || req.body.adminSecret !== process.env.DASHBOARD_ADMIN_SECRET) {
      return res.status(403).send(renderAdminUnlockPage(req.user, 'Invalid admin secret.', returnTo));
    }

    req.session.adminUnlocked = true;
    res.redirect(returnTo);
  });

  app.get('/dashboard', ensureAuth, (req, res) => {
    const manageableGuilds = req.user.guilds
      .filter((g) => (BigInt(g.permissions) & 0x20n) === 0x20n)
      .map((g) => ({
        id: g.id,
        name: g.name,
        inBot: client.guilds.cache.has(g.id),
        licensed: hasActiveLicense(g.id, getBotVariants()[0]?.slug || 'default')
      }));

    const cards = manageableGuilds.map((g) => `
      <article class="card">
        <h3>${escapeHtml(g.name)}</h3>
        <p class="muted">${g.inBot ? 'Connected' : 'Bot not added yet'} • License: ${g.licensed ? 'Active' : 'Required'}</p>
        <div class="actions">
          ${g.inBot ? `<a class="btn small" href="/dashboard/${g.id}">Manage Server</a>` : `<a class="btn small" href="/dashboard/invite/${g.id}?bot=${getBotVariants()[0]?.slug || 'default'}">Invite Bot</a>`}
          ${!g.licensed ? `<a class="btn small" href="/dashboard/licenses?guildId=${g.id}">Unlock</a>` : ''}
        </div>
      </article>
    `).join('') || '<p class="muted">No manageable servers found.</p>';

    res.send(renderPage('Your Servers', `
      <h1>Your Servers</h1>
      <p><a class="btn small" href="/dashboard/database">Open Database Manager</a> <a class="btn small" href="/dashboard/bots">Bot Manager</a> <a class="btn small" href="/dashboard/licenses">License Keys</a></p>
      <div class="grid">${cards}</div>
    `, req.user));
  });




  app.get('/dashboard/licenses', ensureAuth, (req, res) => {
    const manageableGuilds = req.user.guilds
      .filter((g) => (BigInt(g.permissions) & 0x20n) === 0x20n)
      .map((g) => ({ id: g.id, name: g.name, licensed: hasActiveLicense(g.id) }));

    const botVariants = getBotVariants();
    const selectedBot = botVariants.find((b) => b.slug === req.query.bot)?.slug || botVariants[0]?.slug || 'default';
    const selectedGuildId = manageableGuilds.find((g) => g.id === req.query.guildId)?.id || manageableGuilds[0]?.id || '';
    const guildOptions = manageableGuilds.map((g) => `<option value="${g.id}" ${g.id === selectedGuildId ? 'selected' : ''}>${escapeHtml(g.name)} (${g.licensed ? 'licensed' : 'unlicensed'})</option>`).join('');
    const botOptions = botVariants.map((b) => `<option value="${b.slug}" ${b.slug === selectedBot ? 'selected' : ''}>${escapeHtml(b.name)} (${b.slug})</option>`).join('');
    const canViewSecrets = isAdminUnlocked(req);
    const recentKeys = canViewSecrets
      ? listRecentLicenseKeys(30).map((k) => `<li><code>${k.license_key}</code> — ${k.status} — plan: ${k.plan} — bot: ${k.bot_slug} — usage: ${k.redeemed_count || 0}/${k.max_servers || 1}${k.expires_at ? ` — expires ${k.expires_at}` : ''}</li>`).join('')
      : '';
    const adminPanel = canViewSecrets ? `
      <form class="card form" method="post" action="/dashboard/licenses/create">
        <h3>Manual Key Creation</h3>
        <label>Bot<select name="botSlug">${botOptions}</select></label>
        <label>Plan<input name="plan" value="premium" /></label>
        <label>Max servers<input name="maxServers" type="number" min="1" value="1" /></label>
        <label>Expires at (optional, ISO date)<input name="expiresAt" placeholder="2026-12-31T00:00:00Z" /></label>
        <button class="btn" type="submit">Create Manual Key</button>
      </form>` : renderAdminUnlockCard('/dashboard/licenses', 'Unlock to view/create recent keys.');

    res.send(renderPage('License Paywall', `
      <h1>License Paywall</h1>
      <p class="muted">A valid license key is required before inviting the bot to a server.</p>

      <div class="grid two">
        <form class="card form" method="post" action="/dashboard/licenses/redeem">
          <h3>Redeem Key for Server</h3>
          <label>Server<select name="guildId" required>${guildOptions}</select></label>
          <label>License key<input name="licenseKey" required /></label>
          <p class="muted">Keys can be valid for multiple servers depending on key limits.</p>
          <button class="btn primary" type="submit">Redeem Key</button>
        </form>

${adminPanel}
      </div>

      <div class="card">
        <h3>Recent Keys</h3>
        ${canViewSecrets ? `<ul>${recentKeys || '<li>No keys yet</li>'}</ul>` : '<p class="muted">Unlock admin access to view recent keys.</p>'}
      </div>
    `, req.user));
  });

  app.post('/dashboard/licenses/redeem', ensureAuth, (req, res) => {
    try {
      const guildId = req.body.guildId;
      if (!userCanManageGuild(req.user, guildId)) return forbidden(res);
      redeemLicenseKey({ licenseKey: req.body.licenseKey || '', guildId, userId: req.user.id });
      res.redirect(`/dashboard/licenses?guildId=${guildId}`);
    } catch (err) {
      res.status(400).send(renderPage('Redeem Failed', `<p>${escapeHtml(err.message)}</p><p><a class="btn" href="/dashboard/licenses">Back</a></p>`, req.user));
    }
  });

  app.post('/dashboard/licenses/create', ensureAuth, (req, res) => {
    if (!isAdminUnlocked(req)) {
      return res.status(403).send(renderAdminUnlockPage(req.user, 'Admin unlock required.', '/dashboard/licenses'));
    }

    const created = createManualLicenseKey({
      plan: req.body.plan || 'premium',
      botSlug: req.body.botSlug || 'default',
      maxServers: Number(req.body.maxServers || 1),
      expiresAt: req.body.expiresAt || null,
      createdBy: req.user.id
    });

    res.send(renderPage('Key Created', `<h1>Manual License Key Created</h1><p><code>${created.license_key}</code></p><p>Bot: <strong>${created.bot_slug}</strong></p><p>Valid for <strong>${created.max_servers}</strong> server(s).</p><p><a class=\"btn\" href=\"/dashboard/licenses\">Back to license manager</a></p>`, req.user));
  });

  app.get('/dashboard/invite/:guildId', ensureAuth, (req, res) => {
    const { guildId } = req.params;
    const botSlug = req.query.bot || getBotVariants()[0]?.slug || 'default';
    const bot = getBotVariantBySlug(botSlug);
    if (!userCanManageGuild(req.user, guildId)) return forbidden(res);

    if (!hasActiveLicense(guildId, botSlug)) {
      return res.redirect(`/dashboard/licenses?guildId=${guildId}&bot=${botSlug}`);
    }

    const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${bot.client_id}&permissions=${bot.permissions || '8'}&scope=bot%20applications.commands&guild_id=${guildId}&disable_guild_select=true`;
    res.redirect(inviteUrl);
  });

  app.get('/dashboard/bots', ensureAuth, (req, res) => {
    if (!isAdminUnlocked(req)) {
      return res.status(403).send(renderAdminUnlockPage(req.user, 'Admin unlock required for bot manager.', '/dashboard/bots'));
    }

    const bots = getBotVariants();
    const runningSet = new Set(botRuntime?.listRunningSlugs?.() || []);
    const cards = bots.map((b) => `
      <div class=\"card\">
        <form class=\"form\" method=\"post\" action=\"/dashboard/bots/${b.slug}\">
          <h3>${escapeHtml(b.name)} (${b.slug})</h3>
          <p class=\"muted\">Runtime: ${runningSet.has(b.slug) ? 'Running' : 'Stopped'}</p>
          <label>Name<input name=\"name\" value=\"${escapeHtml(b.name)}\" /></label>
          <label>Client ID<input name=\"clientId\" value=\"${escapeHtml(b.client_id)}\" /></label>
          <label>Client Secret<input name=\"clientSecret\" value=\"${escapeHtml(b.client_secret || '')}\" /></label>
          <label>Bot Token<input name=\"botToken\" value=\"${escapeHtml(b.bot_token || '')}\" /></label>
          <label>Permissions<input name=\"permissions\" value=\"${escapeHtml(b.permissions || '8')}\" /></label>
          <label>Status<input name=\"status\" value=\"${escapeHtml(b.status || 'online')}\" /></label>
          <label>Activity Type<input name=\"activityType\" value=\"${escapeHtml(b.activity_type || 'Playing')}\" /></label>
          <label>Activity Name<input name=\"activityName\" value=\"${escapeHtml(b.activity_name || '')}\" /></label>
          <button class=\"btn\" type=\"submit\">Save Bot</button>
        </form>
        <div class=\"actions\">
          <form method=\"post\" action=\"/dashboard/bots/${b.slug}/start\"><button class=\"btn\" type=\"submit\">Start</button></form>
          <form method=\"post\" action=\"/dashboard/bots/${b.slug}/stop\"><button class=\"btn\" type=\"submit\">Stop</button></form>
        </div>
      </div>`).join('');

    res.send(renderPage('Bot Manager', `
      <h1>Bot Manager</h1>
      <p class=\"muted\">Admin can add/edit bots and their default presence settings.</p>
      <form class=\"card form\" method=\"post\" action=\"/dashboard/bots/create\">
        <h3>Add Bot</h3>
        <label>Slug<input name=\"slug\" required /></label>
        <label>Name<input name=\"name\" required /></label>
        <label>Client ID<input name=\"clientId\" required /></label>
        <label>Client Secret<input name=\"clientSecret\" /></label>
        <label>Bot Token<input name=\"botToken\" /></label>
        <label>Permissions<input name=\"permissions\" value=\"8\" /></label>
        <label>Status<input name=\"status\" value=\"online\" /></label>
        <label>Activity Type<input name=\"activityType\" value=\"Playing\" /></label>
        <label>Activity Name<input name=\"activityName\" value=\"Managing your server\" /></label>
        <button class=\"btn primary\" type=\"submit\">Create Bot</button>
      </form>
      <div class=\"grid\">${cards}</div>
    `, req.user));
  });

  app.post('/dashboard/bots/create', ensureAuth, (req, res) => {
    if (!isAdminUnlocked(req)) {
      return res.status(403).send(renderAdminUnlockPage(req.user, 'Admin unlock required for bot manager.', '/dashboard/bots'));
    }

    createBotVariant(req.body);
    res.redirect('/dashboard/bots');
  });

  app.post('/dashboard/bots/:slug', ensureAuth, (req, res) => {
    if (!isAdminUnlocked(req)) {
      return res.status(403).send(renderAdminUnlockPage(req.user, 'Admin unlock required for bot manager.', '/dashboard/bots'));
    }

    updateBotVariant(req.params.slug, req.body);
    res.redirect('/dashboard/bots');
  });

  app.post('/dashboard/bots/:slug/start', ensureAuth, async (req, res) => {
    if (!isAdminUnlocked(req)) {
      return res.status(403).send(renderAdminUnlockPage(req.user, 'Admin unlock required for bot manager.', '/dashboard/bots'));
    }

    try {
      const bot = getBotVariantBySlug(req.params.slug);
      await botRuntime.startVariant(bot);
      res.redirect('/dashboard/bots');
    } catch (err) {
      res.status(400).send(renderPage('Start Failed', `<p>${escapeHtml(err.message)}</p><p><a class="btn" href="/dashboard/bots">Back</a></p>`, req.user));
    }
  });

  app.post('/dashboard/bots/:slug/stop', ensureAuth, async (req, res) => {
    if (!isAdminUnlocked(req)) {
      return res.status(403).send(renderAdminUnlockPage(req.user, 'Admin unlock required for bot manager.', '/dashboard/bots'));
    }

    try {
      await botRuntime.stopVariant(req.params.slug);
      res.redirect('/dashboard/bots');
    } catch (err) {
      res.status(400).send(renderPage('Stop Failed', `<p>${escapeHtml(err.message)}</p><p><a class="btn" href="/dashboard/bots">Back</a></p>`, req.user));
    }
  });

  app.post('/api/guilds/:guildId/bot-presence', ensureAuth, (req, res) => {
    const { guildId } = req.params;
    if (!userCanManageGuild(req.user, guildId)) return res.status(403).json({ ok: false, error: 'forbidden' });

    const bot = updateBotVariant(req.body.botSlug || 'default', {
      status: req.body.status || 'online',
      activityType: req.body.activityType || 'Playing',
      activityName: req.body.activityName || ''
    });

    const runningSlug = process.env.RUNNING_BOT_SLUG || 'default';
    if (bot && bot.slug === runningSlug) applyBotVariantPresence(client, bot);

    if (wantsJson(req)) return res.json({ ok: true, bot });
    res.redirect(`/dashboard/${guildId}?bot=${encodeURIComponent(req.body.botSlug || 'default')}`);
  });

  app.get('/dashboard/database', ensureAuth, (req, res) => {
    if (!isAdminUnlocked(req)) {
      return res.status(403).send(renderAdminUnlockPage(req.user, 'Admin unlock required for database manager.', '/dashboard/database'));
    }
    const tables = listTables();
    const selectedTable = sanitizeIdentifier(req.query.table) && tables.includes(req.query.table) ? req.query.table : tables[0];
    const rows = selectedTable ? db.prepare(`SELECT * FROM ${selectedTable} LIMIT 200`).all() : [];
    const columns = selectedTable ? db.prepare(`PRAGMA table_info(${selectedTable})`).all() : [];
    const pkColumn = columns.find((c) => c.pk)?.name || 'id';

    const tableOptions = tables.map((t) => `<option value="${t}" ${t === selectedTable ? 'selected' : ''}>${t}</option>`).join('');
    const rowCards = rows.map((row) => {
      const pkValue = row[pkColumn];
      return `
        <details class="card">
          <summary><strong>${pkColumn}:</strong> ${escapeHtml(String(pkValue ?? '(null)'))}</summary>
          <form class="form" method="post" action="/dashboard/database/upsert">
            <input type="hidden" name="table" value="${selectedTable}" />
            <input type="hidden" name="pkColumn" value="${pkColumn}" />
            <input type="hidden" name="pkValue" value="${escapeHtml(String(pkValue ?? ''))}" />
            <label>Row JSON<textarea name="payload" rows="8">${escapeHtml(JSON.stringify(row, null, 2))}</textarea></label>
            <button class="btn" type="submit">Save Row</button>
          </form>
          <form method="post" action="/dashboard/database/delete">
            <input type="hidden" name="table" value="${selectedTable}" />
            <input type="hidden" name="pkColumn" value="${pkColumn}" />
            <input type="hidden" name="pkValue" value="${escapeHtml(String(pkValue ?? ''))}" />
            <button class="btn" type="submit">Delete Row</button>
          </form>
        </details>`;
    }).join('') || '<p class="muted">No rows found.</p>';

    res.send(renderPage('Database Manager', `
      <h1>Database Manager</h1>
      <p class="muted">Browse and edit SQLite data directly from the dashboard.</p>
      <form class="card form" method="get" action="/dashboard/database">
        <label>Table<select name="table">${tableOptions}</select></label>
        <button class="btn" type="submit">Load Table</button>
      </form>

      <div class="card">
        <h3>Create New Row (${selectedTable || 'No table'})</h3>
        <form class="form" method="post" action="/dashboard/database/upsert">
          <input type="hidden" name="table" value="${selectedTable || ''}" />
          <input type="hidden" name="pkColumn" value="${pkColumn}" />
          <input type="hidden" name="pkValue" value="" />
          <label>Row JSON<textarea name="payload" rows="8" placeholder='{"column":"value"}'></textarea></label>
          <button class="btn primary" type="submit">Insert Row</button>
        </form>
      </div>

      <form class="card form" method="post" action="/dashboard/database/drop-table">
        <h3>Debug: Delete Table</h3>
        <p class="muted">This permanently drops a table and all data.</p>
        <label>Table to delete<select name="table" required>${tableOptions}</select></label>
        <label>Type DELETE to confirm<input name="confirmWord" required /></label>
        <button class="btn" type="submit">Drop Table</button>
      </form>

      <h2>Rows (${rows.length})</h2>
      <div class="grid">${rowCards}</div>
    `, req.user));
  });

  app.post('/dashboard/database/upsert', ensureAuth, (req, res) => {
    if (!isAdminUnlocked(req)) {
      return res.status(403).send(renderAdminUnlockPage(req.user, 'Admin unlock required for database manager.', '/dashboard/database'));
    }
    const table = sanitizeIdentifier(req.body.table);
    const pkColumn = sanitizeIdentifier(req.body.pkColumn);
    const pkValue = req.body.pkValue;
    if (!table || !pkColumn) return res.status(400).send('Invalid table or primary key.');

    let payload;
    try {
      payload = JSON.parse(req.body.payload || '{}');
    } catch {
      return res.status(400).send('Payload must be valid JSON.');
    }

    const entries = Object.entries(payload).filter(([key]) => sanitizeIdentifier(key));
    if (!entries.length) return res.redirect(`/dashboard/database?table=${table}`);

    if (pkValue) {
      const updateEntries = entries.filter(([key]) => key !== pkColumn);
      if (updateEntries.length) {
        const setClause = updateEntries.map(([key]) => `${key} = ?`).join(', ');
        db.prepare(`UPDATE ${table} SET ${setClause} WHERE ${pkColumn} = ?`).run(...updateEntries.map(([, value]) => value), pkValue);
      }
    } else {
      const cols = entries.map(([key]) => key);
      const placeholders = cols.map(() => '?').join(', ');
      db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`).run(...entries.map(([, value]) => value));
    }

    res.redirect(`/dashboard/database?table=${table}`);
  });

  app.post('/dashboard/database/delete', ensureAuth, (req, res) => {
    if (!isAdminUnlocked(req)) {
      return res.status(403).send(renderAdminUnlockPage(req.user, 'Admin unlock required for database manager.', '/dashboard/database'));
    }
    const table = sanitizeIdentifier(req.body.table);
    const pkColumn = sanitizeIdentifier(req.body.pkColumn);
    const pkValue = req.body.pkValue;
    if (!table || !pkColumn || !pkValue) return res.status(400).send('Missing delete parameters.');

    db.prepare(`DELETE FROM ${table} WHERE ${pkColumn} = ?`).run(pkValue);
    res.redirect(`/dashboard/database?table=${table}`);
  });

  app.post('/dashboard/database/drop-table', ensureAuth, (req, res) => {
    if (!isAdminUnlocked(req)) {
      return res.status(403).send(renderAdminUnlockPage(req.user, 'Admin unlock required for database manager.', '/dashboard/database'));
    }

    const table = sanitizeIdentifier(req.body.table);
    if (!table) return res.status(400).send('Invalid table name.');
    if (req.body.confirmWord !== 'DELETE') return res.status(400).send('Confirmation word must be DELETE.');

    db.prepare(`DROP TABLE IF EXISTS ${table}`).run();
    res.redirect('/dashboard/database');
  });

  app.get('/dashboard/:guildId', ensureAuth, (req, res) => {
    const { guildId } = req.params;
    if (!userCanManageGuild(req.user, guildId)) return forbidden(res);

    const settings = getGuildSettings(guildId);
    const allBots = getBotVariants();
    const allowedBots = isAdminUnlocked(req)
      ? allBots
      : allBots.filter((b) => botRuntime?.isVariantInGuild?.(b.slug, guildId));
    const fallbackBot = allowedBots[0] || allBots[0];
    const selectedBotSlug = allowedBots.find((b) => b.slug === req.query.bot)?.slug || fallbackBot?.slug || 'default';
    const selectedBot = getBotVariantBySlug(selectedBotSlug);
    const license = getGuildLicense(guildId, selectedBotSlug);
    const botOptions = allowedBots.map((b) => `<option value="${b.slug}" ${b.slug === selectedBotSlug ? 'selected' : ''}>${escapeHtml(b.name)} (${b.slug})</option>`).join('');
    res.send(renderPage('Guild Settings', `
      <h1>Guild Settings</h1>
      <form class="card form" method="get" action="/dashboard/${guildId}">
        <label>Bot for this page<select name="bot">${botOptions}</select></label>
        <div class="actions"><button class="btn" type="submit">Switch Bot Context</button><a class="btn" href="/dashboard/invite/${guildId}?bot=${selectedBotSlug}">Invite Additional Bot</a></div>
      </form>
      <p class="muted">License (${selectedBotSlug}): ${license ? `${license.plan} (${license.status})` : "No active license"}</p>
      <div class="tabs">
        <a class="btn small" href="/dashboard/${guildId}/automod">Automod Setup</a>
        <a class="btn small" href="/dashboard/${guildId}/logs">Logging Setup</a>
        <a class="btn small" href="/dashboard/${guildId}/vc-manager">VC Manager Setup</a>
        <a class="btn small" href="/dashboard/${guildId}/giveaway-settings">Giveaway Embed Setup</a>
        <a class="btn small" href="/dashboard/${guildId}/embed">Embed Creator</a>
        <a class="btn small" href="/dashboard/${guildId}/tickets">Ticketing Setup</a>
      </div>
      <form class="card form" method="post" action="/api/guilds/${guildId}/settings">
        <label>Prefix<input name="prefix" value="${escapeHtml(settings.prefix)}" /></label>
        <label class="inline"><input type="checkbox" name="automod_enabled" ${settings.automod_enabled ? 'checked' : ''}/> Enable automod</label>
        <label class="inline"><input type="checkbox" name="leveling_enabled" ${settings.leveling_enabled ? 'checked' : ''}/> Enable leveling</label>
        <button class="btn primary" type="submit">Save Settings</button>
      </form>

      <form class="card form" method="post" action="/api/guilds/${guildId}/bot-presence">
        <input type="hidden" name="botSlug" value="${selectedBotSlug}" />
        <h3>Bot Presence (${selectedBotSlug})</h3>
        <label>Status
          <select name="status">
            ${['online','idle','dnd','invisible'].map((status) => `<option value="${status}" ${selectedBot.status === status ? 'selected' : ''}>${status}</option>`).join('')}
          </select>
        </label>
        <label>Activity type
          <select name="activityType">
            ${['Playing','Streaming','Listening','Watching','Competing'].map((type) => `<option value="${type}" ${selectedBot.activity_type === type ? 'selected' : ''}>${type}</option>`).join('')}
          </select>
        </label>
        <label>Activity text<input name="activityName" value="${escapeHtml(selectedBot.activity_name || '')}" maxlength="128" /></label>
        <button class="btn" type="submit">Save Presence for This Bot</button>
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
      <div class="grid two">
        <form id="embedForm" class="card form" method="post" action="/api/guilds/${guildId}/embed/send">
          <label>Target channel<select name="channelId" required>${options}</select></label>
          <label>Title<input name="title" maxlength="256" /></label>
          <label>Description<textarea name="description" rows="6" maxlength="4096"></textarea></label>
          <label>Color<input name="color" value="#5865F2" /></label>
          <label>Footer<input name="footer" maxlength="2048" /></label>
          <label>Image URL<input name="imageUrl" type="url" /></label>
          <label>Thumbnail URL<input name="thumbnailUrl" type="url" /></label>
          <button class="btn primary" type="submit">Send Embed</button>
        </form>

        <div class="card">
          <h3>Live Preview</h3>
          <div id="embedPreview" style="border-left:4px solid #5865F2;padding:12px;background:#111827;border-radius:8px;">
            <div id="previewTitle" style="font-weight:700;font-size:1rem;margin-bottom:8px;">Embed title preview</div>
            <div id="previewDescription" class="muted" style="white-space:pre-wrap;">Embed description preview</div>
            <div id="previewImageWrap" style="margin-top:10px;display:none;"><img id="previewImage" alt="embed image" style="max-width:100%;border-radius:8px;" /></div>
            <div id="previewFooter" class="muted" style="margin-top:10px;font-size:.85rem;"></div>
          </div>
        </div>
      </div>

      <script>
        (function () {
          const form = document.getElementById('embedForm');
          const title = form.querySelector('input[name="title"]');
          const desc = form.querySelector('textarea[name="description"]');
          const color = form.querySelector('input[name="color"]');
          const footer = form.querySelector('input[name="footer"]');
          const image = form.querySelector('input[name="imageUrl"]');

          const titleOut = document.getElementById('previewTitle');
          const descOut = document.getElementById('previewDescription');
          const footerOut = document.getElementById('previewFooter');
          const preview = document.getElementById('embedPreview');
          const imageWrap = document.getElementById('previewImageWrap');
          const imageOut = document.getElementById('previewImage');

          function render() {
            titleOut.textContent = title.value || 'Embed title preview';
            descOut.textContent = desc.value || 'Embed description preview';
            footerOut.textContent = footer.value || '';
            preview.style.borderLeftColor = color.value || '#5865F2';

            if (image.value) {
              imageOut.src = image.value;
              imageWrap.style.display = 'block';
            } else {
              imageOut.removeAttribute('src');
              imageWrap.style.display = 'none';
            }
          }

          [title, desc, color, footer, image].forEach((el) => el.addEventListener('input', render));
          render();
        })();
      </script>
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

  app.get('/dashboard/:guildId/logs', ensureAuth, async (req, res) => {
    const { guildId } = req.params;
    if (!userCanManageGuild(req.user, guildId)) return forbidden(res);

    const settings = getGuildSettings(guildId);
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).send(renderPage('Not Found', '<p>Bot is not in this guild yet.</p>', req.user));

    const channels = await guild.channels.fetch();
    const channelOptions = channels
      .filter((channel) => channel?.isTextBased() && !channel.isDMBased())
      .map((channel) => `<option value="${channel.id}" ${settings.moderation_log_channel_id === channel.id ? 'selected' : ''}>#${escapeHtml(channel.name)}</option>`)
      .join('');

    res.send(renderPage('Logging Setup', `
      <h1>Logging Setup</h1>
      <a class="btn small" href="/dashboard/${guildId}">Back</a>
      <form class="card form" method="post" action="/api/guilds/${guildId}/logs">
        <label class="inline"><input type="checkbox" name="logging_enabled" ${settings.logging_enabled ? 'checked' : ''}/> Enable logging</label>
        <label>Log channel
          <select name="moderation_log_channel_id">
            <option value="">Select a channel</option>
            ${channelOptions}
          </select>
        </label>
        <label class="inline"><input type="checkbox" name="log_member_events" ${settings.log_member_events ? 'checked' : ''}/> Member join/leave events</label>
        <label class="inline"><input type="checkbox" name="log_message_edits" ${settings.log_message_edits ? 'checked' : ''}/> Message edits</label>
        <label class="inline"><input type="checkbox" name="log_message_deletes" ${settings.log_message_deletes ? 'checked' : ''}/> Message deletes</label>
        <label class="inline"><input type="checkbox" name="log_voice_events" ${settings.log_voice_events ? 'checked' : ''}/> Voice updates</label>
        <label class="inline"><input type="checkbox" name="log_moderation_events" ${settings.log_moderation_events ? 'checked' : ''}/> Moderation actions</label>
        <label class="inline"><input type="checkbox" name="log_automod_events" ${settings.log_automod_events ? 'checked' : ''}/> Automod actions</label>
        <button class="btn primary" type="submit">Save Logging Settings</button>
      </form>
    `, req.user));
  });

  app.get('/dashboard/:guildId/vc-manager', ensureAuth, async (req, res) => {
    const { guildId } = req.params;
    if (!userCanManageGuild(req.user, guildId)) return forbidden(res);

    const settings = getVcManagerSettings(guildId);
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).send(renderPage('Not Found', '<p>Bot is not in this guild yet.</p>', req.user));

    const channels = await guild.channels.fetch();
    const voiceOptions = channels
      .filter((channel) => channel && channel.type === 2)
      .map((channel) => `<option value="${channel.id}" ${settings.lobby_channel_id === channel.id ? 'selected' : ''}>${escapeHtml(channel.name)}</option>`)
      .join('');
    const categoryOptions = channels
      .filter((channel) => channel && channel.type === 4)
      .map((channel) => `<option value="${channel.id}" ${settings.category_channel_id === channel.id ? 'selected' : ''}>${escapeHtml(channel.name)}</option>`)
      .join('');

    res.send(renderPage('VC Manager Setup', `
      <h1>VC Manager Setup</h1>
      <a class="btn small" href="/dashboard/${guildId}">Back</a>
      <form class="card form" method="post" action="/api/guilds/${guildId}/vc-manager">
        <label class="inline"><input type="checkbox" name="enabled" ${settings.enabled ? 'checked' : ''}/> Enable temporary VC manager</label>
        <label>Join-to-create voice channel
          <select name="lobby_channel_id">
            <option value="">Select voice channel</option>
            ${voiceOptions}
          </select>
        </label>
        <label>Destination category
          <select name="category_channel_id">
            <option value="">Select category</option>
            ${categoryOptions}
          </select>
        </label>
        <label>Name template (use <code>{user}</code>)<input name="channel_name_template" value="${escapeHtml(settings.channel_name_template || `{user}'s VC`)}" /></label>
        <button class="btn primary" type="submit">Save VC Manager Settings</button>
      </form>
      <p class="muted">Users joining the selected voice channel will be moved into an auto-created temporary voice channel under the selected category.</p>
    `, req.user));
  });

  app.get('/dashboard/:guildId/giveaway-settings', ensureAuth, (req, res) => {
    const { guildId } = req.params;
    if (!userCanManageGuild(req.user, guildId)) return forbidden(res);

    const settings = getGuildSettings(guildId);
    res.send(renderPage('Giveaway Embed Setup', `
      <h1>Giveaway Embed Setup</h1>
      <a class="btn small" href="/dashboard/${guildId}">Back</a>
      <form class="card form" method="post" action="/api/guilds/${guildId}/giveaway-settings">
        <label>Embed title<input name="giveaway_embed_title" maxlength="256" value="${escapeHtml(settings.giveaway_embed_title || '🎉 Giveaway')}" /></label>
        <label>Embed description<textarea name="giveaway_embed_description" rows="6" maxlength="4096">${escapeHtml(settings.giveaway_embed_description || 'Prize: **{prize}**\nWinners: **{winners}**\nEnds: {ends_at}\n\nClick the button below to enter.')}</textarea></label>
        <label>Embed color<input name="giveaway_embed_color" value="${escapeHtml(settings.giveaway_embed_color || '#F1C40F')}" /></label>
        <label>Embed footer<input name="giveaway_embed_footer" maxlength="2048" value="${escapeHtml(settings.giveaway_embed_footer || 'Hosted by {host_tag}')}" /></label>
        <label>Embed image URL<input name="giveaway_embed_image_url" type="url" value="${escapeHtml(settings.giveaway_embed_image_url || '')}" /></label>
        <label>Embed thumbnail URL<input name="giveaway_embed_thumbnail_url" type="url" value="${escapeHtml(settings.giveaway_embed_thumbnail_url || '')}" /></label>
        <label>Button label<input name="giveaway_button_label" maxlength="80" value="${escapeHtml(settings.giveaway_button_label || 'Enter Giveaway')}" /></label>
        <button class="btn primary" type="submit">Save Giveaway Embed Settings</button>
      </form>
      <p class="muted">Available placeholders: <code>{prize}</code>, <code>{winners}</code>, <code>{ends_at}</code>, <code>{host_tag}</code>.</p>
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

  app.post('/api/guilds/:guildId/logs', ensureAuth, (req, res) => {
    const { guildId } = req.params;
    if (!userCanManageGuild(req.user, guildId)) return res.status(403).json({ ok: false, error: 'forbidden' });

    const updated = updateGuildSettings(guildId, {
      logging_enabled: Boolean(req.body.logging_enabled),
      moderation_log_channel_id: req.body.moderation_log_channel_id || null,
      log_member_events: Boolean(req.body.log_member_events),
      log_message_edits: Boolean(req.body.log_message_edits),
      log_message_deletes: Boolean(req.body.log_message_deletes),
      log_voice_events: Boolean(req.body.log_voice_events),
      log_moderation_events: Boolean(req.body.log_moderation_events),
      log_automod_events: Boolean(req.body.log_automod_events)
    });

    if (wantsJson(req)) return res.json({ ok: true, settings: updated });
    res.redirect(`/dashboard/${guildId}/logs`);
  });

  app.post('/api/guilds/:guildId/vc-manager', ensureAuth, (req, res) => {
    const { guildId } = req.params;
    if (!userCanManageGuild(req.user, guildId)) return res.status(403).json({ ok: false, error: 'forbidden' });

    const updated = updateVcManagerSettings(guildId, {
      enabled: Boolean(req.body.enabled),
      lobby_channel_id: req.body.lobby_channel_id || null,
      category_channel_id: req.body.category_channel_id || null,
      channel_name_template: (req.body.channel_name_template || "{user}'s VC").slice(0, 90)
    });

    if (wantsJson(req)) return res.json({ ok: true, settings: updated });
    res.redirect(`/dashboard/${guildId}/vc-manager`);
  });

  app.post('/api/guilds/:guildId/giveaway-settings', ensureAuth, (req, res) => {
    const { guildId } = req.params;
    if (!userCanManageGuild(req.user, guildId)) return res.status(403).json({ ok: false, error: 'forbidden' });

    const updated = updateGuildSettings(guildId, {
      giveaway_embed_title: (req.body.giveaway_embed_title || '🎉 Giveaway').slice(0, 256),
      giveaway_embed_description: (req.body.giveaway_embed_description || 'Prize: **{prize}**\nWinners: **{winners}**\nEnds: {ends_at}\n\nClick the button below to enter.').slice(0, 4096),
      giveaway_embed_color: (req.body.giveaway_embed_color || '#F1C40F').slice(0, 20),
      giveaway_embed_footer: (req.body.giveaway_embed_footer || 'Hosted by {host_tag}').slice(0, 2048),
      giveaway_embed_image_url: req.body.giveaway_embed_image_url || null,
      giveaway_embed_thumbnail_url: req.body.giveaway_embed_thumbnail_url || null,
      giveaway_button_label: (req.body.giveaway_button_label || 'Enter Giveaway').slice(0, 80)
    });

    if (wantsJson(req)) return res.json({ ok: true, settings: updated });
    res.redirect(`/dashboard/${guildId}/giveaway-settings`);
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

function listTables() {
  return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name);
}

function sanitizeIdentifier(value) {
  if (typeof value !== 'string') return null;
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value) ? value : null;
}


function isAdminUnlocked(req) {
  return Boolean(req.session?.adminUnlocked);
}

function renderAdminUnlockCard(returnTo, note = 'Admin secret required.') {
  return `
    <div class="card">
      <h3>Admin Unlock</h3>
      <p class="muted">${note}</p>
      <form class="form" method="post" action="/dashboard/admin/unlock">
        <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}" />
        <label>Admin secret<input name="adminSecret" type="password" required /></label>
        <button class="btn" type="submit">Unlock</button>
      </form>
    </div>`;
}

function renderAdminUnlockPage(user, message, returnTo) {
  return renderPage('Admin Unlock Required', `
    <h1>Admin Unlock Required</h1>
    ${renderAdminUnlockCard(returnTo, message)}
  `, user);
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
        <a class="btn small" href="/dashboard/bots">Bots</a>
        <a class="btn small" href="/dashboard/licenses">Licenses</a>
        <a class="btn small" href="/dashboard/database">Database</a>
        <span class="muted">${user ? `Logged in as ${escapeHtml(user.username || user.id)}` : 'Discord Dashboard'}</span>
      </div>
      ${body}
    </div>
  </body>
  </html>`;
}
