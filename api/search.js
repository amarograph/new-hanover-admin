import { db } from '../lib/db.js';
import { getSessionUser, hasPermission } from '../lib/auth.js';
import { sendJson, sendError } from '../lib/respond.js';

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendError(res, 'Méthode non autorisée', 405);
  }
  if (!user || user.status !== 'accepted') return sendError(res, 'Accès refusé', 403);

  const q = req.query.q;
  if (!q || q.length < 2) return sendJson(res, { results: [] });
  const like = `%${q}%`;

  const results = [];

  if (hasPermission(user, 'decrees', 'view')) {
    const { results: r } = await db.prepare(
      "SELECT id, number, title FROM decrees WHERE title LIKE ? OR number LIKE ? LIMIT 5"
    ).bind(like, like).all();
    r.forEach((x) => results.push({ type: 'decree', label: `${x.number} — ${x.title}`, url: `/decrets.html?id=${x.id}` }));
  }
  if (hasPermission(user, 'communiques', 'view')) {
    const { results: r } = await db.prepare(
      "SELECT id, number, title FROM communiques WHERE title LIKE ? OR number LIKE ? LIMIT 5"
    ).bind(like, like).all();
    r.forEach((x) => results.push({ type: 'communique', label: `${x.number} — ${x.title}`, url: `/communiques.html?id=${x.id}` }));
  }
  if (hasPermission(user, 'accounting', 'view')) {
    const { results: r } = await db.prepare(
      "SELECT id, number, reason FROM transactions WHERE number LIKE ? OR reason LIKE ? LIMIT 5"
    ).bind(like, like).all();
    r.forEach((x) => results.push({ type: 'transaction', label: `${x.number} — ${x.reason || ''}`, url: `/comptabilite.html?id=${x.id}` }));
  }
  if (hasPermission(user, 'agenda', 'view')) {
    const { results: r } = await db.prepare(
      "SELECT id, title, date FROM agenda_events WHERE title LIKE ? LIMIT 5"
    ).bind(like).all();
    r.forEach((x) => results.push({ type: 'agenda', label: `${x.title} (${x.date})`, url: `/agenda.html?id=${x.id}` }));
  }
  if (hasPermission(user, 'entreprises', 'view')) {
    const { results: r } = await db.prepare(
      "SELECT id, number, name FROM entreprises WHERE name LIKE ? OR number LIKE ? LIMIT 5"
    ).bind(like, like).all();
    r.forEach((x) => results.push({ type: 'entreprise', label: `${x.number} — ${x.name}`, url: `/entreprises.html?id=${x.id}` }));
  }
  if (hasPermission(user, 'employes', 'view')) {
    const { results: r } = await db.prepare(
      "SELECT id, number, first_name, last_name FROM employes WHERE first_name LIKE ? OR last_name LIKE ? OR number LIKE ? LIMIT 5"
    ).bind(like, like, like).all();
    r.forEach((x) => results.push({ type: 'employe', label: `${x.number} — ${x.first_name} ${x.last_name}`, url: `/employes.html?id=${x.id}` }));
  }
  if (hasPermission(user, 'admin', 'manage_users')) {
    const { results: r } = await db.prepare(
      "SELECT id, discord_username, character_first_name, character_last_name FROM users WHERE discord_username LIKE ? OR character_first_name LIKE ? OR character_last_name LIKE ? LIMIT 5"
    ).bind(like, like, like).all();
    r.forEach((x) => results.push({ type: 'user', label: `${x.character_first_name || ''} ${x.character_last_name || ''} (@${x.discord_username})`.trim(), url: `/utilisateurs.html?id=${x.id}` }));
  }

  return sendJson(res, { results });
}
