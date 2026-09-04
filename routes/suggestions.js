const express = require('express');
const rateLimit = require('express-rate-limit');
const { db, audit } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Une boîte à idées ouverte à tous les membres se remplit vite de doublons
// si rien ne freine : dix propositions par heure et par personne suffisent.
const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id ?? req.ip),
  message: { error: 'Trop de propositions d’un coup. Réessaie dans une heure.' },
});

const STATUSES = ['nouveau', 'prevu', 'ajoute', 'refuse'];

// Le décompte des votes et le vote de la personne connectée sont calculés en
// une seule requête, pour éviter une requête par ligne affichée.
const LIST_SQL = `
  SELECT s.*,
         u.role AS author_role,
         (SELECT COUNT(*) FROM suggestion_votes v WHERE v.suggestion_id = s.id) AS votes,
         EXISTS(SELECT 1 FROM suggestion_votes v
                WHERE v.suggestion_id = s.id AND v.user_id = @me)              AS voted
  FROM suggestions s
  LEFT JOIN users u ON u.id = s.user_id`;

router.get('/', (req, res) => {
  const rows = db
    .prepare(`${LIST_SQL} ORDER BY (s.status = 'refuse'), votes DESC, s.id DESC LIMIT 200`)
    .all({ me: req.user.id });
  res.json({ suggestions: rows });
});

router.post('/', postLimiter, (req, res) => {
  const type = String(req.body.type || '').trim();
  const title = String(req.body.title || '').trim();
  const note = String(req.body.note || '').trim().slice(0, 500) || null;

  if (!['film', 'serie', 'jeu'].includes(type))
    return res.status(400).json({ error: 'Choisis un type : film, série ou jeu.' });
  if (title.length < 2 || title.length > 120)
    return res.status(400).json({ error: 'Le titre doit faire entre 2 et 120 caractères.' });

  const duplicate = db
    .prepare('SELECT id FROM suggestions WHERE type = ? AND title = ? COLLATE NOCASE')
    .get(type, title);
  if (duplicate)
    return res.status(409).json({
      error: 'Ce titre a déjà été proposé — vote pour lui plutôt que de le reproposer.',
      id: duplicate.id,
    });

  const info = db
    .prepare('INSERT INTO suggestions (user_id, author, type, title, note) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, req.user.username, type, title, note);
  const id = Number(info.lastInsertRowid);

  // L'auteur soutient sa propre proposition : sinon elle démarre à zéro vote
  // et se retrouve tout en bas de la liste.
  db.prepare('INSERT INTO suggestion_votes (suggestion_id, user_id) VALUES (?, ?)').run(id, req.user.id);

  res.json({ ok: true, suggestion: db.prepare(`${LIST_SQL} WHERE s.id = @id`).get({ me: req.user.id, id }) });
});

router.post('/:id/vote', (req, res) => {
  const s = db.prepare('SELECT id FROM suggestions WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Proposition introuvable' });

  const has = db
    .prepare('SELECT 1 FROM suggestion_votes WHERE suggestion_id = ? AND user_id = ?')
    .get(s.id, req.user.id);

  if (has)
    db.prepare('DELETE FROM suggestion_votes WHERE suggestion_id = ? AND user_id = ?').run(s.id, req.user.id);
  else
    db.prepare('INSERT INTO suggestion_votes (suggestion_id, user_id) VALUES (?, ?)').run(s.id, req.user.id);

  res.json({
    ok: true,
    suggestion: db.prepare(`${LIST_SQL} WHERE s.id = @id`).get({ me: req.user.id, id: s.id }),
  });
});

// Chacun peut retirer sa propre proposition ; un admin peut retirer n'importe laquelle.
router.delete('/:id', (req, res) => {
  const s = db.prepare('SELECT * FROM suggestions WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Proposition introuvable' });
  if (s.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Cette proposition n’est pas la tienne.' });

  db.prepare('DELETE FROM suggestions WHERE id = ?').run(s.id);
  if (req.user.role === 'admin' && s.user_id !== req.user.id)
    audit(req.user, 'delete_suggestion', `suggestion#${s.id}`, `${s.title} (de ${s.author})`);
  res.json({ ok: true });
});

// Suivi côté administration : marquer une idée comme prévue, ajoutée ou refusée.
router.post('/:id/status', (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Accès administrateur requis' });

  const s = db.prepare('SELECT * FROM suggestions WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Proposition introuvable' });

  const status = String(req.body.status || '');
  if (!STATUSES.includes(status))
    return res.status(400).json({ error: `Statut invalide (${STATUSES.join(', ')}).` });

  const adminNote = String(req.body.admin_note || '').trim().slice(0, 300) || null;
  db.prepare('UPDATE suggestions SET status = ?, admin_note = ? WHERE id = ?').run(status, adminNote, s.id);
  audit(req.user, 'suggestion_status', `suggestion#${s.id}`, `${s.title} -> ${status}`);

  res.json({
    ok: true,
    suggestion: db.prepare(`${LIST_SQL} WHERE s.id = @id`).get({ me: req.user.id, id: s.id }),
  });
});

module.exports = router;
