import { db } from '../../lib/db.js';
import { getSessionUser, hasPermission } from '../../lib/auth.js';
import { sendJson, sendError } from '../../lib/respond.js';

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendError(res, 'Méthode non autorisée', 405);
  }
  if (!hasPermission(user, 'accounting', 'view')) return sendError(res, 'Accès refusé', 403);

  const totals = await db.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN type='entree' AND validation_status='validee' THEN amount ELSE 0 END), 0) as total_in,
       COALESCE(SUM(CASE WHEN type='sortie' AND validation_status='validee' THEN amount ELSE 0 END), 0) as total_out,
       COALESCE(SUM(CASE WHEN validation_status='en_attente' THEN 1 ELSE 0 END), 0)::int as pending_count
     FROM transactions`
  ).first();

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthTotals = await db.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN type='entree' AND validation_status='validee' THEN amount ELSE 0 END), 0) as month_in,
       COALESCE(SUM(CASE WHEN type='sortie' AND validation_status='validee' THEN amount ELSE 0 END), 0) as month_out
     FROM transactions WHERE date >= ?`
  ).bind(monthStart).first();

  const recentIn = await db.prepare(
    `SELECT * FROM transactions WHERE type='entree' ORDER BY date DESC, created_at DESC LIMIT 5`
  ).all();
  const recentOut = await db.prepare(
    `SELECT * FROM transactions WHERE type='sortie' ORDER BY date DESC, created_at DESC LIMIT 5`
  ).all();

  return sendJson(res, {
    balance: totals.total_in - totals.total_out,
    total_in: totals.total_in,
    total_out: totals.total_out,
    pending_count: totals.pending_count,
    month_in: monthTotals.month_in,
    month_out: monthTotals.month_out,
    recent_in: recentIn.results,
    recent_out: recentOut.results,
  });
}
