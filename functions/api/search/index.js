import { json, errorJson } from '../../_lib/respond.js';
import { hasPermission } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user || user.status !== 'accepted') return errorJson('Accès refusé', 403);
  const { env, request } = context;
  const q = new URL(request.url).searchParams.get('q');
  if (!q || q.length < 2) return json({ results: [] });
  const like = `%${q}%`;

  const results = [];

  if (hasPermission(user, 'decrees', 'view')) {
    const { results: r } = await env.DB.prepare(
      "SELECT id, number, title FROM decrees WHERE title LIKE ? OR number LIKE ? LIMIT 5"
    ).bind(like, like).all();
    r.forEach((x) => results.push({ type: 'decree', label: `${x.number} — ${x.title}`, url: `/decrets.html?id=${x.id}` }));
  }
  if (hasPermission(user, 'communiques', 'view')) {
    const { results: r } = await env.DB.prepare(
      "SELECT id, number, title FROM communiques WHERE title LIKE ? OR number LIKE ? LIMIT 5"
    ).bind(like, like).all();
    r.forEach((x) => results.push({ type: 'communique', label: `${x.number} — ${x.title}`, url: `/communiques.html?id=${x.id}` }));
  }
  if (hasPermission(user, 'accounting', 'view')) {
    const { results: r } = await env.DB.prepare(
      "SELECT id, number, reason FROM transactions WHERE number LIKE ? OR reason LIKE ? LIMIT 5"
    ).bind(like, like).all();
    r.forEach((x) => results.push({ type: 'transaction', label: `${x.number} — ${x.reason || ''}`, url: `/comptabilite.html?id=${x.id}` }));
  }
  if (hasPermission(user, 'agenda', 'view')) {
    const { results: r } = await env.DB.prepare(
      "SELECT id, title, date FROM agenda_events WHERE title LIKE ? LIMIT 5"
    ).bind(like).all();
    r.forEach((x) => results.push({ type: 'agenda', label: `${x.title} (${x.date})`, url: `/agenda.html?id=${x.id}` }));
  }
  if (hasPermission(user, 'admin', 'manage_users')) {
    const { results: r } = await env.DB.prepare(
      "SELECT id, discord_username, character_first_name, character_last_name FROM users WHERE discord_username LIKE ? OR character_first_name LIKE ? OR character_last_name LIKE ? LIMIT 5"
    ).bind(like, like, like).all();
    r.forEach((x) => results.push({ type: 'user', label: `${x.character_first_name || ''} ${x.character_last_name || ''} (@${x.discord_username})`.trim(), url: `/utilisateurs.html?id=${x.id}` }));
  }

  return json({ results });
}
