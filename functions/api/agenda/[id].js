import { json, errorJson } from '../../_lib/respond.js';
import { hasPermission } from '../../_lib/auth.js';
import { logActivity } from '../../_lib/log.js';

const SELECT = `SELECT e.*, ou.discord_username as organizer_name
  FROM agenda_events e
  LEFT JOIN users ou ON ou.id = e.organizer_id
  WHERE e.id = ?`;

async function getEvent(env, id) {
  return env.DB.prepare(SELECT).bind(id).first();
}

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'agenda', 'view')) return errorJson('Accès refusé', 403);
  const event = await getEvent(context.env, context.params.id);
  if (!event) return errorJson('Élément introuvable', 404);
  return json({ event });
}

export async function onRequestPut(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'agenda', 'edit')) return errorJson('Accès refusé', 403);
  const { env, params } = context;
  const before = await getEvent(env, params.id);
  if (!before) return errorJson('Élément introuvable', 404);

  const body = await context.request.json();
  if (!body.title || !body.date) return errorJson('Le titre et la date sont requis', 422);

  await env.DB.prepare(
    `UPDATE agenda_events SET title=?, description=?, type=?, date=?, start_time=?, end_time=?, location=?, participants=?, priority=?, reminder=?, status=?, updated_at=datetime('now') WHERE id=?`
  ).bind(
    body.title, body.description || '', body.type || 'rendez_vous', body.date,
    body.start_time || null, body.end_time || null, body.location || '',
    JSON.stringify(body.participants || []), body.priority || 'normale',
    body.reminder ? 1 : 0, body.status || before.status, params.id
  ).run();

  await logActivity(env.DB, user.id, 'Modification d\'un élément d\'agenda', 'agenda_event', params.id, before, body);
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'agenda', 'archive') && !hasPermission(user, 'agenda', 'delete')) return errorJson('Accès refusé', 403);
  const { env, params } = context;
  const before = await getEvent(env, params.id);
  if (!before) return errorJson('Élément introuvable', 404);

  await env.DB.prepare('DELETE FROM agenda_events WHERE id=?').bind(params.id).run();
  await logActivity(env.DB, user.id, 'Suppression d\'un élément d\'agenda', 'agenda_event', params.id, before, null);
  return json({ ok: true });
}
