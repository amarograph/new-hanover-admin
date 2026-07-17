import { db, NOW_EXPR } from '../../lib/db.js';
import { getSessionUser, hasPermission } from '../../lib/auth.js';
import { logActivity } from '../../lib/log.js';
import { sendJson, sendError } from '../../lib/respond.js';

const SELECT = `SELECT t.*, au.discord_username as author_name
  FROM transactions t
  LEFT JOIN users au ON au.id = t.author_id
  WHERE t.id = ?`;

async function getTransaction(id) {
  return db.prepare(SELECT).bind(id).first();
}

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  const { id } = req.query;

  if (req.method === 'GET') {
    if (!hasPermission(user, 'accounting', 'view')) return sendError(res, 'Accès refusé', 403);
    const transaction = await getTransaction(id);
    if (!transaction) return sendError(res, 'Transaction introuvable', 404);
    return sendJson(res, { transaction });
  }

  if (req.method === 'PUT') {
    if (!hasPermission(user, 'accounting', 'edit')) return sendError(res, 'Accès refusé', 403);
    const before = await getTransaction(id);
    if (!before) return sendError(res, 'Transaction introuvable', 404);
    if (before.validation_status === 'validee') return sendError(res, 'Une transaction validée ne peut plus être modifiée', 409);

    const body = req.body || {};
    if (!body.amount || Number(body.amount) <= 0) return sendError(res, 'Le montant doit être positif', 422);

    await db.prepare(
      `UPDATE transactions SET amount=?, date=?, time=?, category=?, reason=?, person_concerned=?, business_concerned=?, payment_method=?, receipt=?, notes=?, updated_at=${NOW_EXPR} WHERE id=?`
    ).bind(
      Number(body.amount), body.date || before.date, body.time || null,
      body.category || '', body.reason || '', body.person_concerned || '',
      body.business_concerned || '', body.payment_method || '', body.receipt || '',
      body.notes || '', id
    ).run();

    await logActivity(db, user.id, 'Modification d\'une transaction', 'transaction', id, before, body);
    return sendJson(res, { ok: true });
  }

  if (req.method === 'PATCH') {
    const before = await getTransaction(id);
    if (!before) return sendError(res, 'Transaction introuvable', 404);

    const body = req.body || {};
    const target = body.validation_status;
    if (!['validee', 'annulee', 'en_attente'].includes(target)) return sendError(res, 'Statut invalide', 422);
    if (!hasPermission(user, 'accounting', 'validate')) return sendError(res, 'Accès refusé', 403);

    await db.prepare(
      `UPDATE transactions SET validation_status=?, updated_at=${NOW_EXPR} WHERE id=?`
    ).bind(target, id).run();

    await logActivity(db, user.id, `Changement de statut de la transaction (${before.validation_status} -> ${target})`, 'transaction', id, { validation_status: before.validation_status }, { validation_status: target });
    return sendJson(res, { ok: true });
  }

  res.setHeader('Allow', 'GET, PUT, PATCH');
  return sendError(res, 'Méthode non autorisée', 405);
}
