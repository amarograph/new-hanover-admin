import { json, errorJson } from '../../_lib/respond.js';
import { hasPermission } from '../../_lib/auth.js';
import { logActivity } from '../../_lib/log.js';

const SELECT = `SELECT d.*, au.discord_username as author_name, vu.discord_username as validator_name
  FROM decrees d
  LEFT JOIN users au ON au.id = d.author_id
  LEFT JOIN users vu ON vu.id = d.validated_by_id
  WHERE d.id = ?`;

async function getDecree(env, id) {
  return env.DB.prepare(SELECT).bind(id).first();
}

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'decrees', 'view')) return errorJson('Accès refusé', 403);
  const decree = await getDecree(context.env, context.params.id);
  if (!decree) return errorJson('Décret introuvable', 404);
  return json({ decree });
}

export async function onRequestPut(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'decrees', 'edit')) return errorJson('Accès refusé', 403);
  const { env, params } = context;
  const before = await getDecree(env, params.id);
  if (!before) return errorJson('Décret introuvable', 404);

  const body = await context.request.json();
  if (!body.title) return errorJson('Le titre est requis', 422);

  await env.DB.prepare(
    `UPDATE decrees SET title=?, content=?, effective_date=?, attachments=?, confidentiality=?, internal_notes=?, updated_at=datetime('now') WHERE id=?`
  ).bind(
    body.title, body.content || '', body.effective_date || null,
    JSON.stringify(body.attachments || []), body.confidentiality || 'interne',
    body.internal_notes || '', params.id
  ).run();

  await logActivity(env.DB, user.id, 'Modification du décret', 'decree', params.id, before, body);
  return json({ ok: true });
}

const STATUS_PERMISSION = {
  a_faire: 'edit',
  en_redaction: 'edit',
  en_attente_validation: 'edit',
  a_publier: 'validate',
  publie: 'validate',
  archive: 'archive',
};

export async function onRequestPatch(context) {
  const user = context.data.user;
  const { env, params } = context;
  const before = await getDecree(env, params.id);
  if (!before) return errorJson('Décret introuvable', 404);

  const body = await context.request.json();
  const target = body.status;
  if (!target || !(target in STATUS_PERMISSION)) return errorJson('Statut invalide', 422);

  if (!hasPermission(user, 'decrees', STATUS_PERMISSION[target])) return errorJson('Accès refusé', 403);

  const validatedBy = (target === 'a_publier' || target === 'publie') ? user.id : before.validated_by_id;
  await env.DB.prepare(
    `UPDATE decrees SET status=?, category=?, validated_by_id=?, updated_at=datetime('now') WHERE id=?`
  ).bind(target, target, validatedBy, params.id).run();

  await logActivity(env.DB, user.id, `Changement de statut du décret (${before.status} -> ${target})`, 'decree', params.id, { status: before.status }, { status: target });
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'decrees', 'delete')) return errorJson('Accès refusé', 403);
  const { env, params } = context;
  const before = await getDecree(env, params.id);
  if (!before) return errorJson('Décret introuvable', 404);

  await env.DB.prepare('DELETE FROM decrees WHERE id=?').bind(params.id).run();
  await logActivity(env.DB, user.id, 'Suppression du décret', 'decree', params.id, before, null);
  return json({ ok: true });
}
