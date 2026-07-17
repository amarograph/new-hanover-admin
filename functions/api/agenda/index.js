import { json, errorJson } from '../../_lib/respond.js';
import { hasPermission } from '../../_lib/auth.js';
import { logActivity } from '../../_lib/log.js';

const SELECT = `SELECT e.*, ou.discord_username as organizer_name
  FROM agenda_events e
  LEFT JOIN users ou ON ou.id = e.organizer_id`;

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'agenda', 'view')) return errorJson('Accès refusé', 403);

  const { env, request } = context;
  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const q = url.searchParams.get('q');

  let query = SELECT + ' WHERE 1=1';
  const binds = [];
  if (from) { query += ' AND e.date >= ?'; binds.push(from); }
  if (to) { query += ' AND e.date <= ?'; binds.push(to); }
  if (q) { query += ' AND e.title LIKE ?'; binds.push(`%${q}%`); }
  query += ' ORDER BY e.date ASC, e.start_time ASC';

  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return json({ events: results });
}

export async function onRequestPost(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'agenda', 'add')) return errorJson('Accès refusé', 403);

  const { env } = context;
  const body = await context.request.json();
  if (!body.title || !body.date) return errorJson('Le titre et la date sont requis', 422);

  const result = await env.DB.prepare(
    `INSERT INTO agenda_events (title, description, type, date, start_time, end_time, location, organizer_id, participants, priority, reminder, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    body.title, body.description || '', body.type || 'rendez_vous', body.date,
    body.start_time || null, body.end_time || null, body.location || '',
    user.id, JSON.stringify(body.participants || []), body.priority || 'normale',
    body.reminder ? 1 : 0, body.status || 'prevu'
  ).run();

  const id = result.meta.last_row_id;
  await logActivity(env.DB, user.id, 'Création d\'un élément d\'agenda', 'agenda_event', id, null, { title: body.title, date: body.date });
  return json({ id }, 201);
}
