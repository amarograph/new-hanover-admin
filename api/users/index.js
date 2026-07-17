import { db } from '../../lib/db.js';
import { getSessionUser, hasPermission } from '../../lib/auth.js';
import { sendJson, sendError } from '../../lib/respond.js';

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendError(res, 'Méthode non autorisée', 405);
  }
  if (!hasPermission(user, 'admin', 'manage_users')) return sendError(res, 'Accès refusé', 403);

  const { status, q } = req.query;
  let query = `SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE 1=1`;
  const binds = [];
  if (status) { query += ' AND u.status = ?'; binds.push(status); }
  if (q) {
    query += ' AND (u.discord_username LIKE ? OR u.character_first_name LIKE ? OR u.character_last_name LIKE ?)';
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  query += ' ORDER BY u.created_at DESC';

  const { results } = await db.prepare(query).bind(...binds).all();
  return sendJson(res, { users: results });
}
