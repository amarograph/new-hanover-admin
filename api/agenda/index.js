import { db } from '../../lib/db.js';
import { getSessionUser, hasPermission } from '../../lib/auth.js';
import { logActivity } from '../../lib/log.js';
import { sendJson, sendError } from '../../lib/respond.js';

const SELECT = `SELECT e.*, ou.discord_username as organizer_name
  FROM agenda_events e
  LEFT JOIN users ou ON ou.id = e.organizer_id`;

export default async function handler(req, res) {
  const user = await getSessionUser(req);

  if (req.method === 'GET') {
    if (!hasPermission(user, 'agenda', 'view')) return sendError(res, 'Accès refusé', 403);

    const { from, to, q } = req.query;
    let query = SELECT + ' WHERE 1=1';
    const binds = [];
    if (from) { query += ' AND e.date >= ?'; binds.push(from); }
    if (to) { query += ' AND e.date <= ?'; binds.push(to); }
    if (q) { query += ' AND e.title LIKE ?'; binds.push(`%${q}%`); }
    query += ' ORDER BY e.date ASC, e.start_time ASC';

    const { results } = await db.prepare(query).bind(...binds).all();
    return sendJson(res, { events: results });
  }

  if (req.method === 'POST') {
    if (!hasPermission(user, 'agenda', 'add')) return sendError(res, 'Accès refusé', 403);

    const body = req.body || {};
    if (!body.title || !body.date) return sendError(res, 'Le titre et la date sont requis', 422);

    const result = await db.prepare(
      `INSERT INTO agenda_events (title, description, type, date, start_time, end_time, location, organizer_id, participants, priority, reminder, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
    ).bind(
      body.title, body.description || '', body.type || 'rendez_vous', body.date,
      body.start_time || null, body.end_time || null, body.location || '',
      user.id, JSON.stringify(body.participants || []), body.priority || 'normale',
      body.reminder ? 1 : 0, body.status || 'prevu'
    ).run();

    const id = result.meta.last_row_id;
    await logActivity(db, user.id, 'Création d\'un élément d\'agenda', 'agenda_event', id, null, { title: body.title, date: body.date });
    return sendJson(res, { id }, 201);
  }

  res.setHeader('Allow', 'GET, POST');
  return sendError(res, 'Méthode non autorisée', 405);
}
