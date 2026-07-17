import { json, errorJson } from '../../_lib/respond.js';
import { hasPermission } from '../../_lib/auth.js';
import { logActivity } from '../../_lib/log.js';

export async function onRequestPut(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'admin', 'manage_users')) return errorJson('Accès refusé', 403);
  const { env, params } = context;
  const before = await env.DB.prepare('SELECT * FROM roles WHERE id=?').bind(params.id).first();
  if (!before) return errorJson('Rôle introuvable', 404);

  const body = await context.request.json();
  if (!body.name) return errorJson('Le nom du rôle est requis', 422);

  await env.DB.prepare(
    'UPDATE roles SET name=?, description=?, permissions=? WHERE id=?'
  ).bind(body.name, body.description || '', JSON.stringify(body.permissions || {}), params.id).run();

  await logActivity(env.DB, user.id, 'Modification d\'un rôle', 'role', params.id, { ...before, permissions: JSON.parse(before.permissions) }, body);
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'admin', 'manage_users')) return errorJson('Accès refusé', 403);
  const { env, params } = context;
  const before = await env.DB.prepare('SELECT * FROM roles WHERE id=?').bind(params.id).first();
  if (!before) return errorJson('Rôle introuvable', 404);
  if (before.is_system) return errorJson('Ce rôle système ne peut pas être supprimé', 400);

  const inUse = await env.DB.prepare('SELECT COUNT(*) as c FROM users WHERE role_id=?').bind(params.id).first();
  if (inUse.c > 0) return errorJson('Ce rôle est encore attribué à des utilisateurs', 409);

  await env.DB.prepare('DELETE FROM roles WHERE id=?').bind(params.id).run();
  await logActivity(env.DB, user.id, 'Suppression d\'un rôle', 'role', params.id, before, null);
  return json({ ok: true });
}
