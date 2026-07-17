import { json, errorJson } from '../../_lib/respond.js';
import { hasPermission } from '../../_lib/auth.js';
import { nextNumber } from '../../_lib/numbering.js';
import { logActivity } from '../../_lib/log.js';

const SELECT = `SELECT d.*, au.discord_username as author_name, vu.discord_username as validator_name
  FROM decrees d
  LEFT JOIN users au ON au.id = d.author_id
  LEFT JOIN users vu ON vu.id = d.validated_by_id`;

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'decrees', 'view')) return errorJson('Accès refusé', 403);

  const { env, request } = context;
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const author = url.searchParams.get('author');
  const q = url.searchParams.get('q');

  let query = SELECT + ' WHERE 1=1';
  const binds = [];
  if (category) { query += ' AND d.category = ?'; binds.push(category); }
  if (author) { query += ' AND d.author_id = ?'; binds.push(author); }
  if (q) { query += ' AND (d.title LIKE ? OR d.number LIKE ?)'; binds.push(`%${q}%`, `%${q}%`); }
  query += ' ORDER BY d.created_at DESC';

  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return json({ decrees: results });
}

export async function onRequestPost(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'decrees', 'add')) return errorJson('Accès refusé', 403);

  const { env } = context;
  const body = await context.request.json();
  if (!body.title) return errorJson('Le titre est requis', 422);

  const number = await nextNumber(env.DB, 'DEC-NH', '1892');
  const category = body.category || 'a_faire';
  const result = await env.DB.prepare(
    `INSERT INTO decrees (number, title, category, status, effective_date, author_id, content, attachments, confidentiality, internal_notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    number, body.title, category, category, body.effective_date || null, user.id,
    body.content || '', JSON.stringify(body.attachments || []),
    body.confidentiality || 'interne', body.internal_notes || ''
  ).run();

  const id = result.meta.last_row_id;
  await logActivity(env.DB, user.id, 'Création du décret', 'decree', id, null, { number, title: body.title });
  return json({ id, number }, 201);
}
