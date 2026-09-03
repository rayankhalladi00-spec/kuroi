const path = require('path');
const fs = require('fs');

// node:sqlite n'est disponible sans drapeau qu'à partir de Node 23.4.
// Message clair plutôt qu'un « Cannot find module » obscur sur un vieux Node.
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 23 || (major === 23 && minor < 4)) {
  console.error(
    `Node ${process.versions.node} détecté. Kuroi nécessite Node 24 ou plus récent.\n` +
      `Installer :  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt install -y nodejs`
  );
  process.exit(1);
}

const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'kuroi.db'));

// WAL : lectures concurrentes pendant une écriture. Indisponible sur certains
// systèmes de fichiers (partages réseau, chemins virtualisés Windows) ; on
// retombe alors sur le journal par défaut, plus lent mais fonctionnel.
try {
  db.exec('PRAGMA journal_mode = WAL');
} catch (e) {
  console.warn('WAL indisponible sur ce système de fichiers, journal classique utilisé.');
}
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  banned        INTEGER NOT NULL DEFAULT 0,
  ban_reason    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS content (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  type         TEXT NOT NULL CHECK (type IN ('film','serie','jeu')),
  title        TEXT NOT NULL,
  description  TEXT,
  poster_url   TEXT,
  video_url    TEXT,
  external_url TEXT,
  year         INTEGER,
  genre        TEXT,
  featured     INTEGER NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id   INTEGER,
  actor_name TEXT,
  action     TEXT NOT NULL,
  target     TEXT,
  details    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fichiers d'un contenu : pieces jointes telechargeables et affiches.
-- Le fichier vit dans data/uploads/, la base ne garde que sa description.
CREATE TABLE IF NOT EXISTS files (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id    INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  -- 'attachment' : fichier telechargeable (.torrent, archive)
  -- 'poster'     : image d'affiche, servie en ligne
  kind          TEXT NOT NULL DEFAULT 'attachment' CHECK (kind IN ('attachment','poster')),
  original_name TEXT NOT NULL,
  stored_name   TEXT NOT NULL UNIQUE,
  mime          TEXT,
  size          INTEGER NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Boite a idees : les membres proposent des titres, tout le monde vote.
CREATE TABLE IF NOT EXISTS suggestions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  author     TEXT NOT NULL,               -- pseudo fige : survit a la suppression du compte
  type       TEXT NOT NULL CHECK (type IN ('film','serie','jeu')),
  title      TEXT NOT NULL,
  note       TEXT,
  status     TEXT NOT NULL DEFAULT 'nouveau'
             CHECK (status IN ('nouveau','prevu','ajoute','refuse')),
  admin_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suggestion_votes (
  suggestion_id INTEGER NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (suggestion_id, user_id)
);

-- Favoris : « ma liste » de chaque membre.
CREATE TABLE IF NOT EXISTS favorites (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, content_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  sid     TEXT PRIMARY KEY,
  expires INTEGER NOT NULL,
  data    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_files_content ON files(content_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status, id DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_content_type ON content(type);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);
`);

function audit(actor, action, target, details) {
  db.prepare(
    `INSERT INTO audit_log (actor_id, actor_name, action, target, details)
     VALUES (?, ?, ?, ?, ?)`
  ).run(actor?.id ?? null, actor?.username ?? 'system', action, target ?? null, details ?? null);
}

module.exports = { db, audit, DATA_DIR };
