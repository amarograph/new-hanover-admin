import { db } from '../lib/db.js';
import { getSessionUser, hasPermission } from '../lib/auth.js';
import { sendJson, sendError } from '../lib/respond.js';

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendError(res, 'Méthode non autorisée', 405);
  }
  if (!hasPermission(user, 'admin', 'view_log')) return sendError(res, 'Accès refusé', 403);

  const { target_type: targetType } = req.query;
  const limit = Math.min(Number(req.query.limit) || 100, 500);

  let query = `SELECT l.*, u.discord_username as user_name
    FROM activity_log l LEFT JOIN users u ON u.id = l.user_id WHERE 1=1`;
  const binds = [];
  if (targetType) { query += ' AND l.target_type = ?'; binds.push(targetType); }
  query += ' ORDER BY l.created_at DESC LIMIT ?';
  binds.push(limit);

  const { results } = await db.prepare(query).bind(...binds).all();
  return sendJson(res, { entries: results });
}
