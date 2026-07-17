import { db, NOW_EXPR } from '../../lib/db.js';
import { getSessionUser, hasPermission } from '../../lib/auth.js';
import { nextNumber } from '../../lib/numbering.js';
import { logActivity } from '../../lib/log.js';
import { sendJson, sendError } from '../../lib/respond.js';

const SELECT = `SELECT t.*, au.discord_username as author_name
  FROM transactions t
  LEFT JOIN users au ON au.id = t.author_id`;

async function getTransaction(id) {
  return db.prepare(SELECT + ' WHERE t.id = ?').bind(id).first();
}

async function list(req, res, user) {
  if (!hasPermission(user, 'accounting', 'view')) return sendError(res, 'Accès refusé', 403);

  const { type, category, validation_status, from, to } = req.query;
  let query = SELECT + ' WHERE 1=1';
  const binds = [];
  if (type) { query += ' AND t.type = ?'; binds.push(type); }
  if (category) { query += ' AND t.category = ?'; binds.push(category); }
  if (validation_status) { query += ' AND t.validation_status = ?'; binds.push(validation_status); }
  if (from) { query += ' AND t.date >= ?'; binds.push(from); }
  if (to) { query += ' AND t.date <= ?'; binds.push(to); }
  query += ' ORDER BY t.date DESC, t.created_at DESC';

  const { results } = await db.prepare(query).bind(...binds).all();
  return sendJson(res, { transactions: results });
}

async function create(req, res, user) {
  if (!hasPermission(user, 'accounting', 'add')) return sendError(res, 'Accès refusé', 403);

  const body = req.body || {};
  if (!body.type || !['entree', 'sortie'].includes(body.type)) return sendError(res, 'Le type (entree/sortie) est requis', 422);
  if (!body.amount || Number(body.amount) <= 0) return sendError(res, 'Le montant doit être positif', 422);
  if (!body.date) return sendError(res, 'La date est requise', 422);

  const number = await nextNumber(db, 'TR-NH', '1892');
  const result = await db.prepare(
    `INSERT INTO transactions (number, type, amount, date, time, category, reason, person_concerned, business_concerned, payment_method, author_id, receipt, validation_status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(
    number, body.type, Number(body.amount), body.date, body.time || null,
    body.category || '', body.reason || '', body.person_concerned || '',
    body.business_concerned || '', body.payment_method || '', user.id,
    body.receipt || '', 'en_attente', body.notes || ''
  ).run();

  const id = result.meta.last_row_id;
  await logActivity(db, user.id, 'Ajout d\'une transaction', 'transaction', id, null, { number, type: body.type, amount: body.amount });
  return sendJson(res, { id, number }, 201);
}

async function summary(req, res, user) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendError(res, 'Méthode non autorisée', 405);
  }
  if (!hasPermission(user, 'accounting', 'view')) return sendError(res, 'Accès refusé', 403);

  const totals = await db.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN type='entree' AND validation_status='validee' THEN amount ELSE 0 END), 0) as total_in,
       COALESCE(SUM(CASE WHEN type='sortie' AND validation_status='validee' THEN amount ELSE 0 END), 0) as total_out,
       COALESCE(SUM(CASE WHEN validation_status='en_attente' THEN 1 ELSE 0 END), 0)::int as pending_count
     FROM transactions`
  ).first();

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthTotals = await db.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN type='entree' AND validation_status='validee' THEN amount ELSE 0 END), 0) as month_in,
       COALESCE(SUM(CASE WHEN type='sortie' AND validation_status='validee' THEN amount ELSE 0 END), 0) as month_out
     FROM transactions WHERE date >= ?`
  ).bind(monthStart).first();

  const recentIn = await db.prepare(
    `SELECT * FROM transactions WHERE type='entree' ORDER BY date DESC, created_at DESC LIMIT 5`
  ).all();
  const recentOut = await db.prepare(
    `SELECT * FROM transactions WHERE type='sortie' ORDER BY date DESC, created_at DESC LIMIT 5`
  ).all();

  return sendJson(res, {
    balance: totals.total_in - totals.total_out,
    total_in: totals.total_in,
    total_out: totals.total_out,
    pending_count: totals.pending_count,
    month_in: monthTotals.month_in,
    month_out: monthTotals.month_out,
    recent_in: recentIn.results,
    recent_out: recentOut.results,
  });
}

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  const slug = Array.isArray(req.query.slug) ? req.query.slug : (req.query.slug ? [req.query.slug] : []);

  if (slug.length === 0) {
    if (req.method === 'GET') return list(req, res, user);
    if (req.method === 'POST') return create(req, res, user);
    res.setHeader('Allow', 'GET, POST');
    return sendError(res, 'Méthode non autorisée', 405);
  }

  if (slug[0] === 'summary') return summary(req, res, user);

  const id = slug[0];

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
