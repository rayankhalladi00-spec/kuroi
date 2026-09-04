const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const MAX_COMMENTAIRE = 1000;

function episodeExiste(id) {
  return db.prepare('SELECT id FROM episodes WHERE id = ?').get(id);
}

/* ---------------------------------- notes ---------------------------------- */

// Noter de nouveau remplace la note precedente : une seule par membre et par
// episode, garantie par la cle primaire.
router.put('/:id/rating', (req, res) => {
  if (!episodeExiste(req.params.id)) return res.status(404).json({ error: 'Épisode introuvable' });

  const score = Number(req.body.score);
  if (!Number.isInteger(score) || score < 1 || score > 10)
    return res.status(400).json({ error: 'La note doit être un entier de 1 à 10.' });

  db.prepare(
    `INSERT INTO episode_ratings (user_id, episode_id, score) VALUES (?, ?, ?)
     ON CONFLICT DO UPDATE SET score = excluded.score, created_at = datetime('now')`
  ).run(req.user.id, Number(req.params.id), score);

  res.json({ ok: true, ...noteDe(req.params.id, req.user.id) });
});

router.delete('/:id/rating', (req, res) => {
  const info = db
    .prepare('DELETE FROM episode_ratings WHERE user_id = ? AND episode_id = ?')
    .run(req.user.id, Number(req.params.id));
  if (!info.changes) return res.status(404).json({ error: 'Aucune note à retirer.' });
  res.json({ ok: true, ...noteDe(req.params.id, req.user.id) });
});

// Moyenne, nombre de votants, et la note du membre courant.
function noteDe(episodeId, userId) {
  const g = db
    .prepare('SELECT AVG(score) AS moyenne, COUNT(*) AS votants FROM episode_ratings WHERE episode_id = ?')
    .get(Number(episodeId));
  const mienne = db
    .prepare('SELECT score FROM episode_ratings WHERE episode_id = ? AND user_id = ?')
    .get(Number(episodeId), userId);
  return {
    // Arrondi au dixieme : « 8.3 » se lit mieux que « 8.333333 ».
    moyenne: g.votants ? Math.round(g.moyenne * 10) / 10 : null,
    votants: g.votants,
    maNote: mienne?.score ?? null,
  };
}

/* ------------------------------ commentaires ------------------------------- */

// Le role vient de la table users, pas d'une copie figee : promouvoir
// quelqu'un doit faire apparaitre l'etoile sur ses anciens messages aussi.
const LISTE_COMMENTAIRES = `
  SELECT c.id, c.author, c.body, c.created_at, c.user_id,
         u.role AS author_role, u.avatar AS author_avatar
  FROM episode_comments c
  LEFT JOIN users u ON u.id = c.user_id
  WHERE c.episode_id = ?
  ORDER BY c.created_at DESC, c.id DESC`;

router.get('/:id/comments', (req, res) => {
  if (!episodeExiste(req.params.id)) return res.status(404).json({ error: 'Épisode introuvable' });
  res.json({ comments: db.prepare(LISTE_COMMENTAIRES).all(Number(req.params.id)) });
});

router.post('/:id/comments', (req, res) => {
  if (!episodeExiste(req.params.id)) return res.status(404).json({ error: 'Épisode introuvable' });

  const body = String(req.body.body || '').trim().slice(0, MAX_COMMENTAIRE);
  if (!body) return res.status(400).json({ error: 'Le commentaire est vide.' });

  const info = db
    .prepare('INSERT INTO episode_comments (episode_id, user_id, author, body) VALUES (?, ?, ?, ?)')
    .run(Number(req.params.id), req.user.id, req.user.username, body);

  const ajoute = db
    .prepare(
      `SELECT c.id, c.author, c.body, c.created_at, c.user_id,
              u.role AS author_role, u.avatar AS author_avatar
       FROM episode_comments c LEFT JOIN users u ON u.id = c.user_id
       WHERE c.id = ?`
    )
    .get(Number(info.lastInsertRowid));

  res.json({ ok: true, comment: ajoute });
});

// Un membre efface les siens ; un administrateur efface n'importe lequel.
router.delete('/comments/:commentId', (req, res) => {
  const c = db
    .prepare('SELECT id, user_id FROM episode_comments WHERE id = ?')
    .get(req.params.commentId);
  if (!c) return res.status(404).json({ error: 'Commentaire introuvable' });

  if (c.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Ce commentaire n’est pas le tien.' });

  db.prepare('DELETE FROM episode_comments WHERE id = ?').run(c.id);
  res.json({ ok: true });
});

module.exports = { router, noteDe };
