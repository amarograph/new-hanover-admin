import { db, NOW_EXPR } from '../../lib/db.js';
import { getSessionUser, hasPermission } from '../../lib/auth.js';
import { nextNumber } from '../../lib/numbering.js';
import { logActivity } from '../../lib/log.js';
import { sendJson, sendError } from '../../lib/respond.js';

const SELECT = `SELECT d.*, au.discord_username as author_name, vu.discord_username as validator_name
  FROM decrees d
  LEFT JOIN users au ON au.id = d.author_id
  LEFT JOIN users vu ON vu.id = d.validated_by_id`;

async function getDecree(id) {
  return db.prepare(SELECT + ' WHERE d.id = ?').bind(id).first();
}

async function list(req, res, user) {
  if (!hasPermission(user, 'decrees', 'view')) return sendError(res, 'Accès refusé', 403);

  const { category, author, q } = req.query;
  let query = SELECT + ' WHERE 1=1';
  const binds = [];
  if (category) { query += ' AND d.category = ?'; binds.push(category); }
  if (author) { query += ' AND d.author_id = ?'; binds.push(author); }
  if (q) { query += ' AND (d.title LIKE ? OR d.number LIKE ?)'; binds.push(`%${q}%`, `%${q}%`); }
  query += ' ORDER BY d.created_at DESC';

  const { results } = await db.prepare(query).bind(...binds).all();
  return sendJson(res, { decrees: results });
}

async function create(req, res, user) {
  if (!hasPermission(user, 'decrees', 'add')) return sendError(res, 'Accès refusé', 403);

  const body = req.body || {};
  if (!body.title) return sendError(res, 'Le titre est requis', 422);

  const number = await nextNumber(db, 'DEC-NH', '1892');
  const category = body.category || 'a_faire';
  const result = await db.prepare(
    `INSERT INTO decrees (number, title, category, status, effective_date, author_id, content, attachments, confidentiality, internal_notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(
    number, body.title, category, category, body.effective_date || null, user.id,
    body.content || '', JSON.stringify(body.attachments || []),
    body.confidentiality || 'interne', body.internal_notes || ''
  ).run();

  const id = result.meta.last_row_id;
  await logActivity(db, user.id, 'Création du décret', 'decree', id, null, { number, title: body.title });
  return sendJson(res, { id, number }, 201);
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
  const slug = Array.isArray(req.query.slug) ? req.query.slug : (req.query.slug ? [req.query.slug] : []);

  if (slug.length === 0) {
    if (req.method === 'GET') return list(req, res, user);
    if (req.method === 'POST') return create(req, res, user);
    res.setHeader('Allow', 'GET, POST');
    return sendError(res, 'Méthode non autorisée', 405);
  }

  const id = slug[0];

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
