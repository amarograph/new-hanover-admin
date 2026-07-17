import { db } from '../../lib/db.js';
import { getSessionUser, hasPermission } from '../../lib/auth.js';
import { logActivity } from '../../lib/log.js';
import { sendJson, sendError } from '../../lib/respond.js';

async function list(req, res, user) {
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

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  if (!hasPermission(user, 'admin', 'manage_users')) return sendError(res, 'Accès refusé', 403);

  const slug = Array.isArray(req.query.slug) ? req.query.slug : (req.query.slug ? [req.query.slug] : []);
  if (slug.length === 0) return list(req, res, user);

  const id = slug[0];

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
