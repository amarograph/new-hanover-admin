import { db, NOW_EXPR } from '../../lib/db.js';
import { getSessionUser, hasPermission } from '../../lib/auth.js';
import { nextNumber } from '../../lib/numbering.js';
import { logActivity } from '../../lib/log.js';
import { sendJson, sendError } from '../../lib/respond.js';

const SELECT = `SELECT e.*, au.discord_username as author_name
  FROM entreprises e
  LEFT JOIN users au ON au.id = e.author_id`;

const STATUSES = ['active', 'en_attente_autorisation', 'suspendue', 'fermee', 'archivee'];

async function getEntreprise(id) {
  return db.prepare(SELECT + ' WHERE e.id = ?').bind(id).first();
}

async function list(req, res, user) {
  if (!hasPermission(user, 'entreprises', 'view')) return sendError(res, 'Accès refusé', 403);

  const { status, q } = req.query;
  let query = SELECT + ' WHERE 1=1';
  const binds = [];
  if (status) { query += ' AND e.status = ?'; binds.push(status); }
  if (q) {
    query += ' AND (e.name LIKE ? OR e.number LIKE ? OR e.activity LIKE ? OR e.owner_last_name LIKE ? OR e.co_owner_last_name LIKE ?)';
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  query += ' ORDER BY e.created_at DESC';

  const { results } = await db.prepare(query).bind(...binds).all();
  return sendJson(res, { entreprises: results });
}

function readBody(body) {
  return {
    name: body.name,
    activity: body.activity || '',
    address: body.address || '',
    license: body.license || '',
    owner_first_name: body.owner_first_name || '',
    owner_last_name: body.owner_last_name || '',
    co_owner_first_name: body.co_owner_first_name || '',
    co_owner_last_name: body.co_owner_last_name || '',
    account_number: body.account_number || '',
    balance: body.balance !== undefined && body.balance !== '' ? Number(body.balance) : 0,
    notes: body.notes || '',
  };
}

async function create(req, res, user) {
  if (!hasPermission(user, 'entreprises', 'add')) return sendError(res, 'Accès refusé', 403);

  const body = req.body || {};
  if (!body.name) return sendError(res, 'Le nom de l\'entreprise est requis', 422);
  const f = readBody(body);

  const number = await nextNumber(db, 'ENT-NH');
  const result = await db.prepare(
    `INSERT INTO entreprises (number, name, activity, address, license, status, owner_first_name, owner_last_name, co_owner_first_name, co_owner_last_name, account_number, balance, notes, author_id)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(
    number, f.name, f.activity, f.address, f.license,
    f.owner_first_name, f.owner_last_name, f.co_owner_first_name, f.co_owner_last_name,
    f.account_number, f.balance, f.notes, user.id
  ).run();

  const id = result.meta.last_row_id;
  await logActivity(db, user.id, 'Création de l\'entreprise', 'entreprise', id, null, { number, name: f.name });
  return sendJson(res, { id, number }, 201);
}

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
    if (!hasPermission(user, 'entreprises', 'view')) return sendError(res, 'Accès refusé', 403);
    const entreprise = await getEntreprise(id);
    if (!entreprise) return sendError(res, 'Entreprise introuvable', 404);
    return sendJson(res, { entreprise });
  }

  if (req.method === 'PUT') {
    if (!hasPermission(user, 'entreprises', 'edit')) return sendError(res, 'Accès refusé', 403);
    const before = await getEntreprise(id);
    if (!before) return sendError(res, 'Entreprise introuvable', 404);

    const body = req.body || {};
    if (!body.name) return sendError(res, 'Le nom de l\'entreprise est requis', 422);
    const f = readBody(body);

    await db.prepare(
      `UPDATE entreprises SET name=?, activity=?, address=?, license=?, owner_first_name=?, owner_last_name=?, co_owner_first_name=?, co_owner_last_name=?, account_number=?, balance=?, notes=?, updated_at=${NOW_EXPR} WHERE id=?`
    ).bind(
      f.name, f.activity, f.address, f.license,
      f.owner_first_name, f.owner_last_name, f.co_owner_first_name, f.co_owner_last_name,
      f.account_number, f.balance, f.notes, id
    ).run();

    await logActivity(db, user.id, 'Modification de l\'entreprise', 'entreprise', id, before, body);
    return sendJson(res, { ok: true });
  }

  if (req.method === 'PATCH') {
    if (!hasPermission(user, 'entreprises', 'edit')) return sendError(res, 'Accès refusé', 403);
    const before = await getEntreprise(id);
    if (!before) return sendError(res, 'Entreprise introuvable', 404);

    const body = req.body || {};
    if (!body.status || !STATUSES.includes(body.status)) return sendError(res, 'Statut invalide', 422);

    await db.prepare(`UPDATE entreprises SET status=?, updated_at=${NOW_EXPR} WHERE id=?`).bind(body.status, id).run();
    await logActivity(db, user.id, `Changement de statut de l'entreprise (${before.status} -> ${body.status})`, 'entreprise', id, { status: before.status }, { status: body.status });
    return sendJson(res, { ok: true });
  }

  if (req.method === 'DELETE') {
    if (!hasPermission(user, 'entreprises', 'delete')) return sendError(res, 'Accès refusé', 403);
    const before = await getEntreprise(id);
    if (!before) return sendError(res, 'Entreprise introuvable', 404);

    await db.prepare('DELETE FROM entreprises WHERE id=?').bind(id).run();
    await logActivity(db, user.id, 'Suppression de l\'entreprise', 'entreprise', id, before, null);
    return sendJson(res, { ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PUT, PATCH, DELETE');
  return sendError(res, 'Méthode non autorisée', 405);
}
