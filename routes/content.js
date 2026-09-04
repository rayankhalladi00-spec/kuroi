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

const listEpisodes = db.prepare(
  `SELECT id, season, number, title, synopsis, video_url
   FROM episodes WHERE content_id = ? ORDER BY season, number`
);

// Indique au client s'il doit poser une balise <video> ou un lecteur externe
// en <iframe>.
const playerKind = (url) => (url ? (isDirectVideo(url) ? 'video' : 'embed') : null);

function decorate(item, favIds, withEpisodes = false) {
  item.files = listFiles.all(item.id);
  item.player = playerKind(item.video_url);
  item.favorite = favIds.has(item.id);

  if (item.type === 'serie') {
    // Le catalogue n'a besoin que du décompte ; la fiche, de la liste complète.
    const eps = listEpisodes.all(item.id);
    item.episodeCount = eps.length;
    item.seasonCount = new Set(eps.map((e) => e.season)).size;
    if (withEpisodes) item.episodes = eps.map((e) => ({ ...e, player: playerKind(e.video_url) }));
  }
  return item;
}

function favoriteIds(userId) {
  return new Set(
    db.prepare('SELECT content_id FROM favorites WHERE user_id = ?').all(userId).map((r) => r.content_id)
  );
}

router.get('/', (req, res) => {
  const favIds = favoriteIds(req.user.id);
  const rows = db
    .prepare('SELECT * FROM content ORDER BY sort_order, id DESC')
    .all()
    .map((r) => decorate(r, favIds));

  res.json({
    featured: rows.find((r) => r.featured) || rows[0] || null,
    favoris: rows.filter((r) => r.favorite),
    films: rows.filter((r) => r.type === 'film'),
    series: rows.filter((r) => r.type === 'serie'),
    jeux: rows.filter((r) => r.type === 'jeu'),
  });
});

router.get('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM content WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Introuvable' });

  const favIds = favoriteIds(req.user.id);
  // Quelques titres proches, pour ne pas laisser la fiche se terminer sur rien.
  const similar = db
    .prepare(
      `SELECT * FROM content
       WHERE id <> ? AND (type = ? OR (genre IS NOT NULL AND genre = ?))
       ORDER BY (genre IS NOT NULL AND genre = ?) DESC, id DESC LIMIT 8`
    )
    .all(item.id, item.type, item.genre, item.genre)
    .map((r) => decorate(r, favIds));

  res.json({ item: decorate(item, favIds, true), similar });
});

// Ajout/retrait de « ma liste ».
router.post('/:id/favorite', (req, res) => {
  const item = db.prepare('SELECT id FROM content WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Introuvable' });

  const has = db
    .prepare('SELECT 1 FROM favorites WHERE user_id = ? AND content_id = ?')
    .get(req.user.id, item.id);

  if (has)
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND content_id = ?').run(req.user.id, item.id);
  else
    db.prepare('INSERT INTO favorites (user_id, content_id) VALUES (?, ?)').run(req.user.id, item.id);

  res.json({ ok: true, favorite: !has });
});

module.exports = router;
