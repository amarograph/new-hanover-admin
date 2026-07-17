import { json, errorJson } from '../../_lib/respond.js';
import { hasPermission } from '../../_lib/auth.js';
import { logActivity } from '../../_lib/log.js';

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'admin', 'manage_users')) return errorJson('Accès refusé', 403);
  const { env } = context;
  const { results } = await env.DB.prepare('SELECT * FROM roles ORDER BY id ASC').all();
  return json({ roles: results.map((r) => ({ ...r, permissions: JSON.parse(r.permissions) })) });
}

export async function onRequestPost(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'admin', 'manage_users')) return errorJson('Accès refusé', 403);
  const { env } = context;
  const body = await context.request.json();
  if (!body.name) return errorJson('Le nom du rôle est requis', 422);

  const result = await env.DB.prepare(
    'INSERT INTO roles (name, description, permissions, is_system) VALUES (?, ?, ?, 0)'
  ).bind(body.name, body.description || '', JSON.stringify(body.permissions || {})).run();

  const id = result.meta.last_row_id;
  await logActivity(env.DB, user.id, 'Création d\'un rôle', 'role', id, null, { name: body.name });
  return json({ id }, 201);
}
