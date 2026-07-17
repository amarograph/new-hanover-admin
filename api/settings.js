import { db } from '../lib/db.js';
import { getSessionUser, hasPermission } from '../lib/auth.js';
import { sendJson, sendError } from '../lib/respond.js';

async function getSigner(id) {
  if (!id) return null;
  return db.prepare(
    'SELECT id, character_first_name, character_last_name, discord_username, signature FROM users WHERE id = ?'
  ).bind(id).first();
}

async function getSetting(key) {
  const row = await db.prepare('SELECT value FROM app_settings WHERE key = ?').bind(key).first();
  return row ? row.value : null;
}

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  if (!user) return sendError(res, 'Non authentifié', 401);

  if (req.method === 'GET') {
    const signer1Id = await getSetting('signer_1_id');
    const signer2Id = await getSetting('signer_2_id');
    const [signer1, signer2] = await Promise.all([getSigner(signer1Id), getSigner(signer2Id)]);
    return sendJson(res, { signer_1: signer1, signer_2: signer2 });
  }

  if (req.method === 'PUT') {
    if (!hasPermission(user, 'admin', 'manage_users')) return sendError(res, 'Accès refusé', 403);
    const body = req.body || {};
    const ids = [body.signer_1_id, body.signer_2_id];
    for (const id of ids) {
      if (id === undefined || id === null || id === '') continue;
      const exists = await db.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
      if (!exists) return sendError(res, 'Utilisateur signataire introuvable', 422);
    }

    await db.prepare(
      `INSERT INTO app_settings (key, value) VALUES ('signer_1_id', ?)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
    ).bind(body.signer_1_id ? String(body.signer_1_id) : null).run();
    await db.prepare(
      `INSERT INTO app_settings (key, value) VALUES ('signer_2_id', ?)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
    ).bind(body.signer_2_id ? String(body.signer_2_id) : null).run();

    return sendJson(res, { ok: true });
  }

  res.setHeader('Allow', 'GET, PUT');
  return sendError(res, 'Méthode non autorisée', 405);
}
