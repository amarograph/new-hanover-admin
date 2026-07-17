import { db } from '../../lib/db.js';
import { getSessionUser, hasPermission } from '../../lib/auth.js';
import { logActivity } from '../../lib/log.js';
import { sendJson, sendError } from '../../lib/respond.js';

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  const { id } = req.query;
  if (!hasPermission(user, 'admin', 'manage_users')) return sendError(res, 'Accès refusé', 403);

  if (req.method === 'PUT') {
    const before = await db.prepare('SELECT * FROM roles WHERE id=?').bind(id).first();
    if (!before) return sendError(res, 'Rôle introuvable', 404);

    const body = req.body || {};
    if (!body.name) return sendError(res, 'Le nom du rôle est requis', 422);

    await db.prepare(
      'UPDATE roles SET name=?, description=?, permissions=? WHERE id=?'
    ).bind(body.name, body.description || '', JSON.stringify(body.permissions || {}), id).run();

    await logActivity(db, user.id, 'Modification d\'un rôle', 'role', id, { ...before, permissions: JSON.parse(before.permissions) }, body);
    return sendJson(res, { ok: true });
  }

  if (req.method === 'DELETE') {
    const before = await db.prepare('SELECT * FROM roles WHERE id=?').bind(id).first();
    if (!before) return sendError(res, 'Rôle introuvable', 404);
    if (before.is_system) return sendError(res, 'Ce rôle système ne peut pas être supprimé', 400);

    const inUse = await db.prepare('SELECT COUNT(*)::int as c FROM users WHERE role_id=?').bind(id).first();
    if (inUse.c > 0) return sendError(res, 'Ce rôle est encore attribué à des utilisateurs', 409);

    await db.prepare('DELETE FROM roles WHERE id=?').bind(id).run();
    await logActivity(db, user.id, 'Suppression d\'un rôle', 'role', id, before, null);
    return sendJson(res, { ok: true });
  }

  res.setHeader('Allow', 'PUT, DELETE');
  return sendError(res, 'Méthode non autorisée', 405);
}
