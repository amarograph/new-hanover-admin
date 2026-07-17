import { db } from '../../lib/db.js';
import { getSessionUser, hasPermission } from '../../lib/auth.js';
import { nextNumber } from '../../lib/numbering.js';
import { logActivity } from '../../lib/log.js';
import { sendJson, sendError } from '../../lib/respond.js';

const SELECT = `SELECT d.*, au.discord_username as author_name, vu.discord_username as validator_name
  FROM decrees d
  LEFT JOIN users au ON au.id = d.author_id
  LEFT JOIN users vu ON vu.id = d.validated_by_id`;

export default async function handler(req, res) {
  const user = await getSessionUser(req);

  if (req.method === 'GET') {
    if (!hasPermission(user, 'decrees', 'view')) return sendError(res, 'Accès refusé', 403);

    const { category, author, q } = req.query;
    let query = SELECT + ' WHERE 1=1';
    const binds = [];
    if (category) { query += ' AND d.category = ?'; binds.push(category); }
    if (author) { query += ' AND d.author_id = ?'; binds.push(author); }
    if (q) { query += ' AND (d.title LIKE ? OR d.number LIKE ?)'; binds.push(`%${q}%`, `%${q}%`); }
    query += ' ORDER BY d.created_at DESC';

    const { results } = await db.prepare(query).bind(...binds).all();
    return sendJson(res, { decrees: results });
  }

  if (req.method === 'POST') {
    if (!hasPermission(user, 'decrees', 'add')) return sendError(res, 'Accès refusé', 403);

    const body = req.body || {};
    if (!body.title) return sendError(res, 'Le titre est requis', 422);

    const number = await nextNumber(db, 'DEC-NH', '1892');
    const category = body.category || 'a_faire';
    const result = await db.prepare(
      `INSERT INTO decrees (number, title, category, status, effective_date, author_id, content, attachments, confidentiality, internal_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
    ).bind(
      number, body.title, category, category, body.effective_date || null, user.id,
      body.content || '', JSON.stringify(body.attachments || []),
      body.confidentiality || 'interne', body.internal_notes || ''
    ).run();

    const id = result.meta.last_row_id;
    await logActivity(db, user.id, 'Création du décret', 'decree', id, null, { number, title: body.title });
    return sendJson(res, { id, number }, 201);
  }

  res.setHeader('Allow', 'GET, POST');
  return sendError(res, 'Méthode non autorisée', 405);
}
