const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Chaque ligne de l'historique porte de quoi s'afficher sans requete
// supplementaire : le titre, son affiche, et l'episode le cas echeant.
const LIST_SQL = `
  SELECT w.content_id, w.episode_id, w.watched_at,
         c.title, c.type, c.poster_url,
         e.season, e.number, e.title AS episode_title
  FROM watched w
  JOIN content c ON c.id = w.content_id
  LEFT JOIN episodes e ON e.id = w.episode_id
  WHERE w.user_id = @me
  ORDER BY w.watched_at DESC, w.rowid DESC`;

router.get('/', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const rows = db.prepare(`${LIST_SQL} LIMIT ${limit}`).all({ me: req.user.id });
  res.json({ history: rows, total: db.prepare('SELECT COUNT(*) c FROM watched WHERE user_id = ?').get(req.user.id).c });
});

// Retire une entree. episodeId absent vise le titre lui-meme (film).
router.delete('/', (req, res) => {
  const contentId = Number(req.query.contentId);
  if (!contentId) return res.status(400).json({ error: 'contentId requis' });

  const episodeId = req.query.episodeId ? Number(req.query.episodeId) : null;
  const info = db
    .prepare('DELETE FROM watched WHERE user_id = ? AND content_id = ? AND COALESCE(episode_id, 0) = ?')
    .run(req.user.id, contentId, episodeId ?? 0);

  if (!info.changes) return res.status(404).json({ error: 'Entrée introuvable' });
  res.json({ ok: true });
});

// Vide tout l'historique, ou celui d'un seul titre.
router.delete('/all', (req, res) => {
  const contentId = req.query.contentId ? Number(req.query.contentId) : null;
  const info = contentId
    ? db.prepare('DELETE FROM watched WHERE user_id = ? AND content_id = ?').run(req.user.id, contentId)
    : db.prepare('DELETE FROM watched WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true, supprimees: info.changes });
});

module.exports = router;
