import { db, TODAY_EXPR } from '../lib/db.js';
import { getSessionUser, hasPermission } from '../lib/auth.js';
import { sendJson, sendError } from '../lib/respond.js';

// Vue consolidée en lecture seule des éléments déjà archivés/clos dans les
// autres modules : pas de table dédiée, juste des requêtes filtrées.
async function archivesView(req, res, user) {
  const results = [];

  if (hasPermission(user, 'decrees', 'view')) {
    const { results: r } = await db.prepare(
      "SELECT id, number, title, updated_at FROM decrees WHERE category = 'archive' ORDER BY updated_at DESC LIMIT 50"
    ).all();
    r.forEach((x) => results.push({ type: 'Décret archivé', label: `${x.number || ''} — ${x.title}`, date: x.updated_at, url: `/decrets.html?id=${x.id}` }));
  }
  if (hasPermission(user, 'communiques', 'view')) {
    const { results: r } = await db.prepare(
      "SELECT id, number, title, updated_at FROM communiques WHERE status = 'archive' ORDER BY updated_at DESC LIMIT 50"
    ).all();
    r.forEach((x) => results.push({ type: 'Communiqué archivé', label: `${x.number || ''} — ${x.title}`, date: x.updated_at, url: `/communiques.html?id=${x.id}` }));
  }
  if (hasPermission(user, 'courriers', 'view')) {
    const { results: r } = await db.prepare(
      "SELECT id, number, subject, sent_at FROM courriers WHERE status = 'envoye' ORDER BY sent_at DESC LIMIT 50"
    ).all();
    r.forEach((x) => results.push({ type: 'Courrier envoyé', label: `${x.number || ''} — ${x.subject}`, date: x.sent_at, url: `/courriers.html?id=${x.id}` }));
  }
  if (hasPermission(user, 'entreprises', 'view')) {
    const { results: r } = await db.prepare(
      "SELECT id, number, name, updated_at FROM entreprises WHERE status IN ('fermee','archivee') ORDER BY updated_at DESC LIMIT 50"
    ).all();
    r.forEach((x) => results.push({ type: 'Entreprise fermée/archivée', label: `${x.number || ''} — ${x.name}`, date: x.updated_at, url: `/entreprises.html?id=${x.id}` }));
  }
  if (hasPermission(user, 'accounting', 'view')) {
    const { results: r } = await db.prepare(
      "SELECT id, number, reason, updated_at FROM transactions WHERE validation_status = 'annulee' ORDER BY updated_at DESC LIMIT 50"
    ).all();
    r.forEach((x) => results.push({ type: 'Transaction annulée', label: `${x.number || ''} — ${x.reason || ''}`, date: x.updated_at, url: `/comptabilite.html?id=${x.id}` }));
  }
  if (hasPermission(user, 'armes', 'view')) {
    const { results: r } = await db.prepare(
      "SELECT id, number, type, updated_at FROM armes WHERE category = 'non_connu' ORDER BY updated_at DESC LIMIT 50"
    ).all();
    r.forEach((x) => results.push({ type: 'Arme non connue', label: `${x.number || ''} — ${x.type || ''}`, date: x.updated_at, url: `/armes.html?id=${x.id}` }));
  }
  if (hasPermission(user, 'chevaux', 'view')) {
    const { results: r } = await db.prepare(
      "SELECT id, number, name, updated_at FROM chevaux WHERE status = 'archive' ORDER BY updated_at DESC LIMIT 50"
    ).all();
    r.forEach((x) => results.push({ type: 'Cheval archivé', label: `${x.number || ''} — ${x.name || ''}`, date: x.updated_at, url: `/chevaux.html?id=${x.id}` }));
  }
  if (hasPermission(user, 'agenda', 'view')) {
    const { results: r } = await db.prepare(
      "SELECT id, title, date FROM agenda_events WHERE status = 'termine' ORDER BY date DESC LIMIT 50"
    ).all();
    r.forEach((x) => results.push({ type: 'Événement terminé', label: x.title, date: x.date, url: `/agenda.html?id=${x.id}` }));
  }
  if (hasPermission(user, 'evenements', 'view')) {
    const { results: r } = await db.prepare(
      "SELECT id, number, title, updated_at FROM evenements WHERE status IN ('termine','annule','archive') ORDER BY updated_at DESC LIMIT 50"
    ).all();
    r.forEach((x) => results.push({ type: 'Événement clos', label: `${x.number || ''} — ${x.title}`, date: x.updated_at, url: `/evenements.html?id=${x.id}` }));
  }
  if (hasPermission(user, 'taches', 'view')) {
    const { results: r } = await db.prepare(
      "SELECT id, text, updated_at FROM taches WHERE done = 1 ORDER BY updated_at DESC LIMIT 50"
    ).all();
    r.forEach((x) => results.push({ type: 'Tâche terminée', label: x.text, date: x.updated_at, url: '/taches.html' }));
  }

  results.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  return sendJson(res, { archives: results });
}

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendError(res, 'Méthode non autorisée', 405);
  }
  if (!user || user.status !== 'accepted') return sendError(res, 'Accès refusé', 403);

  if (req.query.view === 'archives') return archivesView(req, res, user);

  const canDecrees = hasPermission(user, 'decrees', 'view');
  const canCommuniques = hasPermission(user, 'communiques', 'view');
  const canAgenda = hasPermission(user, 'agenda', 'view');
  const canAccounting = hasPermission(user, 'accounting', 'view');
  const canBoiteLettres = hasPermission(user, 'boite_lettres', 'view');

  const [
    decreesEnPreparation, decreesAPublier, communiquesEnAttente,
    upcomingEvents, accountingTotals, recentIn, recentOut, boiteLettresARepondre,
  ] = await Promise.all([
    canDecrees
      ? db.prepare("SELECT COUNT(*)::int as c FROM decrees WHERE category IN ('a_faire','en_redaction')").first()
      : { c: null },
    canDecrees
      ? db.prepare("SELECT COUNT(*)::int as c FROM decrees WHERE category = 'a_publier'").first()
      : { c: null },
    canCommuniques
      ? db.prepare("SELECT COUNT(*)::int as c FROM communiques WHERE status = 'en_attente_validation'").first()
      : { c: null },
    canAgenda
      ? db.prepare(`SELECT e.*, ou.discord_username as organizer_name FROM agenda_events e LEFT JOIN users ou ON ou.id = e.organizer_id WHERE e.date >= ${TODAY_EXPR} AND e.status != 'annule' ORDER BY e.date ASC, e.start_time ASC LIMIT 5`).all()
      : { results: [] },
    canAccounting
      ? db.prepare("SELECT COALESCE(SUM(CASE WHEN type='entree' AND validation_status='validee' THEN amount ELSE 0 END),0) as total_in, COALESCE(SUM(CASE WHEN type='sortie' AND validation_status='validee' THEN amount ELSE 0 END),0) as total_out FROM transactions").first()
      : { total_in: null, total_out: null },
    canAccounting
      ? db.prepare("SELECT * FROM transactions WHERE type='entree' ORDER BY date DESC, created_at DESC LIMIT 5").all()
      : { results: [] },
    canAccounting
      ? db.prepare("SELECT * FROM transactions WHERE type='sortie' ORDER BY date DESC, created_at DESC LIMIT 5").all()
      : { results: [] },
    canBoiteLettres
      ? db.prepare("SELECT id, description, created_at FROM boite_lettres WHERE status = 'a_repondre' ORDER BY created_at ASC LIMIT 5").all()
      : { results: [] },
  ]);

  return sendJson(res, {
    decrees_en_preparation: decreesEnPreparation.c,
    decrees_a_publier: decreesAPublier.c,
    communiques_en_attente: communiquesEnAttente.c,
    mail_en_attente: canBoiteLettres ? boiteLettresARepondre.results.length : null,
    boite_lettres_a_repondre: boiteLettresARepondre.results,
    tasks_en_cours: null,
    upcoming_events: upcomingEvents.results,
    balance: canAccounting ? (accountingTotals.total_in - accountingTotals.total_out) : null,
    recent_in: recentIn.results,
    recent_out: recentOut.results,
  });
}
