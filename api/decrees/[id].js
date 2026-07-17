import { db, NOW_EXPR } from '../../lib/db.js';
import { getSessionUser, hasPermission } from '../../lib/auth.js';
import { logActivity } from '../../lib/log.js';
import { sendJson, sendError } from '../../lib/respond.js';

const SELECT = `SELECT d.*, au.discord_username as author_name, vu.discord_username as validator_name
  FROM decrees d
  LEFT JOIN users au ON au.id = d.author_id
  LEFT JOIN users vu ON vu.id = d.validated_by_id
  WHERE d.id = ?`;

async function getDecree(id) {
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
    if (!hasPermission(user, 'decrees', 'view')) return sendError(res, 'Accès refusé', 403);
    const decree = await getDecree(id);
    if (!decree) return sendError(res, 'Décret introuvable', 404);
    return sendJson(res, { decree });
  }

  if (req.method === 'PUT') {
    if (!hasPermission(user, 'decrees', 'edit')) return sendError(res, 'Accès refusé', 403);
    const before = await getDecree(id);
    if (!before) return sendError(res, 'Décret introuvable', 404);

    const body = req.body || {};
    if (!body.title) return sendError(res, 'Le titre est requis', 422);

    await db.prepare(
      `UPDATE decrees SET title=?, content=?, effective_date=?, attachments=?, confidentiality=?, internal_notes=?, updated_at=${NOW_EXPR} WHERE id=?`
    ).bind(
      body.title, body.content || '', body.effective_date || null,
      JSON.stringify(body.attachments || []), body.confidentiality || 'interne',
      body.internal_notes || '', id
    ).run();

    await logActivity(db, user.id, 'Modification du décret', 'decree', id, before, body);
    return sendJson(res, { ok: true });
  }

  if (req.method === 'PATCH') {
    const before = await getDecree(id);
    if (!before) return sendError(res, 'Décret introuvable', 404);

    const body = req.body || {};
    const target = body.status;
    if (!target || !(target in STATUS_PERMISSION)) return sendError(res, 'Statut invalide', 422);
    if (!hasPermission(user, 'decrees', STATUS_PERMISSION[target])) return sendError(res, 'Accès refusé', 403);

    const validatedBy = (target === 'a_publier' || target === 'publie') ? user.id : before.validated_by_id;
    await db.prepare(
      `UPDATE decrees SET status=?, category=?, validated_by_id=?, updated_at=${NOW_EXPR} WHERE id=?`
    ).bind(target, target, validatedBy, id).run();

    await logActivity(db, user.id, `Changement de statut du décret (${before.status} -> ${target})`, 'decree', id, { status: before.status }, { status: target });
    return sendJson(res, { ok: true });
  }

  if (req.method === 'DELETE') {
    if (!hasPermission(user, 'decrees', 'delete')) return sendError(res, 'Accès refusé', 403);
    const before = await getDecree(id);
    if (!before) return sendError(res, 'Décret introuvable', 404);

    await db.prepare('DELETE FROM decrees WHERE id=?').bind(id).run();
    await logActivity(db, user.id, 'Suppression du décret', 'decree', id, before, null);
    return sendJson(res, { ok: true });
  }

  res.setHeader('Allow', 'GET, PUT, PATCH, DELETE');
  return sendError(res, 'Méthode non autorisée', 405);
}
