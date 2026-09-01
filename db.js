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

CREATE TABLE IF NOT EXISTS sessions (
  sid     TEXT PRIMARY KEY,
  expires INTEGER NOT NULL,
  data    TEXT NOT NULL
);

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
