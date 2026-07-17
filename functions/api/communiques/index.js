import { json, errorJson } from '../../_lib/respond.js';
import { hasPermission } from '../../_lib/auth.js';
import { nextNumber } from '../../_lib/numbering.js';
import { logActivity } from '../../_lib/log.js';

const SELECT = `SELECT c.*, au.discord_username as author_name
  FROM communiques c
  LEFT JOIN users au ON au.id = c.author_id`;

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'communiques', 'view')) return errorJson('Accès refusé', 403);

  const { env, request } = context;
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const q = url.searchParams.get('q');

  let query = SELECT + ' WHERE 1=1';
  const binds = [];
  if (status) { query += ' AND c.status = ?'; binds.push(status); }
  if (q) { query += ' AND (c.title LIKE ? OR c.number LIKE ?)'; binds.push(`%${q}%`, `%${q}%`); }
  query += ' ORDER BY c.created_at DESC';

  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return json({ communiques: results });
}

export async function onRequestPost(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'communiques', 'add')) return errorJson('Accès refusé', 403);

  const { env } = context;
  const body = await context.request.json();
  if (!body.title) return errorJson('Le titre est requis', 422);

  const number = await nextNumber(env.DB, 'COM-NH', '1892');
  const status = body.status || 'a_faire';
  const result = await env.DB.prepare(
    `INSERT INTO communiques (number, title, subject, content, author_id, target_audience, attachments, status, internal_notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    number, body.title, body.subject || '', body.content || '', user.id,
    body.target_audience || 'tous', JSON.stringify(body.attachments || []),
    status, body.internal_notes || ''
  ).run();

  const id = result.meta.last_row_id;
  await logActivity(env.DB, user.id, 'Création du communiqué', 'communique', id, null, { number, title: body.title });
  return json({ id, number }, 201);
}
