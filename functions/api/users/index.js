import { json, errorJson } from '../../_lib/respond.js';
import { hasPermission } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!hasPermission(user, 'admin', 'manage_users')) return errorJson('Accès refusé', 403);

  const { env, request } = context;
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const q = url.searchParams.get('q');

  let query = `SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE 1=1`;
  const binds = [];
  if (status) { query += ' AND u.status = ?'; binds.push(status); }
  if (q) {
    query += ' AND (u.discord_username LIKE ? OR u.character_first_name LIKE ? OR u.character_last_name LIKE ?)';
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  query += ' ORDER BY u.created_at DESC';

  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return json({ users: results });
}
