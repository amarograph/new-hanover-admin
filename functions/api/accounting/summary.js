import { json, errorJson } from '../../_lib/respond.js';
import { hasPermission } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'accounting', 'view')) return errorJson('Accès refusé', 403);
  const { env } = context;

  const totals = await env.DB.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN type='entree' AND validation_status='validee' THEN amount ELSE 0 END), 0) as total_in,
       COALESCE(SUM(CASE WHEN type='sortie' AND validation_status='validee' THEN amount ELSE 0 END), 0) as total_out,
       COALESCE(SUM(CASE WHEN validation_status='en_attente' THEN 1 ELSE 0 END), 0) as pending_count
     FROM transactions`
  ).first();

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthTotals = await env.DB.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN type='entree' AND validation_status='validee' THEN amount ELSE 0 END), 0) as month_in,
       COALESCE(SUM(CASE WHEN type='sortie' AND validation_status='validee' THEN amount ELSE 0 END), 0) as month_out
     FROM transactions WHERE date >= ?`
  ).bind(monthStart).first();

  const recentIn = await env.DB.prepare(
    `SELECT * FROM transactions WHERE type='entree' ORDER BY date DESC, created_at DESC LIMIT 5`
  ).all();
  const recentOut = await env.DB.prepare(
    `SELECT * FROM transactions WHERE type='sortie' ORDER BY date DESC, created_at DESC LIMIT 5`
  ).all();

  return json({
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
