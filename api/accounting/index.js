import { db } from '../../lib/db.js';
import { getSessionUser, hasPermission } from '../../lib/auth.js';
import { nextNumber } from '../../lib/numbering.js';
import { logActivity } from '../../lib/log.js';
import { sendJson, sendError } from '../../lib/respond.js';

const SELECT = `SELECT t.*, au.discord_username as author_name
  FROM transactions t
  LEFT JOIN users au ON au.id = t.author_id`;

export default async function handler(req, res) {
  const user = await getSessionUser(req);

  if (req.method === 'GET') {
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

  if (req.method === 'POST') {
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

  res.setHeader('Allow', 'GET, POST');
  return sendError(res, 'Méthode non autorisée', 405);
}
