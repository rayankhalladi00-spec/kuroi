const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { isDirectVideo } = require('../lib/embed');

const router = express.Router();
router.use(requireAuth);

// Seules les pièces jointes sont listées : l'affiche est déjà référencée par
// poster_url, elle n'a pas à apparaître dans les téléchargements.
const listFiles = db.prepare(
  "SELECT id, original_name, size FROM files WHERE content_id = ? AND kind = 'attachment' ORDER BY id"
);

function decorate(item) {
  item.files = listFiles.all(item.id);
  // Le client a besoin de savoir s'il doit poser une balise <video> ou un
  // lecteur externe en <iframe>.
  item.player = item.video_url ? (isDirectVideo(item.video_url) ? 'video' : 'embed') : null;
  return item;
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM content ORDER BY sort_order, id DESC').all().map(decorate);

  res.json({
    featured: rows.find((r) => r.featured) || rows[0] || null,
    films: rows.filter((r) => r.type === 'film'),
    series: rows.filter((r) => r.type === 'serie'),
    jeux: rows.filter((r) => r.type === 'jeu'),
  });
});

router.get('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM content WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Introuvable' });
  res.json({ item: decorate(item) });
});

module.exports = router;
