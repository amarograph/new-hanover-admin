import { db, NOW_EXPR } from '../../lib/db.js';
import { getSessionUser, hasPermission } from '../../lib/auth.js';
import { logActivity } from '../../lib/log.js';
import { sendJson, sendError } from '../../lib/respond.js';

const SELECT = `SELECT c.*, au.discord_username as author_name
  FROM communiques c
  LEFT JOIN users au ON au.id = c.author_id
  WHERE c.id = ?`;

async function getCommunique(id) {
  return db.prepare(SELECT).bind(id).first();
}

const STATUS_PERMISSION = {
  a_faire: 'edit',
  en_redaction: 'edit',
  en_attente_validation: 'edit',
  a_publier: 'validate',
  publie: 'validate',
  archive: 'archive',
};

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  const { id } = req.query;

  if (req.method === 'GET') {
    if (!hasPermission(user, 'communiques', 'view')) return sendError(res, 'Accès refusé', 403);
    const communique = await getCommunique(id);
    if (!communique) return sendError(res, 'Communiqué introuvable', 404);
    return sendJson(res, { communique });
  }

  if (req.method === 'PUT') {
    if (!hasPermission(user, 'communiques', 'edit')) return sendError(res, 'Accès refusé', 403);
    const before = await getCommunique(id);
    if (!before) return sendError(res, 'Communiqué introuvable', 404);

    const body = req.body || {};
    if (!body.title) return sendError(res, 'Le titre est requis', 422);

    await db.prepare(
      `UPDATE communiques SET title=?, subject=?, content=?, target_audience=?, attachments=?, internal_notes=?, updated_at=${NOW_EXPR} WHERE id=?`
    ).bind(
      body.title, body.subject || '', body.content || '', body.target_audience || 'tous',
      JSON.stringify(body.attachments || []), body.internal_notes || '', id
    ).run();

    await logActivity(db, user.id, 'Modification du communiqué', 'communique', id, before, body);
    return sendJson(res, { ok: true });
  }

  if (req.method === 'PATCH') {
    const before = await getCommunique(id);
    if (!before) return sendError(res, 'Communiqué introuvable', 404);

    const body = req.body || {};
    const target = body.status;
    if (!target || !(target in STATUS_PERMISSION)) return sendError(res, 'Statut invalide', 422);
    if (!hasPermission(user, 'communiques', STATUS_PERMISSION[target])) return sendError(res, 'Accès refusé', 403);

    const publishedAt = target === 'publie' ? new Date().toISOString() : before.published_at;
    await db.prepare(
      `UPDATE communiques SET status=?, published_at=?, updated_at=${NOW_EXPR} WHERE id=?`
    ).bind(target, publishedAt, id).run();

    await logActivity(db, user.id, `Changement de statut du communiqué (${before.status} -> ${target})`, 'communique', id, { status: before.status }, { status: target });
    return sendJson(res, { ok: true });
  }

  if (req.method === 'DELETE') {
    if (!hasPermission(user, 'communiques', 'delete')) return sendError(res, 'Accès refusé', 403);
    const before = await getCommunique(id);
    if (!before) return sendError(res, 'Communiqué introuvable', 404);

    await db.prepare('DELETE FROM communiques WHERE id=?').bind(id).run();
    await logActivity(db, user.id, 'Suppression du communiqué', 'communique', id, before, null);
    return sendJson(res, { ok: true });
  }

  res.setHeader('Allow', 'GET, PUT, PATCH, DELETE');
  return sendError(res, 'Méthode non autorisée', 405);
}
