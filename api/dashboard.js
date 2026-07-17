import { db, TODAY_EXPR } from '../lib/db.js';
import { getSessionUser, hasPermission } from '../lib/auth.js';
import { sendJson, sendError } from '../lib/respond.js';

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendError(res, 'Méthode non autorisée', 405);
  }
  if (!user || user.status !== 'accepted') return sendError(res, 'Accès refusé', 403);

  const canDecrees = hasPermission(user, 'decrees', 'view');
  const canCommuniques = hasPermission(user, 'communiques', 'view');
  const canAgenda = hasPermission(user, 'agenda', 'view');
  const canAccounting = hasPermission(user, 'accounting', 'view');

  const [
    decreesEnPreparation, decreesAPublier, communiquesEnAttente,
    upcomingEvents, accountingTotals, recentIn, recentOut,
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
  ]);

  return sendJson(res, {
    decrees_en_preparation: decreesEnPreparation.c,
    decrees_a_publier: decreesAPublier.c,
    communiques_en_attente: communiquesEnAttente.c,
    mail_en_attente: null,
    tasks_en_cours: null,
    upcoming_events: upcomingEvents.results,
    balance: canAccounting ? (accountingTotals.total_in - accountingTotals.total_out) : null,
    recent_in: recentIn.results,
    recent_out: recentOut.results,
  });
}
