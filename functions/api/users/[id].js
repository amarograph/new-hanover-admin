import { json, errorJson } from '../../_lib/respond.js';
import { hasPermission } from '../../_lib/auth.js';
import { logActivity } from '../../_lib/log.js';

const STATUSES = ['pending', 'accepted', 'refused', 'suspended', 'disabled'];

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'admin', 'manage_users')) return errorJson('Accès refusé', 403);
  const { env, params } = context;
  const target = await env.DB.prepare(
    `SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?`
  ).bind(params.id).first();
  if (!target) return errorJson('Utilisateur introuvable', 404);
  return json({ user: target });
}

export async function onRequestPatch(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'admin', 'manage_users')) return errorJson('Accès refusé', 403);

  const { env, params } = context;
  const before = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(params.id).first();
  if (!before) return errorJson('Utilisateur introuvable', 404);

  const body = await context.request.json();
  if (body.status && !STATUSES.includes(body.status)) return errorJson('Statut invalide', 422);
  if (body.status === 'disabled' && Number(params.id) === user.id) {
    return errorJson('Vous ne pouvez pas désactiver votre propre compte', 400);
  }

  const fields = [];
  const binds = [];
  for (const key of ['status', 'role_id', 'character_first_name', 'character_last_name', 'job_title', 'grade', 'arrival_date']) {
    if (key in body) { fields.push(`${key} = ?`); binds.push(body[key]); }
  }
  if (!fields.length) return errorJson('Rien à mettre à jour', 422);
  binds.push(params.id);

  await env.DB.prepare(`UPDATE users SET ${fields.join(', ')}, updated_at=datetime('now') WHERE id=?`).bind(...binds).run();
  await logActivity(env.DB, user.id, 'Modification du compte utilisateur', 'user', params.id, before, body);
  return json({ ok: true });
}
