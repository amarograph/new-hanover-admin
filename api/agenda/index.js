import { db, NOW_EXPR } from '../../lib/db.js';
import { getSessionUser, hasPermission } from '../../lib/auth.js';
import { logActivity } from '../../lib/log.js';
import { sendJson, sendError } from '../../lib/respond.js';

const SELECT = `SELECT e.*, ou.discord_username as organizer_name
  FROM agenda_events e
  LEFT JOIN users ou ON ou.id = e.organizer_id`;

async function getEvent(id) {
  return db.prepare(SELECT + ' WHERE e.id = ?').bind(id).first();
}

// Utilisé par la bannière de rappel globale (nav.js) : tout organisateur
// connecté peut voir ses propres rendez-vous de l'heure à venir, même sans
// la permission "view" sur tout le module agenda.
async function myUpcomingReminders(req, res, user) {
  if (!user) return sendError(res, 'Non authentifié', 401);
  const { results } = await db.prepare(
    `SELECT id, title, date, start_time, location FROM agenda_events
     WHERE status != 'annule' AND start_time IS NOT NULL
       AND (date || ' ' || start_time)::timestamp BETWEEN (NOW() AT TIME ZONE 'UTC') AND (NOW() AT TIME ZONE 'UTC' + interval '1 hour')
       AND (
         organizer_id = ?
         OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(participants::jsonb) p WHERE p::int = ?)
       )
     ORDER BY date ASC, start_time ASC`
  ).bind(user.id, user.id).all();
  return sendJson(res, { events: results });
}

async function list(req, res, user) {
  if (req.query.my_upcoming_reminder === '1') return myUpcomingReminders(req, res, user);

  // Liste des personnes assignables, pour le menu déroulant "Participants".
  if (req.query.assignable_users === '1') {
    if (!hasPermission(user, 'agenda', 'add') && !hasPermission(user, 'agenda', 'edit')) return sendError(res, 'Accès refusé', 403);
    const { results } = await db.prepare(
      "SELECT id, character_first_name, character_last_name, discord_username FROM users WHERE status='accepted' ORDER BY character_last_name ASC, character_first_name ASC"
    ).all();
    return sendJson(res, { users: results });
  }

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

async function create(req, res, user) {
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

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  const slug = Array.isArray(req.query.slug) ? req.query.slug : (req.query.slug ? [req.query.slug] : []);

  if (slug.length === 0) {
    if (req.method === 'GET') return list(req, res, user);
    if (req.method === 'POST') return create(req, res, user);
    res.setHeader('Allow', 'GET, POST');
    return sendError(res, 'Méthode non autorisée', 405);
  }

  const id = slug[0];

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
