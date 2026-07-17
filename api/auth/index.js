import { db, NOW_EXPR } from '../../lib/db.js';
import { getSessionUser, getCookie, makeSessionCookie, clearSessionCookie, SESSION_COOKIE, SESSION_MAX_AGE } from '../../lib/auth.js';
import { logActivity } from '../../lib/log.js';
import { sendJson, sendError } from '../../lib/respond.js';

const MAX_SIGNATURE_BYTES = 500 * 1024;

function validateSignature(signature) {
  if (signature === undefined || signature === null || signature === '') return null;
  if (typeof signature !== 'string' || !/^data:image\/png;base64,/.test(signature)) {
    throw new Error('La signature doit être une image PNG.');
  }
  if (signature.length > MAX_SIGNATURE_BYTES * 1.4) {
    throw new Error('Signature trop volumineuse (500 Ko maximum).');
  }
  return signature;
}

async function login(req, res) {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_REDIRECT_URI) {
    res.status(500).send('Discord OAuth n\'est pas configuré (DISCORD_CLIENT_ID / DISCORD_REDIRECT_URI manquants).');
    return;
  }
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
    prompt: 'consent',
  });
  res.redirect(302, `https://discord.com/oauth2/authorize?${params.toString()}`);
}

// Étape unique où l'on parle à Discord : seuls l'ID et le pseudo Discord
// sont extraits de la réponse et conservés. Aucune autre donnée
// (avatar, email, discriminator...) n'est lue ni stockée.
async function callback(req, res) {
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
        "SELECT id FROM roles WHERE name = 'Admin dev'"
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

async function logout(req, res) {
  const token = getCookie(req, SESSION_COOKIE);
  if (token) {
    await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  }
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.redirect(302, '/');
}

async function me(req, res) {
  const user = await getSessionUser(req);
  if (!user) return res.status(200).json({ authenticated: false });

  const {
    id, discord_id, discord_username, character_first_name, character_last_name,
    job_title, grade, arrival_date, last_login, status, role, permissions, signature,
  } = user;

  res.status(200).json({
    authenticated: true,
    user: {
      id, discord_id, discord_username, character_first_name, character_last_name,
      job_title, grade, arrival_date, last_login, status, signature,
      role: role ? { id: role.id, name: role.name } : null,
      permissions,
    },
  });
}

async function updateProfile(req, res) {
  const user = await getSessionUser(req);
  if (!user) return sendError(res, 'Non authentifié', 401);

  const body = req.body || {};
  let signature;
  try { signature = validateSignature(body.signature); } catch (e) { return sendError(res, e.message, 422); }
  if (body.signature === undefined) signature = user.signature;

  await db.prepare(
    `UPDATE users SET character_first_name=?, character_last_name=?, signature=?, updated_at=${NOW_EXPR} WHERE id=?`
  ).bind(
    body.character_first_name || '', body.character_last_name || '', signature, user.id
  ).run();

  return sendJson(res, { ok: true });
}

export default async function handler(req, res) {
  const action = Array.isArray(req.query.action) ? req.query.action[0] : req.query.action;

  if (action === 'login' && req.method === 'GET') return login(req, res);
  if (action === 'callback' && req.method === 'GET') return callback(req, res);
  if (action === 'logout' && req.method === 'POST') return logout(req, res);
  if (action === 'me' && req.method === 'GET') return me(req, res);
  if (action === 'profile' && req.method === 'PATCH') return updateProfile(req, res);

  return sendError(res, 'Route inconnue', 404);
}
