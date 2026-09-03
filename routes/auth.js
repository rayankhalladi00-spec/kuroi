const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { db, audit } = require('../db');

const router = express.Router();

// Freine la force brute. Réglable car la suite de tests épuise sinon le quota
// avec ses propres connexions légitimes.
const LOGIN_LIMIT = Number(process.env.LOGIN_RATE_LIMIT) || 10;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: LOGIN_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessaie dans 15 minutes.' },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,20}$/;

function validate({ username, email, password }) {
  if (!USERNAME_RE.test(username || ''))
    return "Le pseudo doit faire 3 à 20 caractères (lettres, chiffres, . _ -).";
  if (!EMAIL_RE.test(email || '')) return 'Adresse e-mail invalide.';
  if (!password || password.length < 8) return 'Le mot de passe doit faire au moins 8 caractères.';
  return null;
}

router.post('/register', loginLimiter, (req, res) => {
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const err = validate({ username, email, password });
  if (err) return res.status(400).json({ error: err });

  const exists = db
    .prepare('SELECT id FROM users WHERE username = ? OR email = ?')
    .get(username, email);
  if (exists) return res.status(409).json({ error: 'Ce pseudo ou cet e-mail est déjà utilisé.' });

  const hash = bcrypt.hashSync(password, 12);
  const info = db
    .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
    .run(username, email, hash);

  const user = { id: Number(info.lastInsertRowid), username, role: 'user' };
  audit(user, 'register', `user#${user.id}`, `${username} <${email}>`);

  req.session.userId = user.id;
  res.json({ ok: true, user: { id: user.id, username, email, role: 'user' } });
});

// Un seul identifiant suffit : le pseudo ou l'e-mail, au choix.
router.post('/login', loginLimiter, (req, res) => {
  const identifier = String(req.body.identifier || '').trim();
  const password = String(req.body.password || '');

  if (!identifier || !password)
    return res.status(400).json({ error: 'Pseudo/e-mail et mot de passe requis.' });

  const user = db
    .prepare('SELECT * FROM users WHERE username = ? OR email = ?')
    .get(identifier, identifier.toLowerCase());

  // Comparaison systématique pour ne pas révéler si le compte existe.
  const hash = user?.password_hash || '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu';
  const ok = bcrypt.compareSync(password, hash);

  if (!user || !ok) return res.status(401).json({ error: 'Identifiants incorrects.' });
  if (user.banned)
    return res.status(403).json({
      error: 'Ce compte est banni.',
      reason: user.ban_reason || null,
    });

  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
  req.session.userId = user.id;
  res.json({
    ok: true,
    user: { id: user.id, username: user.username, email: user.email, role: user.role },
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', (req, res) => {
  if (req.bannedUser)
    return res.status(403).json({ error: 'Compte banni', reason: req.bannedUser.ban_reason });
  if (!req.user) return res.status(401).json({ error: 'Non connecté' });
  res.json({ user: req.user });
});

router.post('/change-password', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Connexion requise' });
  const current = String(req.body.currentPassword || '');
  const next = String(req.body.newPassword || '');
  if (next.length < 8)
    return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 8 caractères.' });

  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current, row.password_hash))
    return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    bcrypt.hashSync(next, 12),
    req.user.id
  );
  audit(req.user, 'self_password_change', `user#${req.user.id}`, null);
  res.json({ ok: true });
});

module.exports = router;
