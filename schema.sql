-- Administration de New Hanover -- schéma Postgres (Vercel Postgres / Neon)
-- Confidentialité : seuls discord_id et discord_username sont conservés
-- au sujet du compte Discord de l'utilisateur (aucun avatar, email, etc.)
--
-- Les colonnes de date/heure sont volontairement en TEXT (format
-- "YYYY-MM-DD" ou "YYYY-MM-DD HH:MM:SS", comme SQLite) pour rester
-- identiques à ce qu'attend le frontend, sans logique de fuseau horaire.

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions TEXT NOT NULL DEFAULT '{}',
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  discord_id TEXT NOT NULL UNIQUE,
  discord_username TEXT NOT NULL,
  character_first_name TEXT,
  character_last_name TEXT,
  job_title TEXT,
  grade TEXT,
  arrival_date TEXT,
  last_login TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  role_id INTEGER REFERENCES roles(id),
  created_at TEXT NOT NULL DEFAULT to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  updated_at TEXT NOT NULL DEFAULT to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS counters (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS decrees (
  id SERIAL PRIMARY KEY,
  number TEXT UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'a_faire',
  status TEXT NOT NULL DEFAULT 'a_faire',
  created_at TEXT NOT NULL DEFAULT to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  effective_date TEXT,
  author_id INTEGER REFERENCES users(id),
  validated_by_id INTEGER REFERENCES users(id),
  content TEXT,
  attachments TEXT DEFAULT '[]',
  confidentiality TEXT NOT NULL DEFAULT 'interne',
  internal_notes TEXT,
  image TEXT,
  updated_at TEXT NOT NULL DEFAULT to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS communiques (
  id SERIAL PRIMARY KEY,
  number TEXT UNIQUE,
  title TEXT NOT NULL,
  subject TEXT,
  content TEXT,
  author_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  published_at TEXT,
  target_audience TEXT NOT NULL DEFAULT 'tous',
  attachments TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'a_faire',
  internal_notes TEXT,
  updated_at TEXT NOT NULL DEFAULT to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS agenda_events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'rendez_vous',
  date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  organizer_id INTEGER REFERENCES users(id),
  participants TEXT DEFAULT '[]',
  priority TEXT NOT NULL DEFAULT 'normale',
  reminder INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'prevu',
  created_at TEXT NOT NULL DEFAULT to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  updated_at TEXT NOT NULL DEFAULT to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  number TEXT UNIQUE,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  category TEXT,
  reason TEXT,
  person_concerned TEXT,
  business_concerned TEXT,
  payment_method TEXT,
  author_id INTEGER REFERENCES users(id),
  receipt TEXT,
  validation_status TEXT NOT NULL DEFAULT 'en_attente',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  updated_at TEXT NOT NULL DEFAULT to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TEXT NOT NULL DEFAULT to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE INDEX IF NOT EXISTS idx_decrees_category ON decrees(category);
CREATE INDEX IF NOT EXISTS idx_communiques_status ON communiques(status);
CREATE INDEX IF NOT EXISTS idx_agenda_date ON agenda_events(date);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Rôles par défaut. Modules : decrees, communiques, agenda, accounting, admin.
-- Actions possibles : view, add, edit, archive, delete, validate, refuse, download, manage_users, view_log.
INSERT INTO roles (name, description, permissions, is_system) VALUES
('Administrateur principal', 'Accès complet à toutes les fonctionnalités du site.',
 '{"all":["view","add","edit","archive","delete","validate","refuse","download","manage_users","view_log"]}', 1),
('Gouverneur', 'Direction de l''administration, validation et publication.',
 '{"decrees":["view","add","edit","archive","validate","download"],"communiques":["view","add","edit","archive","validate","download"],"agenda":["view","add","edit","archive","download"],"accounting":["view","add","edit","validate","download"],"admin":["manage_users","view_log"]}', 1),
('Gouverneur adjoint', 'Seconde le gouverneur dans ses fonctions.',
 '{"decrees":["view","add","edit","validate","download"],"communiques":["view","add","edit","validate","download"],"agenda":["view","add","edit","download"],"accounting":["view","add","download"],"admin":["view_log"]}', 1),
('Secrétaire général', 'Rédaction et suivi des décrets, communiqués et de l''agenda.',
 '{"decrees":["view","add","edit","download"],"communiques":["view","add","edit","download"],"agenda":["view","add","edit","download"],"accounting":["view"]}', 1),
('Responsable administratif', 'Gestion courante de l''agenda et des communiqués.',
 '{"decrees":["view","download"],"communiques":["view","add","edit","download"],"agenda":["view","add","edit","download"],"accounting":["view"]}', 1),
('Responsable financier', 'Gestion de la comptabilité de l''administration.',
 '{"decrees":["view"],"communiques":["view"],"agenda":["view"],"accounting":["view","add","edit","validate","download"]}', 1),
('Employé administratif', 'Contribution courante sans droits de validation.',
 '{"decrees":["view"],"communiques":["view","add","download"],"agenda":["view","add","download"],"accounting":["view"]}', 1),
('Consultation uniquement', 'Accès en lecture seule à l''ensemble des modules.',
 '{"decrees":["view"],"communiques":["view"],"agenda":["view"],"accounting":["view"]}', 1)
ON CONFLICT (name) DO NOTHING;
