import { db, NOW_EXPR } from '../../lib/db.js';
import { makeSessionCookie, SESSION_MAX_AGE } from '../../lib/auth.js';
import { logActivity } from '../../lib/log.js';

// Étape unique où l'on parle à Discord : seuls l'ID et le pseudo Discord
// sont extraits de la réponse et conservés. Aucune autre donnée
// (avatar, email, discriminator...) n'est lue ni stockée.
export default async function handler(req, res) {
  const code = req.query.code;

  if (!code) {
    res.redirect(302, '/?error=missing_code');
    return;
  }
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !process.env.DISCORD_REDIRECT_URI) {
    res.status(500).send('Discord OAuth n\'est pas configuré côté serveur.');
    return;
  }

  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI,
    }),
  });
  if (!tokenRes.ok) {
    res.redirect(302, '/?error=oauth_failed');
    return;
  }
  const tokenData = await tokenRes.json();

  const meRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!meRes.ok) {
    res.redirect(302, '/?error=oauth_failed');
    return;
  }
  const discordUser = await meRes.json();
  const discordId = String(discordUser.id);
  const username = String(discordUser.username);

  let user = await db.prepare('SELECT * FROM users WHERE discord_id = ?').bind(discordId).first();

  const bootstrapIds = (process.env.BOOTSTRAP_DISCORD_IDS || '')
    .split(',').map((s) => s.trim()).filter(Boolean);

  if (!user) {
    let status = 'pending';
    let roleId = null;
    if (bootstrapIds.includes(discordId)) {
      const adminRole = await db.prepare(
        "SELECT id FROM roles WHERE name = 'Administrateur principal'"
      ).first();
      status = 'accepted';
      roleId = adminRole ? adminRole.id : null;
    }
    await db.prepare(
      `INSERT INTO users (discord_id, discord_username, status, role_id, last_login)
       VALUES (?, ?, ?, ?, ${NOW_EXPR})`
    ).bind(discordId, username, status, roleId).run();
    user = await db.prepare('SELECT * FROM users WHERE discord_id = ?').bind(discordId).first();
    await logActivity(
      db, user.id,
      status === 'accepted' ? 'Compte créé et accepté automatiquement (administrateur initial)' : 'Demande d\'accès créée',
      'user', user.id, null, { status }
    );
  } else {
    await db.prepare(
      `UPDATE users SET discord_username = ?, last_login = ${NOW_EXPR} WHERE id = ?`
    ).bind(username, user.id).run();
    await logActivity(db, user.id, 'Connexion', 'user', user.id, null, null);
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();
  await db.prepare(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(token, user.id, expiresAt).run();

  res.setHeader('Set-Cookie', makeSessionCookie(token));
  res.redirect(302, '/dashboard.html');
}
