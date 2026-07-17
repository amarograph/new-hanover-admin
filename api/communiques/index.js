import { db } from '../../lib/db.js';
import { getSessionUser, hasPermission } from '../../lib/auth.js';
import { nextNumber } from '../../lib/numbering.js';
import { logActivity } from '../../lib/log.js';
import { sendJson, sendError } from '../../lib/respond.js';

const SELECT = `SELECT c.*, au.discord_username as author_name
  FROM communiques c
  LEFT JOIN users au ON au.id = c.author_id`;

export default async function handler(req, res) {
  const user = await getSessionUser(req);

  if (req.method === 'GET') {
    if (!hasPermission(user, 'communiques', 'view')) return sendError(res, 'Accès refusé', 403);

    const { status, q } = req.query;
    let query = SELECT + ' WHERE 1=1';
    const binds = [];
    if (status) { query += ' AND c.status = ?'; binds.push(status); }
    if (q) { query += ' AND (c.title LIKE ? OR c.number LIKE ?)'; binds.push(`%${q}%`, `%${q}%`); }
    query += ' ORDER BY c.created_at DESC';

    const { results } = await db.prepare(query).bind(...binds).all();
    return sendJson(res, { communiques: results });
  }

  if (req.method === 'POST') {
    if (!hasPermission(user, 'communiques', 'add')) return sendError(res, 'Accès refusé', 403);

    const body = req.body || {};
    if (!body.title) return sendError(res, 'Le titre est requis', 422);

    const number = await nextNumber(db, 'COM-NH', '1892');
    const status = body.status || 'a_faire';
    const result = await db.prepare(
      `INSERT INTO communiques (number, title, subject, content, author_id, target_audience, attachments, status, internal_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
    ).bind(
      number, body.title, body.subject || '', body.content || '', user.id,
      body.target_audience || 'tous', JSON.stringify(body.attachments || []),
      status, body.internal_notes || ''
    ).run();

    const id = result.meta.last_row_id;
    await logActivity(db, user.id, 'Création du communiqué', 'communique', id, null, { number, title: body.title });
    return sendJson(res, { id, number }, 201);
  }

  res.setHeader('Allow', 'GET, POST');
  return sendError(res, 'Méthode non autorisée', 405);
}
