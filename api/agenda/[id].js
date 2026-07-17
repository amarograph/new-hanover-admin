import { db, NOW_EXPR } from '../../lib/db.js';
import { getSessionUser, hasPermission } from '../../lib/auth.js';
import { logActivity } from '../../lib/log.js';
import { sendJson, sendError } from '../../lib/respond.js';

const SELECT = `SELECT e.*, ou.discord_username as organizer_name
  FROM agenda_events e
  LEFT JOIN users ou ON ou.id = e.organizer_id
  WHERE e.id = ?`;

async function getEvent(id) {
  return db.prepare(SELECT).bind(id).first();
}

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  const { id } = req.query;

  if (req.method === 'GET') {
    if (!hasPermission(user, 'agenda', 'view')) return sendError(res, 'Accès refusé', 403);
    const event = await getEvent(id);
    if (!event) return sendError(res, 'Élément introuvable', 404);
    return sendJson(res, { event });
  }

  if (req.method === 'PUT') {
    if (!hasPermission(user, 'agenda', 'edit')) return sendError(res, 'Accès refusé', 403);
    const before = await getEvent(id);
    if (!before) return sendError(res, 'Élément introuvable', 404);

    const body = req.body || {};
    if (!body.title || !body.date) return sendError(res, 'Le titre et la date sont requis', 422);

    await db.prepare(
      `UPDATE agenda_events SET title=?, description=?, type=?, date=?, start_time=?, end_time=?, location=?, participants=?, priority=?, reminder=?, status=?, updated_at=${NOW_EXPR} WHERE id=?`
    ).bind(
      body.title, body.description || '', body.type || 'rendez_vous', body.date,
      body.start_time || null, body.end_time || null, body.location || '',
      JSON.stringify(body.participants || []), body.priority || 'normale',
      body.reminder ? 1 : 0, body.status || before.status, id
    ).run();

    await logActivity(db, user.id, 'Modification d\'un élément d\'agenda', 'agenda_event', id, before, body);
    return sendJson(res, { ok: true });
  }

  if (req.method === 'DELETE') {
    if (!hasPermission(user, 'agenda', 'archive') && !hasPermission(user, 'agenda', 'delete')) return sendError(res, 'Accès refusé', 403);
    const before = await getEvent(id);
    if (!before) return sendError(res, 'Élément introuvable', 404);

    await db.prepare('DELETE FROM agenda_events WHERE id=?').bind(id).run();
    await logActivity(db, user.id, 'Suppression d\'un élément d\'agenda', 'agenda_event', id, before, null);
    return sendJson(res, { ok: true });
  }

  res.setHeader('Allow', 'GET, PUT, DELETE');
  return sendError(res, 'Méthode non autorisée', 405);
}
