import { db } from '../../lib/db.js';
import { getSessionUser, hasPermission } from '../../lib/auth.js';
import { logActivity } from '../../lib/log.js';
import { sendJson, sendError } from '../../lib/respond.js';

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  if (!hasPermission(user, 'admin', 'manage_users')) return sendError(res, 'Accès refusé', 403);

  if (req.method === 'GET') {
    const { results } = await db.prepare('SELECT * FROM roles ORDER BY id ASC').all();
    return sendJson(res, { roles: results.map((r) => ({ ...r, permissions: JSON.parse(r.permissions) })) });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    if (!body.name) return sendError(res, 'Le nom du rôle est requis', 422);

    const result = await db.prepare(
      'INSERT INTO roles (name, description, permissions, is_system) VALUES (?, ?, ?, 0) RETURNING id'
    ).bind(body.name, body.description || '', JSON.stringify(body.permissions || {})).run();

    const id = result.meta.last_row_id;
    await logActivity(db, user.id, 'Création d\'un rôle', 'role', id, null, { name: body.name });
    return sendJson(res, { id }, 201);
  }

  res.setHeader('Allow', 'GET, POST');
  return sendError(res, 'Méthode non autorisée', 405);
}
