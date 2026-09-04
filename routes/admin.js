const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db, audit } = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { extractEmbedUrl, invalidateEmbedHosts } = require('../lib/embed');
const fsp = require('fs');
const path = require('path');
const avatarsLib = require('../lib/avatars');
const {
  upload,
  uploadImage,
  uploadAvatar,
  AVATAR_DIR,
  MAX_AVATAR_SIZE,
  ALLOWED_EXT,
  MAX_SIZE,
  IMAGE_EXT,
  MAX_IMAGE_SIZE,
  looksLikeTorrent,
  sniffImage,
  removeFile,
} = require('../lib/uploads');

const router = express.Router();
router.use(requireAdmin);

const USER_COLS = `id, username, email, role, banned, ban_reason, created_at, last_login_at`;

function adminCount() {
  return db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'admin' AND banned = 0").get().c;
}

function getUser(id) {
  return db.prepare(`SELECT ${USER_COLS} FROM users WHERE id = ?`).get(id);
}

/* ---------------------------------- stats --------------------------------- */

router.get('/stats', (req, res) => {
  const g = (sql) => db.prepare(sql).get().c;
  res.json({
    users: g('SELECT COUNT(*) c FROM users'),
    admins: g("SELECT COUNT(*) c FROM users WHERE role='admin'"),
    banned: g('SELECT COUNT(*) c FROM users WHERE banned=1'),
    films: g("SELECT COUNT(*) c FROM content WHERE type='film'"),
    series: g("SELECT COUNT(*) c FROM content WHERE type='serie'"),
    jeux: g("SELECT COUNT(*) c FROM content WHERE type='jeu'"),
    suggestions: g("SELECT COUNT(*) c FROM suggestions WHERE status = 'nouveau'"),
  });
});

/* ------------------------------- utilisateurs ------------------------------ */

router.get('/users', (req, res) => {
  const q = `%${String(req.query.q || '').trim()}%`;
  const rows = db
    .prepare(
      `SELECT ${USER_COLS} FROM users
       WHERE username LIKE ? OR email LIKE ?
       ORDER BY role DESC, id ASC`
    )
    .all(q, q);
  res.json({ users: rows });
});

// Réinitialise le mot de passe. Deux modes :
//  - password fourni  -> on l'utilise
//  - sinon            -> on en génère un aléatoire et on le renvoie UNE SEULE FOIS
router.post('/users/:id/reset-password', (req, res) => {
  const target = getUser(req.params.id);
  if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });

  let password = String(req.body.password || '');
  let generated = false;
  if (!password) {
    password = crypto.randomBytes(9).toString('base64url');
    generated = true;
  } else if (password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 8 caractères.' });
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    bcrypt.hashSync(password, 12),
    target.id
  );
  audit(req.user, 'reset_password', `user#${target.id}`, target.username);

  // Les sessions actives de la cible restent valides : on ne les révoque pas ici,
  // le ban est l'outil pour couper l'accès immédiatement.
  res.json({ ok: true, password, generated });
});

router.post('/users/:id/ban', (req, res) => {
  const target = getUser(req.params.id);
  if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });
  if (target.id === req.user.id)
    return res.status(400).json({ error: 'Tu ne peux pas te bannir toi-même.' });

  const banned = req.body.banned ? 1 : 0;
  const reason = banned ? String(req.body.reason || '').slice(0, 300) || null : null;

  if (banned && target.role === 'admin' && adminCount() <= 1)
    return res.status(400).json({ error: 'Impossible de bannir le dernier administrateur.' });

  db.prepare('UPDATE users SET banned = ?, ban_reason = ? WHERE id = ?').run(
    banned,
    reason,
    target.id
  );
  audit(req.user, banned ? 'ban' : 'unban', `user#${target.id}`, reason || target.username);
  res.json({ ok: true, user: getUser(target.id) });
});

router.post('/users/:id/role', (req, res) => {
  const target = getUser(req.params.id);
  if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const role = req.body.role === 'admin' ? 'admin' : 'user';
  if (target.id === req.user.id && role !== 'admin')
    return res.status(400).json({ error: 'Tu ne peux pas retirer ton propre rôle admin.' });
  if (role === 'user' && target.role === 'admin' && adminCount() <= 1)
    return res.status(400).json({ error: 'Il doit rester au moins un administrateur.' });

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, target.id);
  audit(req.user, 'set_role', `user#${target.id}`, `${target.username} -> ${role}`);
  res.json({ ok: true, user: getUser(target.id) });
});

router.delete('/users/:id', (req, res) => {
  const target = getUser(req.params.id);
  if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });
  if (target.id === req.user.id)
    return res.status(400).json({ error: 'Tu ne peux pas supprimer ton propre compte.' });
  if (target.role === 'admin' && adminCount() <= 1)
    return res.status(400).json({ error: 'Impossible de supprimer le dernier administrateur.' });

  db.prepare('DELETE FROM users WHERE id = ?').run(target.id);
  audit(req.user, 'delete_user', `user#${target.id}`, `${target.username} <${target.email}>`);
  res.json({ ok: true });
});

// Création manuelle d'un compte par un admin.
router.post('/users', (req, res) => {
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const role = req.body.role === 'admin' ? 'admin' : 'user';
  let password = String(req.body.password || '');
  let generated = false;

  if (!/^[a-zA-Z0-9_.-]{3,20}$/.test(username))
    return res.status(400).json({ error: 'Pseudo invalide (3-20 caractères).' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
    return res.status(400).json({ error: 'E-mail invalide.' });
  if (!password) {
    password = crypto.randomBytes(9).toString('base64url');
    generated = true;
  } else if (password.length < 8) {
    return res.status(400).json({ error: 'Mot de passe trop court (8 caractères minimum).' });
  }

  if (db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email))
    return res.status(409).json({ error: 'Pseudo ou e-mail déjà utilisé.' });

  const info = db
    .prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(username, email, bcrypt.hashSync(password, 12), role);
  const newId = Number(info.lastInsertRowid);
  audit(req.user, 'create_user', `user#${newId}`, `${username} (${role})`);
  res.json({ ok: true, user: getUser(newId), password, generated });
});

/* --------------------------------- contenu -------------------------------- */

const CONTENT_FIELDS = [
  'type',
  'title',
  'description',
  'poster_url',
  'video_url',
  'external_url',
  'year',
  'genre',
  'featured',
  'sort_order',
];

function pickContent(body) {
  const out = {};
  for (const f of CONTENT_FIELDS) {
    let v = body[f];
    if (v === undefined) v = null;
    if (f === 'featured') v = v ? 1 : 0;
    if (f === 'year' || f === 'sort_order') v = v === null || v === '' ? (f === 'year' ? null : 0) : Number(v) || 0;
    if (typeof v === 'string') v = v.trim() || null;
    out[f] = v;
  }
  return out;
}

// Remplace le champ « lecteur » par la seule adresse extraite du code collé.
// Renvoie un message d'information si l'adresse a dû être ajustée.
function normalizeEmbed(c) {
  if (!c.video_url) return null;
  const { url, upgraded } = extractEmbedUrl(c.video_url);
  c.video_url = url;
  return upgraded
    ? 'Le lecteur était en http : passé en https, sinon le navigateur le bloque sur un site sécurisé.'
    : null;
}

router.get('/content', (req, res) => {
  const content = db.prepare('SELECT * FROM content ORDER BY type, sort_order, id').all();
  const files = db.prepare('SELECT * FROM files ORDER BY id').all();

  // Avancement du remplissage : sur un catalogue de plusieurs milliers
  // d'épisodes, savoir lesquels attendent encore un lecteur est le seul moyen
  // de s'y retrouver. Compté en une requête plutôt qu'une par série.
  const avancement = new Map(
    db
      .prepare(
        `SELECT content_id,
                COUNT(*) AS total,
                COUNT(video_url) AS avec_lecteur,
                MIN(CASE WHEN video_url IS NULL THEN id END) AS premier_vide
         FROM episodes GROUP BY content_id`
      )
      .all()
      .map((r) => [r.content_id, r])
  );

  for (const c of content) {
    c.files = files.filter((f) => f.content_id === c.id);
    const a = avancement.get(c.id);
    c.episodeCount = a?.total ?? 0;
    c.episodesAvecLecteur = a?.avec_lecteur ?? 0;
    // Permet de sauter droit au premier épisode qui manque.
    c.premierEpisodeSansLecteur = a?.premier_vide ?? null;
  }

  res.json({ content });
});

router.post('/content', (req, res) => {
  const c = pickContent(req.body);
  if (!['film', 'serie', 'jeu'].includes(c.type))
    return res.status(400).json({ error: 'Type invalide (film, serie ou jeu).' });
  if (!c.title) return res.status(400).json({ error: 'Titre requis.' });

  let notice;
  try {
    notice = normalizeEmbed(c);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const info = db
    .prepare(
      `INSERT INTO content (${CONTENT_FIELDS.join(',')})
       VALUES (${CONTENT_FIELDS.map((f) => '@' + f).join(',')})`
    )
    .run(c);
  const newId = Number(info.lastInsertRowid);
  invalidateEmbedHosts();
  audit(req.user, 'add_content', `content#${newId}`, `${c.type}: ${c.title}`);
  res.json({ ok: true, id: newId, notice });
});

router.put('/content/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM content WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Contenu introuvable' });

  const c = pickContent({ ...existing, ...req.body });
  if (!['film', 'serie', 'jeu'].includes(c.type))
    return res.status(400).json({ error: 'Type invalide.' });
  if (!c.title) return res.status(400).json({ error: 'Titre requis.' });

  let notice;
  try {
    notice = normalizeEmbed(c);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  db.prepare(
    `UPDATE content SET ${CONTENT_FIELDS.map((f) => `${f} = @${f}`).join(', ')} WHERE id = @id`
  ).run({ ...c, id: existing.id });
  invalidateEmbedHosts();
  audit(req.user, 'edit_content', `content#${existing.id}`, c.title);
  res.json({ ok: true, notice });
});

router.delete('/content/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM content WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Contenu introuvable' });

  // La cascade nettoie la table files ; les fichiers sur le disque, non.
  const attached = db.prepare('SELECT stored_name FROM files WHERE content_id = ?').all(existing.id);
  db.prepare('DELETE FROM content WHERE id = ?').run(existing.id);
  for (const f of attached) removeFile(f.stored_name);

  invalidateEmbedHosts();
  audit(req.user, 'delete_content', `content#${existing.id}`, existing.title);
  res.json({ ok: true });
});

/* --------------------------------- épisodes -------------------------------- */

const EPISODE_COLS = 'id, content_id, season, number, title, synopsis, video_url';

function readEpisode(body, existing = {}) {
  const season = Number(body.season ?? existing.season ?? 1);
  const number = Number(body.number ?? existing.number);
  const title = (body.title ?? existing.title ?? '').toString().trim() || null;
  const synopsis = (body.synopsis ?? existing.synopsis ?? '').toString().trim().slice(0, 800) || null;
  let video = (body.video_url ?? existing.video_url ?? '').toString().trim() || null;

  if (!Number.isInteger(season) || season < 1 || season > 99)
    throw new Error('Saison invalide (1 à 99).');
  if (!Number.isInteger(number) || number < 1 || number > 999)
    throw new Error('Numéro d’épisode invalide (1 à 999).');

  let notice = null;
  if (video) {
    const r = extractEmbedUrl(video);
    video = r.url;
    if (r.upgraded) notice = 'Le lecteur était en http : passé en https.';
  }
  return { episode: { season, number, title, synopsis, video_url: video }, notice };
}

router.get('/content/:id/episodes', (req, res) => {
  const episodes = db
    .prepare(`SELECT ${EPISODE_COLS} FROM episodes WHERE content_id = ? ORDER BY season, number`)
    .all(req.params.id);

  // Les lecteurs supplémentaires accompagnent chaque épisode : le formulaire
  // d'édition doit pouvoir les réafficher tels quels.
  const sources = db.prepare(
    'SELECT id, label, url FROM episode_sources WHERE episode_id = ? ORDER BY position, id'
  );
  for (const e of episodes) e.sources = sources.all(e.id);

  res.json({ episodes });
});

router.post('/content/:id/episodes', (req, res) => {
  const content = db.prepare('SELECT id, type, title FROM content WHERE id = ?').get(req.params.id);
  if (!content) return res.status(404).json({ error: 'Contenu introuvable' });
  if (content.type !== 'serie')
    return res.status(400).json({ error: 'Seules les séries peuvent avoir des épisodes.' });

  let parsed;
  try {
    parsed = readEpisode(req.body);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const dup = db
    .prepare('SELECT id FROM episodes WHERE content_id = ? AND season = ? AND number = ?')
    .get(content.id, parsed.episode.season, parsed.episode.number);
  if (dup)
    return res.status(409).json({
      error: `L’épisode S${parsed.episode.season}E${parsed.episode.number} existe déjà.`,
    });

  const info = db
    .prepare(
      `INSERT INTO episodes (content_id, season, number, title, synopsis, video_url)
       VALUES (@content_id, @season, @number, @title, @synopsis, @video_url)`
    )
    .run({ ...parsed.episode, content_id: content.id });

  invalidateEmbedHosts();
  audit(req.user, 'add_episode', `content#${content.id}`,
    `${content.title} S${parsed.episode.season}E${parsed.episode.number}`);

  res.json({
    ok: true,
    notice: parsed.notice,
    episode: db.prepare(`SELECT ${EPISODE_COLS} FROM episodes WHERE id = ?`).get(Number(info.lastInsertRowid)),
  });
});

router.put('/episodes/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM episodes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Épisode introuvable' });

  let parsed;
  try {
    parsed = readEpisode(req.body, existing);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const dup = db
    .prepare('SELECT id FROM episodes WHERE content_id = ? AND season = ? AND number = ? AND id <> ?')
    .get(existing.content_id, parsed.episode.season, parsed.episode.number, existing.id);
  if (dup)
    return res.status(409).json({
      error: `L’épisode S${parsed.episode.season}E${parsed.episode.number} existe déjà.`,
    });

  db.prepare(
    `UPDATE episodes SET season = @season, number = @number, title = @title,
            synopsis = @synopsis, video_url = @video_url WHERE id = @id`
  ).run({ ...parsed.episode, id: existing.id });

  // Lecteurs supplémentaires : une adresse ou un code d'intégration par ligne.
  // La liste envoyée remplace l'ancienne, ce qui rend la modification simple à
  // raisonner — on ne bricole pas des ajouts et des retraits ligne par ligne.
  const refuses = [];
  if (req.body.sources !== undefined) {
    const lignes = String(req.body.sources || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM episode_sources WHERE episode_id = ?').run(existing.id);
      const ins = db.prepare(
        'INSERT INTO episode_sources (episode_id, label, url, position) VALUES (?, ?, ?, ?)'
      );
      lignes.forEach((ligne, i) => {
        try {
          // Même extracteur que le lecteur principal : on ne conserve jamais le
          // HTML collé, seulement l'adresse.
          const { url } = extractEmbedUrl(ligne);
          ins.run(existing.id, `Lecteur ${i + 2}`, url, i);
        } catch (e) {
          refuses.push({ ligne: i + 1, message: e.message });
        }
      });
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }

  invalidateEmbedHosts();
  audit(req.user, 'edit_episode', `content#${existing.content_id}`,
    `S${parsed.episode.season}E${parsed.episode.number}`);

  const sources = db
    .prepare('SELECT id, label, url FROM episode_sources WHERE episode_id = ? ORDER BY position, id')
    .all(existing.id);

  res.json({
    ok: true,
    notice: parsed.notice,
    refuses,
    sources,
    episode: db.prepare(`SELECT ${EPISODE_COLS} FROM episodes WHERE id = ?`).get(existing.id),
  });
});

router.delete('/episodes/:id', (req, res) => {
  const ep = db.prepare('SELECT * FROM episodes WHERE id = ?').get(req.params.id);
  if (!ep) return res.status(404).json({ error: 'Épisode introuvable' });

  db.prepare('DELETE FROM episodes WHERE id = ?').run(ep.id);
  invalidateEmbedHosts();
  audit(req.user, 'delete_episode', `content#${ep.content_id}`, `S${ep.season}E${ep.number}`);
  res.json({ ok: true });
});

/* --------------------------- photos de profil ------------------------------ */

// Les membres choisissent parmi un jeu figé ; c'est l'administration qui
// alimente ce jeu. Personne d'autre ne téléverse, ce qui évite de stocker une
// image par compte sur le disque.
router.get('/avatars', (req, res) => res.json({ avatars: avatarsLib.list() }));

router.post('/avatars', (req, res) => {
  uploadAvatar.single('file')(req, res, (err) => {
    if (err)
      return res.status(400).json({
        error:
          err.code === 'LIMIT_FILE_SIZE'
            ? `Image trop lourde (maximum ${Math.round(MAX_AVATAR_SIZE / 1024 / 1024)} Mo).`
            : err.message,
      });
    if (!req.file) return res.status(400).json({ error: 'Aucune image reçue.' });

    // L'extension ne prouve rien : on vérifie la signature du fichier.
    if (!sniffImage(req.file.path)) {
      fsp.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Ce fichier n'est pas une image valide." });
    }

    audit(req.user, 'add_avatar', null, req.file.filename);
    res.json({ ok: true, avatars: avatarsLib.list() });
  });
});

router.delete('/avatars/:id', (req, res) => {
  const photo = avatarsLib.list().find((a) => a.id === req.params.id);
  if (!photo) return res.status(404).json({ error: 'Photo introuvable' });

  try {
    fsp.unlinkSync(path.join(AVATAR_DIR, path.basename(photo.url)));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  // Les comptes qui l'avaient choisie retombent sur leur initiale.
  db.prepare('UPDATE users SET avatar = NULL WHERE avatar = ?').run(photo.id);

  audit(req.user, 'delete_avatar', null, photo.id);
  res.json({ ok: true, avatars: avatarsLib.list() });
});

/* ------------------------------ pièces jointes ----------------------------- */

router.get('/upload-limits', (req, res) =>
  res.json({
    extensions: ALLOWED_EXT,
    maxSize: MAX_SIZE,
    imageExtensions: IMAGE_EXT,
    maxImageSize: MAX_IMAGE_SIZE,
  })
);

const insertFile = db.prepare(
  `INSERT INTO files (content_id, kind, original_name, stored_name, mime, size)
   VALUES (?, ?, ?, ?, ?, ?)`
);

// Traduit les erreurs de multer en messages lisibles.
function uploadError(err, maxSize) {
  return err.code === 'LIMIT_FILE_SIZE'
    ? `Fichier trop volumineux (maximum ${Math.round(maxSize / 1024 / 1024)} Mo).`
    : err.message;
}

router.post('/content/:id/files', (req, res) => {
  const content = db.prepare('SELECT id, title FROM content WHERE id = ?').get(req.params.id);
  if (!content) return res.status(404).json({ error: 'Contenu introuvable' });

  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: uploadError(err, MAX_SIZE) });
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });

    if (req.file.originalname.toLowerCase().endsWith('.torrent') && !looksLikeTorrent(req.file.path)) {
      removeFile(req.file.filename);
      return res.status(400).json({ error: 'Ce fichier ne ressemble pas à un .torrent valide.' });
    }

    const info = insertFile.run(
      content.id,
      'attachment',
      req.file.originalname,
      req.file.filename,
      req.file.mimetype,
      req.file.size
    );

    audit(req.user, 'add_file', `content#${content.id}`, `${req.file.originalname} (${content.title})`);
    res.json({
      ok: true,
      file: db.prepare('SELECT * FROM files WHERE id = ?').get(Number(info.lastInsertRowid)),
    });
  });
});

// Affiche : une seule par contenu. La précédente est remplacée.
router.post('/content/:id/poster', (req, res) => {
  const content = db.prepare('SELECT id, title FROM content WHERE id = ?').get(req.params.id);
  if (!content) return res.status(404).json({ error: 'Contenu introuvable' });

  uploadImage.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: uploadError(err, MAX_IMAGE_SIZE) });
    if (!req.file) return res.status(400).json({ error: 'Aucune image reçue.' });

    // L'extension ne prouve rien : on vérifie la signature du fichier.
    const mime = sniffImage(req.file.path);
    if (!mime) {
      removeFile(req.file.filename);
      return res.status(400).json({ error: "Ce fichier n'est pas une image valide." });
    }

    for (const old of db
      .prepare("SELECT * FROM files WHERE content_id = ? AND kind = 'poster'")
      .all(content.id)) {
      db.prepare('DELETE FROM files WHERE id = ?').run(old.id);
      removeFile(old.stored_name);
    }

    const info = insertFile.run(
      content.id,
      'poster',
      req.file.originalname,
      req.file.filename,
      mime,
      req.file.size
    );
    const id = Number(info.lastInsertRowid);
    const url = `/api/files/${id}/view`;
    db.prepare('UPDATE content SET poster_url = ? WHERE id = ?').run(url, content.id);

    audit(req.user, 'set_poster', `content#${content.id}`, `${req.file.originalname} (${content.title})`);
    res.json({ ok: true, poster_url: url, file: db.prepare('SELECT * FROM files WHERE id = ?').get(id) });
  });
});

router.delete('/files/:id', (req, res) => {
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!file) return res.status(404).json({ error: 'Fichier introuvable' });

  db.prepare('DELETE FROM files WHERE id = ?').run(file.id);
  removeFile(file.stored_name);

  // Retirer une affiche doit aussi vider le champ qui la référence.
  if (file.kind === 'poster')
    db.prepare("UPDATE content SET poster_url = NULL WHERE id = ? AND poster_url = ?").run(
      file.content_id,
      `/api/files/${file.id}/view`
    );

  audit(req.user, 'delete_file', `content#${file.content_id}`, file.original_name);
  res.json({ ok: true });
});

/* ------------------------------- journal ---------------------------------- */

router.get('/logs', (req, res) => {
  res.json({
    logs: db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200').all(),
  });
});

module.exports = router;
