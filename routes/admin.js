const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db, audit } = require('../db');
const { requireAdmin } = require('../middleware/auth');

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

router.get('/content', (req, res) => {
  res.json({
    content: db.prepare('SELECT * FROM content ORDER BY type, sort_order, id').all(),
  });
});

router.post('/content', (req, res) => {
  const c = pickContent(req.body);
  if (!['film', 'serie', 'jeu'].includes(c.type))
    return res.status(400).json({ error: 'Type invalide (film, serie ou jeu).' });
  if (!c.title) return res.status(400).json({ error: 'Titre requis.' });

  const info = db
    .prepare(
      `INSERT INTO content (${CONTENT_FIELDS.join(',')})
       VALUES (${CONTENT_FIELDS.map((f) => '@' + f).join(',')})`
    )
    .run(c);
  const newId = Number(info.lastInsertRowid);
  audit(req.user, 'add_content', `content#${newId}`, `${c.type}: ${c.title}`);
  res.json({ ok: true, id: newId });
});

router.put('/content/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM content WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Contenu introuvable' });

  const c = pickContent({ ...existing, ...req.body });
  if (!['film', 'serie', 'jeu'].includes(c.type))
    return res.status(400).json({ error: 'Type invalide.' });
  if (!c.title) return res.status(400).json({ error: 'Titre requis.' });

  db.prepare(
    `UPDATE content SET ${CONTENT_FIELDS.map((f) => `${f} = @${f}`).join(', ')} WHERE id = @id`
  ).run({ ...c, id: existing.id });
  audit(req.user, 'edit_content', `content#${existing.id}`, c.title);
  res.json({ ok: true });
});

router.delete('/content/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM content WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Contenu introuvable' });
  db.prepare('DELETE FROM content WHERE id = ?').run(existing.id);
  audit(req.user, 'delete_content', `content#${existing.id}`, existing.title);
  res.json({ ok: true });
});

/* ------------------------------- journal ---------------------------------- */

router.get('/logs', (req, res) => {
  res.json({
    logs: db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200').all(),
  });
});

module.exports = router;
