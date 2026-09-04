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
  -- Identifiant d'une photo parmi un jeu fige (public/img/avatars/).
  -- Volontairement pas de televersement : chaque membre choisit dans la liste,
  -- ce qui evite de stocker autant d'images que de comptes sur le serveur.
  avatar        TEXT,
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

-- Episodes d'une serie. Un film n'en a aucun et garde son video_url ;
-- une serie peut n'en avoir aucun au depart, puis en recevoir autant qu'il faut.
CREATE TABLE IF NOT EXISTS episodes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  season     INTEGER NOT NULL DEFAULT 1,
  number     INTEGER NOT NULL,
  title      TEXT,
  synopsis   TEXT,
  video_url  TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (content_id, season, number)
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

-- Lecteurs supplementaires d'un episode. Le premier lecteur reste dans
-- episodes.video_url ; ceux-ci viennent en plus.
--
-- Raison d'etre : un hebergeur qui fonctionne sur ordinateur peut echouer sur
-- telephone, sans qu'on puisse y faire quoi que ce soit depuis ce site. Offrir
-- plusieurs sources laisse le membre basculer sur celle qui marche chez lui.
CREATE TABLE IF NOT EXISTS episode_sources (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  label      TEXT,
  url        TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Suivi de visionnage. Une ligne par membre et par titre vu :
--  * un film ou une serie sans episode  -> episode_id NULL
--  * un episode precis                  -> episode_id renseigne
-- La ligne la plus recente d'une serie sert a proposer la reprise.
CREATE TABLE IF NOT EXISTS watched (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  episode_id INTEGER REFERENCES episodes(id) ON DELETE CASCADE,
  -- Milliseconde et non seconde : deux episodes vus coup sur coup doivent
  -- rester ordonnables dans l'historique.
  watched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);

-- Note d'un episode, de 1 a 10. Une seule par membre et par episode : noter
-- de nouveau remplace la note precedente.
CREATE TABLE IF NOT EXISTS episode_ratings (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  score      INTEGER NOT NULL CHECK (score BETWEEN 1 AND 10),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, episode_id)
);

-- Commentaires d'un episode.
--
-- author fige le pseudo au moment du message : il survit a la suppression du
-- compte, comme pour la boite a idees. user_id reste a cote pour retrouver le
-- role courant — c'est lui qui decide de l'etoile des administrateurs, et une
-- promotion doit se voir sur les anciens messages.
CREATE TABLE IF NOT EXISTS episode_comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  author     TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
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
CREATE INDEX IF NOT EXISTS idx_episodes_content ON episodes(content_id, season, number);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status, id DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
-- SQLite considere deux NULL comme distincts dans une cle unique, ce qui
-- laisserait s'empiler les lignes des films. COALESCE regle le probleme, et
-- SQLite n'accepte une expression que dans un index, pas dans une contrainte.
CREATE UNIQUE INDEX IF NOT EXISTS idx_watched_unique
  ON watched(user_id, content_id, COALESCE(episode_id, 0));
CREATE INDEX IF NOT EXISTS idx_sources_episode ON episode_sources(episode_id, position);
CREATE INDEX IF NOT EXISTS idx_ratings_episode ON episode_ratings(episode_id);
CREATE INDEX IF NOT EXISTS idx_comments_episode ON episode_comments(episode_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_watched_user ON watched(user_id, watched_at DESC);
CREATE INDEX IF NOT EXISTS idx_watched_content ON watched(user_id, content_id);
CREATE INDEX IF NOT EXISTS idx_content_type ON content(type);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);
`);

// Migrations : CREATE TABLE IF NOT EXISTS ne touche pas une table existante.
// Une colonne ajoutee apres coup doit l'etre explicitement, sinon la base de
// production reste en arriere pendant que le code la reclame.
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  console.log(`Migration : colonne ${table}.${column} ajoutee.`);
}

ensureColumn('users', 'avatar', 'TEXT');

function audit(actor, action, target, details) {
  db.prepare(
    `INSERT INTO audit_log (actor_id, actor_name, action, target, details)
     VALUES (?, ?, ?, ?, ?)`
  ).run(actor?.id ?? null, actor?.username ?? 'system', action, target ?? null, details ?? null);
}

module.exports = { db, audit, DATA_DIR };
