import { json, errorJson } from '../../_lib/respond.js';
import { hasPermission } from '../../_lib/auth.js';
import { logActivity } from '../../_lib/log.js';

const SELECT = `SELECT c.*, au.discord_username as author_name
  FROM communiques c
  LEFT JOIN users au ON au.id = c.author_id
  WHERE c.id = ?`;

async function getCommunique(env, id) {
  return env.DB.prepare(SELECT).bind(id).first();
}

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'communiques', 'view')) return errorJson('Accès refusé', 403);
  const communique = await getCommunique(context.env, context.params.id);
  if (!communique) return errorJson('Communiqué introuvable', 404);
  return json({ communique });
}

export async function onRequestPut(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'communiques', 'edit')) return errorJson('Accès refusé', 403);
  const { env, params } = context;
  const before = await getCommunique(env, params.id);
  if (!before) return errorJson('Communiqué introuvable', 404);

  const body = await context.request.json();
  if (!body.title) return errorJson('Le titre est requis', 422);

  await env.DB.prepare(
    `UPDATE communiques SET title=?, subject=?, content=?, target_audience=?, attachments=?, internal_notes=?, updated_at=datetime('now') WHERE id=?`
  ).bind(
    body.title, body.subject || '', body.content || '', body.target_audience || 'tous',
    JSON.stringify(body.attachments || []), body.internal_notes || '', params.id
  ).run();

  await logActivity(env.DB, user.id, 'Modification du communiqué', 'communique', params.id, before, body);
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
  const before = await getCommunique(env, params.id);
  if (!before) return errorJson('Communiqué introuvable', 404);

  const body = await context.request.json();
  const target = body.status;
  if (!target || !(target in STATUS_PERMISSION)) return errorJson('Statut invalide', 422);
  if (!hasPermission(user, 'communiques', STATUS_PERMISSION[target])) return errorJson('Accès refusé', 403);

  const publishedAt = target === 'publie' ? new Date().toISOString() : before.published_at;
  await env.DB.prepare(
    `UPDATE communiques SET status=?, published_at=?, updated_at=datetime('now') WHERE id=?`
  ).bind(target, publishedAt, params.id).run();

  await logActivity(env.DB, user.id, `Changement de statut du communiqué (${before.status} -> ${target})`, 'communique', params.id, { status: before.status }, { status: target });
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'communiques', 'delete')) return errorJson('Accès refusé', 403);
  const { env, params } = context;
  const before = await getCommunique(env, params.id);
  if (!before) return errorJson('Communiqué introuvable', 404);

  await env.DB.prepare('DELETE FROM communiques WHERE id=?').bind(params.id).run();
  await logActivity(env.DB, user.id, 'Suppression du communiqué', 'communique', params.id, before, null);
  return json({ ok: true });
}
