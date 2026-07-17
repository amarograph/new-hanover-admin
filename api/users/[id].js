import { db, NOW_EXPR } from '../../lib/db.js';
import { getSessionUser, hasPermission } from '../../lib/auth.js';
import { logActivity } from '../../lib/log.js';
import { sendJson, sendError } from '../../lib/respond.js';

const STATUSES = ['pending', 'accepted', 'refused', 'suspended', 'disabled'];

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  const { id } = req.query;
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
