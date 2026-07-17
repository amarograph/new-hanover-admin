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

// ---------------------------------------------------------------------------
// Courriers : lettres à envoyer, qui basculent vers "envoyées" une fois
// expédiées, pour en garder le suivi (?resource=courriers).
// ---------------------------------------------------------------------------

const COURRIER_SELECT = `SELECT c.*, au.discord_username as author_name,
    au.character_first_name as author_first_name, au.character_last_name as author_last_name, au.grade as author_grade
  FROM courriers c
  LEFT JOIN users au ON au.id = c.author_id`;

async function getCourrier(id) {
  return db.prepare(COURRIER_SELECT + ' WHERE c.id = ?').bind(id).first();
}

async function listCourriers(req, res, user) {
  if (!hasPermission(user, 'courriers', 'view')) return sendError(res, 'Accès refusé', 403);

  const { status, q } = req.query;
  let query = COURRIER_SELECT + ' WHERE 1=1';
  const binds = [];
  if (status) { query += ' AND c.status = ?'; binds.push(status); }
  if (q) { query += ' AND (c.subject LIKE ? OR c.recipient LIKE ? OR c.number LIKE ?)'; binds.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  query += ' ORDER BY c.created_at DESC';

  const { results } = await db.prepare(query).bind(...binds).all();
  return sendJson(res, { courriers: results });
}

async function createCourrier(req, res, user) {
  if (!hasPermission(user, 'courriers', 'add')) return sendError(res, 'Accès refusé', 403);

  const body = req.body || {};
  if (!body.subject) return sendError(res, 'Le sujet est requis', 422);

  const number = await nextNumber(db, 'CE-NH', '1892');
  const result = await db.prepare(
    `INSERT INTO courriers (number, recipient, subject, content, author_id)
     VALUES (?, ?, ?, ?, ?) RETURNING id`
  ).bind(number, body.recipient || '', body.subject, body.content || '', user.id).run();

  const id = result.meta.last_row_id;
  await logActivity(db, user.id, 'Création du courrier', 'courrier', id, null, { number, subject: body.subject });
  return sendJson(res, { id, number }, 201);
}

async function handleCourriers(req, res, user, slug) {
  if (slug.length === 0) {
    if (req.method === 'GET') return listCourriers(req, res, user);
    if (req.method === 'POST') return createCourrier(req, res, user);
    res.setHeader('Allow', 'GET, POST');
    return sendError(res, 'Méthode non autorisée', 405);
  }

  const id = slug[0];

  if (req.method === 'GET') {
    if (!hasPermission(user, 'courriers', 'view')) return sendError(res, 'Accès refusé', 403);
    const courrier = await getCourrier(id);
    if (!courrier) return sendError(res, 'Courrier introuvable', 404);
    return sendJson(res, { courrier });
  }

  if (req.method === 'PUT') {
    if (!hasPermission(user, 'courriers', 'edit')) return sendError(res, 'Accès refusé', 403);
    const before = await getCourrier(id);
    if (!before) return sendError(res, 'Courrier introuvable', 404);
    if (before.status === 'envoye') return sendError(res, 'Un courrier déjà envoyé ne peut plus être modifié', 409);

    const body = req.body || {};
    if (!body.subject) return sendError(res, 'Le sujet est requis', 422);

    await db.prepare(
      `UPDATE courriers SET recipient=?, subject=?, content=?, updated_at=${NOW_EXPR} WHERE id=?`
    ).bind(body.recipient || '', body.subject, body.content || '', id).run();

    await logActivity(db, user.id, 'Modification du courrier', 'courrier', id, before, body);
    return sendJson(res, { ok: true });
  }

  if (req.method === 'PATCH') {
    if (!hasPermission(user, 'courriers', 'edit')) return sendError(res, 'Accès refusé', 403);
    const before = await getCourrier(id);
    if (!before) return sendError(res, 'Courrier introuvable', 404);
    if (before.status === 'envoye') return sendError(res, 'Ce courrier a déjà été envoyé', 409);

    await db.prepare(
      `UPDATE courriers SET status='envoye', sent_at=${NOW_EXPR}, updated_at=${NOW_EXPR} WHERE id=?`
    ).bind(id).run();

    await logActivity(db, user.id, 'Courrier marqué comme envoyé', 'courrier', id, { status: before.status }, { status: 'envoye' });
    return sendJson(res, { ok: true });
  }

  if (req.method === 'DELETE') {
    if (!hasPermission(user, 'courriers', 'delete')) return sendError(res, 'Accès refusé', 403);
    const before = await getCourrier(id);
    if (!before) return sendError(res, 'Courrier introuvable', 404);

    await db.prepare('DELETE FROM courriers WHERE id=?').bind(id).run();
    await logActivity(db, user.id, 'Suppression du courrier', 'courrier', id, before, null);
    return sendJson(res, { ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PUT, PATCH, DELETE');
  return sendError(res, 'Méthode non autorisée', 405);
}

// ---------------------------------------------------------------------------
// Boîte aux lettres : dépôt d'images de courriers reçus, avec statut et
// assignation d'une personne devant répondre (?resource=boite_lettres).
// ---------------------------------------------------------------------------

const BL_SELECT = `SELECT b.*, au.discord_username as author_name,
    asu.character_first_name as assigned_first_name, asu.character_last_name as assigned_last_name
  FROM boite_lettres b
  LEFT JOIN users au ON au.id = b.author_id
  LEFT JOIN users asu ON asu.id = b.assigned_user_id`;

// La liste omet l'image (potentiellement volumineuse en base64) pour ne pas
// alourdir la réponse ; seule la fiche détail la renvoie.
const BL_SELECT_LIST = BL_SELECT.replace('b.*', `b.id, b.description, b.status, b.assigned_user_id, b.author_id, b.created_at, b.updated_at`);

const BL_STATUSES = ['a_repondre', 'doit_repondre', 'repondu'];
const MAX_BL_IMAGE_BYTES = 2 * 1024 * 1024;

function validateBLImage(image) {
  if (image === undefined || image === null || image === '') return null;
  if (typeof image !== 'string' || !/^data:image\/(png|jpeg|jpg|gif|webp);base64,/.test(image)) {
    throw new Error('Format d\'image invalide.');
  }
  if (image.length > MAX_BL_IMAGE_BYTES * 1.4) {
    throw new Error('Image trop volumineuse (2 Mo maximum).');
  }
  return image;
}

async function getBoiteLettre(id) {
  return db.prepare(BL_SELECT + ' WHERE b.id = ?').bind(id).first();
}

async function listBoiteLettres(req, res, user) {
  // Utilisé par la notification globale (nav.js) : toute personne connectée
  // peut vérifier si elle est elle-même citée, même sans permission "view".
  if (req.query.my_pending === '1') {
    if (!user) return sendError(res, 'Non authentifié', 401);
    const { results } = await db.prepare(
      "SELECT id FROM boite_lettres WHERE assigned_user_id = ? AND status = 'doit_repondre'"
    ).bind(user.id).all();
    return sendJson(res, { boite_lettres: results });
  }

  // Liste des personnes assignables, pour le menu déroulant "Doit répondre".
  if (req.query.assignable_users === '1') {
    if (!hasPermission(user, 'boite_lettres', 'edit')) return sendError(res, 'Accès refusé', 403);
    const { results } = await db.prepare(
      "SELECT id, character_first_name, character_last_name, discord_username FROM users WHERE status='accepted' ORDER BY character_last_name ASC, character_first_name ASC"
    ).all();
    return sendJson(res, { users: results });
  }

  if (!hasPermission(user, 'boite_lettres', 'view')) return sendError(res, 'Accès refusé', 403);

  const { status, q } = req.query;
  let query = BL_SELECT_LIST + ' WHERE 1=1';
  const binds = [];
  if (status) { query += ' AND b.status = ?'; binds.push(status); }
  if (q) { query += ' AND b.description LIKE ?'; binds.push(`%${q}%`); }
  query += ' ORDER BY b.created_at DESC';

  const { results } = await db.prepare(query).bind(...binds).all();
  return sendJson(res, { boite_lettres: results });
}

async function createBoiteLettre(req, res, user) {
  if (!hasPermission(user, 'boite_lettres', 'add')) return sendError(res, 'Accès refusé', 403);

  const body = req.body || {};
  let image;
  try { image = validateBLImage(body.image); } catch (e) { return sendError(res, e.message, 422); }

  const result = await db.prepare(
    `INSERT INTO boite_lettres (description, image, author_id) VALUES (?, ?, ?) RETURNING id`
  ).bind(body.description || '', image, user.id).run();

  const id = result.meta.last_row_id;
  await logActivity(db, user.id, 'Dépôt d\'un courrier en boîte aux lettres', 'boite_lettre', id, null, null);
  return sendJson(res, { id }, 201);
}

async function handleBoiteLettres(req, res, user, slug) {
  if (slug.length === 0) {
    if (req.method === 'GET') return listBoiteLettres(req, res, user);
    if (req.method === 'POST') return createBoiteLettre(req, res, user);
    res.setHeader('Allow', 'GET, POST');
    return sendError(res, 'Méthode non autorisée', 405);
  }

  const id = slug[0];

  if (req.method === 'GET') {
    if (!hasPermission(user, 'boite_lettres', 'view')) return sendError(res, 'Accès refusé', 403);
    const item = await getBoiteLettre(id);
    if (!item) return sendError(res, 'Courrier introuvable', 404);
    return sendJson(res, { boite_lettre: item });
  }

  if (req.method === 'PUT') {
    if (!hasPermission(user, 'boite_lettres', 'edit')) return sendError(res, 'Accès refusé', 403);
    const before = await getBoiteLettre(id);
    if (!before) return sendError(res, 'Courrier introuvable', 404);

    const body = req.body || {};
    let image;
    try { image = validateBLImage(body.image); } catch (e) { return sendError(res, e.message, 422); }
    if (body.image === undefined) image = before.image;

    await db.prepare(
      `UPDATE boite_lettres SET description=?, image=?, updated_at=${NOW_EXPR} WHERE id=?`
    ).bind(body.description || '', image, id).run();
    return sendJson(res, { ok: true });
  }

  if (req.method === 'PATCH') {
    if (!hasPermission(user, 'boite_lettres', 'edit')) return sendError(res, 'Accès refusé', 403);
    const before = await getBoiteLettre(id);
    if (!before) return sendError(res, 'Courrier introuvable', 404);

    const body = req.body || {};
    if (!body.status || !BL_STATUSES.includes(body.status)) return sendError(res, 'Statut invalide', 422);

    let assignedUserId = null;
    if (body.status === 'doit_repondre') {
      if (!body.assigned_user_id) return sendError(res, 'Une personne doit être désignée', 422);
      const exists = await db.prepare('SELECT id FROM users WHERE id = ?').bind(body.assigned_user_id).first();
      if (!exists) return sendError(res, 'Utilisateur introuvable', 422);
      assignedUserId = body.assigned_user_id;
    }

    await db.prepare(
      `UPDATE boite_lettres SET status=?, assigned_user_id=?, updated_at=${NOW_EXPR} WHERE id=?`
    ).bind(body.status, assignedUserId, id).run();

    await logActivity(db, user.id, `Changement de statut du courrier de la boîte aux lettres (${before.status} -> ${body.status})`, 'boite_lettre', id, { status: before.status }, { status: body.status });
    return sendJson(res, { ok: true });
  }

  if (req.method === 'DELETE') {
    if (!hasPermission(user, 'boite_lettres', 'delete')) return sendError(res, 'Accès refusé', 403);
    const before = await getBoiteLettre(id);
    if (!before) return sendError(res, 'Courrier introuvable', 404);

    await db.prepare('DELETE FROM boite_lettres WHERE id=?').bind(id).run();
    const { image: deletedImage, ...beforeLog } = before;
    await logActivity(db, user.id, 'Suppression du courrier de la boîte aux lettres', 'boite_lettre', id, beforeLog, null);
    return sendJson(res, { ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PUT, PATCH, DELETE');
  return sendError(res, 'Méthode non autorisée', 405);
}

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  const slug = Array.isArray(req.query.slug) ? req.query.slug : (req.query.slug ? [req.query.slug] : []);

  if (req.query.resource === 'employes') return handleEmployes(req, res, user, slug);
  if (req.query.resource === 'taches') return handleTaches(req, res, user, slug);
  if (req.query.resource === 'courriers') return handleCourriers(req, res, user, slug);
  if (req.query.resource === 'boite_lettres') return handleBoiteLettres(req, res, user, slug);
  return handleEntreprises(req, res, user, slug);
}
