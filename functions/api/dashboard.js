import { json, errorJson } from '../_lib/respond.js';
import { hasPermission } from '../_lib/auth.js';

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user || user.status !== 'accepted') return errorJson('Accès refusé', 403);
  const { env } = context;

  const canDecrees = hasPermission(user, 'decrees', 'view');
  const canCommuniques = hasPermission(user, 'communiques', 'view');
  const canAgenda = hasPermission(user, 'agenda', 'view');
  const canAccounting = hasPermission(user, 'accounting', 'view');
  const canLog = hasPermission(user, 'admin', 'view_log');

  const [
    decreesEnPreparation, decreesAPublier, communiquesEnAttente,
    upcomingEvents, accountingTotals, recentIn, recentOut, recentActivity,
  ] = await Promise.all([
    canDecrees
      ? env.DB.prepare("SELECT COUNT(*) as c FROM decrees WHERE category IN ('a_faire','en_redaction')").first()
      : { c: null },
    canDecrees
      ? env.DB.prepare("SELECT COUNT(*) as c FROM decrees WHERE category = 'a_publier'").first()
      : { c: null },
    canCommuniques
      ? env.DB.prepare("SELECT COUNT(*) as c FROM communiques WHERE status = 'en_attente_validation'").first()
      : { c: null },
    canAgenda
      ? env.DB.prepare("SELECT e.*, ou.discord_username as organizer_name FROM agenda_events e LEFT JOIN users ou ON ou.id = e.organizer_id WHERE e.date >= date('now') AND e.status != 'annule' ORDER BY e.date ASC, e.start_time ASC LIMIT 5").all()
      : { results: [] },
    canAccounting
      ? env.DB.prepare("SELECT COALESCE(SUM(CASE WHEN type='entree' AND validation_status='validee' THEN amount ELSE 0 END),0) as total_in, COALESCE(SUM(CASE WHEN type='sortie' AND validation_status='validee' THEN amount ELSE 0 END),0) as total_out FROM transactions").first()
      : { total_in: null, total_out: null },
    canAccounting
      ? env.DB.prepare("SELECT * FROM transactions WHERE type='entree' ORDER BY date DESC, created_at DESC LIMIT 5").all()
      : { results: [] },
    canAccounting
      ? env.DB.prepare("SELECT * FROM transactions WHERE type='sortie' ORDER BY date DESC, created_at DESC LIMIT 5").all()
      : { results: [] },
    canLog
      ? env.DB.prepare("SELECT l.*, u.discord_username as user_name FROM activity_log l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.created_at DESC LIMIT 8").all()
      : { results: [] },
  ]);

  return json({
    decrees_en_preparation: decreesEnPreparation.c,
    decrees_a_publier: decreesAPublier.c,
    communiques_en_attente: communiquesEnAttente.c,
    mail_en_attente: null,
    tasks_en_cours: null,
    upcoming_events: upcomingEvents.results,
    balance: canAccounting ? (accountingTotals.total_in - accountingTotals.total_out) : null,
    recent_in: recentIn.results,
    recent_out: recentOut.results,
    recent_activity: recentActivity.results,
  });
}
