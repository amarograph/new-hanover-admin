import { db, NOW_EXPR } from '../../lib/db.js';
import { getSessionUser, hasPermission } from '../../lib/auth.js';
import { nextNumber } from '../../lib/numbering.js';
import { logActivity } from '../../lib/log.js';
import { sendJson, sendError } from '../../lib/respond.js';

const SELECT = `SELECT c.*, au.discord_username as author_name
  FROM communiques c
  LEFT JOIN users au ON au.id = c.author_id`;

// La liste omet la colonne image (potentiellement volumineuse en base64)
// pour ne pas alourdir la réponse ; seule la fiche détail la renvoie.
const SELECT_LIST = SELECT.replace('c.*', `c.id, c.number, c.title, c.subject, c.author_id, c.created_at,
    c.published_at, c.target_audience, c.status, c.updated_at`);

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function validateImage(image) {
  if (image === undefined || image === null || image === '') return null;
  if (typeof image !== 'string' || !/^data:image\/(png|jpeg|jpg|gif|webp);base64,/.test(image)) {
    throw new Error('Format d\'image invalide.');
  }
  if (image.length > MAX_IMAGE_BYTES * 1.4) {
    throw new Error('Image trop volumineuse (2 Mo maximum).');
  }
  return image;
}

async function getCommunique(id) {
  return db.prepare(SELECT + ' WHERE c.id = ?').bind(id).first();
}

async function list(req, res, user) {
  if (!hasPermission(user, 'communiques', 'view')) return sendError(res, 'Accès refusé', 403);

  const { status, q } = req.query;
  let query = SELECT_LIST + ' WHERE 1=1';
  const binds = [];
  if (status) { query += ' AND c.status = ?'; binds.push(status); }
  if (q) { query += ' AND (c.title LIKE ? OR c.number LIKE ?)'; binds.push(`%${q}%`, `%${q}%`); }
  query += ' ORDER BY c.created_at DESC';

  const { results } = await db.prepare(query).bind(...binds).all();
  return sendJson(res, { communiques: results });
}

async function create(req, res, user) {
  if (!hasPermission(user, 'communiques', 'add')) return sendError(res, 'Accès refusé', 403);

  const body = req.body || {};
  if (!body.title) return sendError(res, 'Le titre est requis', 422);

  let image;
  try { image = validateImage(body.image); } catch (e) { return sendError(res, e.message, 422); }

  const number = await nextNumber(db, 'COM-NH', '1892');
  const status = body.status || 'a_faire';
  const result = await db.prepare(
    `INSERT INTO communiques (number, title, subject, content, author_id, target_audience, attachments, status, internal_notes, image)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(
    number, body.title, body.subject || '', body.content || '', user.id,
    body.target_audience || 'tous', JSON.stringify(body.attachments || []),
    status, body.internal_notes || '', image
  ).run();

  const id = result.meta.last_row_id;
  await logActivity(db, user.id, 'Création du communiqué', 'communique', id, null, { number, title: body.title });
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

    let image;
    try { image = validateImage(body.image); } catch (e) { return sendError(res, e.message, 422); }
    if (body.image === undefined) image = before.image;

    await db.prepare(
      `UPDATE communiques SET title=?, subject=?, content=?, target_audience=?, attachments=?, internal_notes=?, image=?, updated_at=${NOW_EXPR} WHERE id=?`
    ).bind(
      body.title, body.subject || '', body.content || '', body.target_audience || 'tous',
      JSON.stringify(body.attachments || []), body.internal_notes || '', image, id
    ).run();

    // On exclut l'image (base64) du journal d'activité pour ne pas l'alourdir inutilement.
    const { image: beforeImage, ...beforeLog } = before;
    const { image: bodyImage, ...bodyLog } = body;
    await logActivity(db, user.id, 'Modification du communiqué', 'communique', id, beforeLog, bodyLog);
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
    const { image: deletedImage, ...beforeLog } = before;
    await logActivity(db, user.id, 'Suppression du communiqué', 'communique', id, beforeLog, null);
    return sendJson(res, { ok: true });
  }

  res.setHeader('Allow', 'GET, PUT, PATCH, DELETE');
  return sendError(res, 'Méthode non autorisée', 405);
}
