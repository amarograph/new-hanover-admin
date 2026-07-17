import { json, errorJson } from '../../_lib/respond.js';
import { hasPermission } from '../../_lib/auth.js';
import { nextNumber } from '../../_lib/numbering.js';
import { logActivity } from '../../_lib/log.js';

const SELECT = `SELECT t.*, au.discord_username as author_name
  FROM transactions t
  LEFT JOIN users au ON au.id = t.author_id`;

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'accounting', 'view')) return errorJson('Accès refusé', 403);

  const { env, request } = context;
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const category = url.searchParams.get('category');
  const validation_status = url.searchParams.get('validation_status');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  let query = SELECT + ' WHERE 1=1';
  const binds = [];
  if (type) { query += ' AND t.type = ?'; binds.push(type); }
  if (category) { query += ' AND t.category = ?'; binds.push(category); }
  if (validation_status) { query += ' AND t.validation_status = ?'; binds.push(validation_status); }
  if (from) { query += ' AND t.date >= ?'; binds.push(from); }
  if (to) { query += ' AND t.date <= ?'; binds.push(to); }
  query += ' ORDER BY t.date DESC, t.created_at DESC';

  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return json({ transactions: results });
}

export async function onRequestPost(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'accounting', 'add')) return errorJson('Accès refusé', 403);

  const { env } = context;
  const body = await context.request.json();
  if (!body.type || !['entree', 'sortie'].includes(body.type)) return errorJson('Le type (entree/sortie) est requis', 422);
  if (!body.amount || Number(body.amount) <= 0) return errorJson('Le montant doit être positif', 422);
  if (!body.date) return errorJson('La date est requise', 422);

  const number = await nextNumber(env.DB, 'TR-NH', '1892');
  const result = await env.DB.prepare(
    `INSERT INTO transactions (number, type, amount, date, time, category, reason, person_concerned, business_concerned, payment_method, author_id, receipt, validation_status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    number, body.type, Number(body.amount), body.date, body.time || null,
    body.category || '', body.reason || '', body.person_concerned || '',
    body.business_concerned || '', body.payment_method || '', user.id,
    body.receipt || '', 'en_attente', body.notes || ''
  ).run();

  const id = result.meta.last_row_id;
  await logActivity(env.DB, user.id, 'Ajout d\'une transaction', 'transaction', id, null, { number, type: body.type, amount: body.amount });
  return json({ id, number }, 201);
}
