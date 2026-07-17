import { makeSessionCookie, SESSION_MAX_AGE } from '../../_lib/auth.js';
import { logActivity } from '../../_lib/log.js';

// Étape unique où l'on parle à Discord : seuls l'ID et le pseudo Discord
// sont extraits de la réponse et conservés. Aucune autre donnée
// (avatar, email, discriminator...) n'est lue ni stockée.
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return Response.redirect(url.origin + '/?error=missing_code', 302);
  }
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.DISCORD_REDIRECT_URI) {
    return new Response('Discord OAuth n\'est pas configuré côté serveur.', { status: 500 });
  }

  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.DISCORD_REDIRECT_URI,
    }),
  });
  if (!tokenRes.ok) {
    return Response.redirect(url.origin + '/?error=oauth_failed', 302);
  }
  const tokenData = await tokenRes.json();

  const meRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!meRes.ok) {
    return Response.redirect(url.origin + '/?error=oauth_failed', 302);
  }
  const discordUser = await meRes.json();
  const discordId = String(discordUser.id);
  const username = String(discordUser.username);

  let user = await env.DB.prepare('SELECT * FROM users WHERE discord_id = ?').bind(discordId).first();

  const bootstrapIds = (env.BOOTSTRAP_DISCORD_IDS || '')
    .split(',').map((s) => s.trim()).filter(Boolean);

  if (!user) {
    let status = 'pending';
    let roleId = null;
    if (bootstrapIds.includes(discordId)) {
      const adminRole = await env.DB.prepare(
        "SELECT id FROM roles WHERE name = 'Administrateur principal'"
      ).first();
      status = 'accepted';
      roleId = adminRole ? adminRole.id : null;
    }
    await env.DB.prepare(
      `INSERT INTO users (discord_id, discord_username, status, role_id, last_login)
       VALUES (?, ?, ?, ?, datetime('now'))`
    ).bind(discordId, username, status, roleId).run();
    user = await env.DB.prepare('SELECT * FROM users WHERE discord_id = ?').bind(discordId).first();
    await logActivity(
      env.DB, user.id,
      status === 'accepted' ? 'Compte créé et accepté automatiquement (administrateur initial)' : 'Demande d\'accès créée',
      'user', user.id, null, { status }
    );
  } else {
    await env.DB.prepare(
      `UPDATE users SET discord_username = ?, last_login = datetime('now') WHERE id = ?`
    ).bind(username, user.id).run();
    await logActivity(env.DB, user.id, 'Connexion', 'user', user.id, null, null);
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();
  await env.DB.prepare(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(token, user.id, expiresAt).run();

  return new Response(null, {
    status: 302,
    headers: {
      Location: url.origin + '/dashboard.html',
      'Set-Cookie': makeSessionCookie(token),
    },
  });
}
