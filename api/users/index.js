import { db, NOW_EXPR } from '../../lib/db.js';
import { getSessionUser, hasPermission } from '../../lib/auth.js';
import { logActivity } from '../../lib/log.js';
import { sendJson, sendError } from '../../lib/respond.js';

const STATUSES = ['pending', 'accepted', 'refused', 'suspended', 'disabled'];

async function list(req, res, user) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendError(res, 'Méthode non autorisée', 405);
  }
  if (!hasPermission(user, 'admin', 'manage_users')) return sendError(res, 'Accès refusé', 403);

  const { status, q } = req.query;
  let query = `SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE 1=1`;
  const binds = [];
  if (status) { query += ' AND u.status = ?'; binds.push(status); }
  if (q) {
    query += ' AND (u.discord_username LIKE ? OR u.character_first_name LIKE ? OR u.character_last_name LIKE ?)';
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  query += ' ORDER BY u.created_at DESC';

  const { results } = await db.prepare(query).bind(...binds).all();
  return sendJson(res, { users: results });
}

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  const slug = Array.isArray(req.query.slug) ? req.query.slug : (req.query.slug ? [req.query.slug] : []);

  if (slug.length === 0) return list(req, res, user);

  const id = slug[0];
  if (!hasPermission(user, 'admin', 'manage_users')) return sendError(res, 'Accès refusé', 403);

  if (req.method === 'GET') {
    const target = await db.prepare(
      `SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?`
    ).bind(id).first();
    if (!target) return sendError(res, 'Utilisateur introuvable', 404);
    return sendJson(res, { user: target });
  }

  if (req.method === 'PATCH') {
    const before = await db.prepare('SELECT * FROM users WHERE id=?').bind(id).first();
    if (!before) return sendError(res, 'Utilisateur introuvable', 404);

    const body = req.body || {};
    if (body.status && !STATUSES.includes(body.status)) return sendError(res, 'Statut invalide', 422);
    if (body.status === 'disabled' && Number(id) === user.id) {
      return sendError(res, 'Vous ne pouvez pas désactiver votre propre compte', 400);
    }

    const fields = [];
    const binds = [];
    for (const key of ['status', 'role_id', 'character_first_name', 'character_last_name', 'job_title', 'grade', 'arrival_date']) {
      if (key in body) { fields.push(`${key} = ?`); binds.push(body[key]); }
    }
    if (!fields.length) return sendError(res, 'Rien à mettre à jour', 422);
    binds.push(id);

    await db.prepare(`UPDATE users SET ${fields.join(', ')}, updated_at=${NOW_EXPR} WHERE id=?`).bind(...binds).run();
    await logActivity(db, user.id, 'Modification du compte utilisateur', 'user', id, before, body);
    return sendJson(res, { ok: true });
  }

  res.setHeader('Allow', 'GET, PATCH');
  return sendError(res, 'Méthode non autorisée', 405);
}
