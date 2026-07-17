import { json, errorJson } from '../../_lib/respond.js';
import { hasPermission } from '../../_lib/auth.js';
import { logActivity } from '../../_lib/log.js';

const SELECT = `SELECT t.*, au.discord_username as author_name
  FROM transactions t
  LEFT JOIN users au ON au.id = t.author_id
  WHERE t.id = ?`;

async function getTransaction(env, id) {
  return env.DB.prepare(SELECT).bind(id).first();
}

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'accounting', 'view')) return errorJson('Accès refusé', 403);
  const transaction = await getTransaction(context.env, context.params.id);
  if (!transaction) return errorJson('Transaction introuvable', 404);
  return json({ transaction });
}

export async function onRequestPut(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'accounting', 'edit')) return errorJson('Accès refusé', 403);
  const { env, params } = context;
  const before = await getTransaction(env, params.id);
  if (!before) return errorJson('Transaction introuvable', 404);
  if (before.validation_status === 'validee') return errorJson('Une transaction validée ne peut plus être modifiée', 409);

  const body = await context.request.json();
  if (!body.amount || Number(body.amount) <= 0) return errorJson('Le montant doit être positif', 422);

  await env.DB.prepare(
    `UPDATE transactions SET amount=?, date=?, time=?, category=?, reason=?, person_concerned=?, business_concerned=?, payment_method=?, receipt=?, notes=?, updated_at=datetime('now') WHERE id=?`
  ).bind(
    Number(body.amount), body.date || before.date, body.time || null,
    body.category || '', body.reason || '', body.person_concerned || '',
    body.business_concerned || '', body.payment_method || '', body.receipt || '',
    body.notes || '', params.id
  ).run();

  await logActivity(env.DB, user.id, 'Modification d\'une transaction', 'transaction', params.id, before, body);
  return json({ ok: true });
}

export async function onRequestPatch(context) {
  const user = context.data.user;
  const { env, params } = context;
  const before = await getTransaction(env, params.id);
  if (!before) return errorJson('Transaction introuvable', 404);

  const body = await context.request.json();
  const target = body.validation_status;
  if (!['validee', 'annulee', 'en_attente'].includes(target)) return errorJson('Statut invalide', 422);
  if (!hasPermission(user, 'accounting', 'validate')) return errorJson('Accès refusé', 403);

  await env.DB.prepare(
    `UPDATE transactions SET validation_status=?, updated_at=datetime('now') WHERE id=?`
  ).bind(target, params.id).run();

  await logActivity(env.DB, user.id, `Changement de statut de la transaction (${before.validation_status} -> ${target})`, 'transaction', params.id, { validation_status: before.validation_status }, { validation_status: target });
  return json({ ok: true });
}
