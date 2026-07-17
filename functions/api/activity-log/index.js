import { json, errorJson } from '../../_lib/respond.js';
import { hasPermission } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'admin', 'view_log')) return errorJson('Accès refusé', 403);

  const { env, request } = context;
  const url = new URL(request.url);
  const targetType = url.searchParams.get('target_type');
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500);

  let query = `SELECT l.*, u.discord_username as user_name
    FROM activity_log l LEFT JOIN users u ON u.id = l.user_id WHERE 1=1`;
  const binds = [];
  if (targetType) { query += ' AND l.target_type = ?'; binds.push(targetType); }
  query += ' ORDER BY l.created_at DESC LIMIT ?';
  binds.push(limit);

  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return json({ entries: results });
}
