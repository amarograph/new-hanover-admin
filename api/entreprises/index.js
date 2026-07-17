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

async function listEntreprises(req, res, user) {
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

function readEntrepriseBody(body) {
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

async function createEntreprise(req, res, user) {
  if (!hasPermission(user, 'entreprises', 'add')) return sendError(res, 'Accès refusé', 403);

  const body = req.body || {};
  if (!body.name) return sendError(res, 'Le nom de l\'entreprise est requis', 422);
  const f = readEntrepriseBody(body);

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

async function handleEntreprises(req, res, user, slug) {
  if (slug.length === 0) {
    if (req.method === 'GET') return listEntreprises(req, res, user);
    if (req.method === 'POST') return createEntreprise(req, res, user);
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
    const f = readEntrepriseBody(body);

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

// ---------------------------------------------------------------------------
// Employés : partage cette même fonction serverless (limite de 12 sur le
// plan Hobby déjà atteinte) via le paramètre ?resource=employes du rewrite.
// ---------------------------------------------------------------------------

const EMP_SELECT = `SELECT p.*, au.discord_username as author_name
  FROM employes p
  LEFT JOIN users au ON au.id = p.author_id`;

async function getEmploye(id) {
  return db.prepare(EMP_SELECT + ' WHERE p.id = ?').bind(id).first();
}

async function listEmployes(req, res, user) {
  if (!hasPermission(user, 'employes', 'view')) return sendError(res, 'Accès refusé', 403);

  const { q } = req.query;
  let query = EMP_SELECT + ' WHERE 1=1';
  const binds = [];
  if (q) {
    query += ' AND (p.first_name LIKE ? OR p.last_name LIKE ? OR p.number LIKE ? OR p.job_title LIKE ?)';
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  query += ' ORDER BY p.last_name ASC, p.first_name ASC';

  const { results } = await db.prepare(query).bind(...binds).all();
  return sendJson(res, { employes: results });
}

function readEmployeBody(body) {
  return {
    first_name: body.first_name,
    last_name: body.last_name,
    birth_date: body.birth_date || null,
    residence: body.residence || '',
    account_number: body.account_number || '',
    job_title: body.job_title || '',
  };
}

async function createEmploye(req, res, user) {
  if (!hasPermission(user, 'employes', 'add')) return sendError(res, 'Accès refusé', 403);

  const body = req.body || {};
  if (!body.first_name || !body.last_name) return sendError(res, 'Le nom et le prénom sont requis', 422);
  const f = readEmployeBody(body);

  const number = await nextNumber(db, 'EMP-NH');
  const result = await db.prepare(
    `INSERT INTO employes (number, first_name, last_name, birth_date, residence, account_number, job_title, author_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(number, f.first_name, f.last_name, f.birth_date, f.residence, f.account_number, f.job_title, user.id).run();

  const id = result.meta.last_row_id;
  await logActivity(db, user.id, 'Création de la fiche employé', 'employe', id, null, { number, first_name: f.first_name, last_name: f.last_name });
  return sendJson(res, { id, number }, 201);
}

async function handleEmployes(req, res, user, slug) {
  if (slug.length === 0) {
    if (req.method === 'GET') return listEmployes(req, res, user);
    if (req.method === 'POST') return createEmploye(req, res, user);
    res.setHeader('Allow', 'GET, POST');
    return sendError(res, 'Méthode non autorisée', 405);
  }

  const id = slug[0];

  if (req.method === 'GET') {
    if (!hasPermission(user, 'employes', 'view')) return sendError(res, 'Accès refusé', 403);
    const employe = await getEmploye(id);
    if (!employe) return sendError(res, 'Employé introuvable', 404);
    return sendJson(res, { employe });
  }

  if (req.method === 'PUT') {
    if (!hasPermission(user, 'employes', 'edit')) return sendError(res, 'Accès refusé', 403);
    const before = await getEmploye(id);
    if (!before) return sendError(res, 'Employé introuvable', 404);

    const body = req.body || {};
    if (!body.first_name || !body.last_name) return sendError(res, 'Le nom et le prénom sont requis', 422);
    const f = readEmployeBody(body);

    await db.prepare(
      `UPDATE employes SET first_name=?, last_name=?, birth_date=?, residence=?, account_number=?, job_title=?, updated_at=${NOW_EXPR} WHERE id=?`
    ).bind(f.first_name, f.last_name, f.birth_date, f.residence, f.account_number, f.job_title, id).run();

    await logActivity(db, user.id, 'Modification de la fiche employé', 'employe', id, before, body);
    return sendJson(res, { ok: true });
  }

  if (req.method === 'DELETE') {
    if (!hasPermission(user, 'employes', 'delete')) return sendError(res, 'Accès refusé', 403);
    const before = await getEmploye(id);
    if (!before) return sendError(res, 'Employé introuvable', 404);

    await db.prepare('DELETE FROM employes WHERE id=?').bind(id).run();
    await logActivity(db, user.id, 'Suppression de la fiche employé', 'employe', id, before, null);
    return sendJson(res, { ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PUT, DELETE');
  return sendError(res, 'Méthode non autorisée', 405);
}

// ---------------------------------------------------------------------------
// Tâches : simple to-do list partagée, même principe que ci-dessus
// (?resource=taches) pour ne pas dépasser la limite de fonctions Hobby.
// ---------------------------------------------------------------------------

async function listTaches(req, res, user) {
  if (!hasPermission(user, 'taches', 'view')) return sendError(res, 'Accès refusé', 403);
  const { results } = await db.prepare(
    `SELECT t.*, au.discord_username as author_name FROM taches t
     LEFT JOIN users au ON au.id = t.author_id
     ORDER BY t.done ASC, t.created_at ASC`
  ).all();
  return sendJson(res, { taches: results });
}

async function createTache(req, res, user) {
  if (!hasPermission(user, 'taches', 'add')) return sendError(res, 'Accès refusé', 403);
  const body = req.body || {};
  if (!body.text || !body.text.trim()) return sendError(res, 'Le texte de la tâche est requis', 422);

  const result = await db.prepare(
    'INSERT INTO taches (text, author_id) VALUES (?, ?) RETURNING id'
  ).bind(body.text.trim(), user.id).run();
  return sendJson(res, { id: result.meta.last_row_id }, 201);
}

async function handleTaches(req, res, user, slug) {
  if (slug.length === 0) {
    if (req.method === 'GET') return listTaches(req, res, user);
    if (req.method === 'POST') return createTache(req, res, user);
    res.setHeader('Allow', 'GET, POST');
    return sendError(res, 'Méthode non autorisée', 405);
  }

  const id = slug[0];

  if (req.method === 'PATCH') {
    if (!hasPermission(user, 'taches', 'edit')) return sendError(res, 'Accès refusé', 403);
    const before = await db.prepare('SELECT * FROM taches WHERE id=?').bind(id).first();
    if (!before) return sendError(res, 'Tâche introuvable', 404);

    const body = req.body || {};
    await db.prepare(`UPDATE taches SET done=?, updated_at=${NOW_EXPR} WHERE id=?`).bind(body.done ? 1 : 0, id).run();
    return sendJson(res, { ok: true });
  }

  if (req.method === 'DELETE') {
    if (!hasPermission(user, 'taches', 'delete')) return sendError(res, 'Accès refusé', 403);
    const before = await db.prepare('SELECT * FROM taches WHERE id=?').bind(id).first();
    if (!before) return sendError(res, 'Tâche introuvable', 404);

    await db.prepare('DELETE FROM taches WHERE id=?').bind(id).run();
    return sendJson(res, { ok: true });
  }

  res.setHeader('Allow', 'PATCH, DELETE');
  return sendError(res, 'Méthode non autorisée', 405);
}

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  const slug = Array.isArray(req.query.slug) ? req.query.slug : (req.query.slug ? [req.query.slug] : []);

  if (req.query.resource === 'employes') return handleEmployes(req, res, user, slug);
  if (req.query.resource === 'taches') return handleTaches(req, res, user, slug);
  return handleEntreprises(req, res, user, slug);
}
