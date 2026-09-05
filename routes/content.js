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

// Moyenne et nombre de votants par episode d'une serie, en une requete plutot
// qu'une par episode.
const listNotes = db.prepare(
  `SELECT e.id AS episode_id,
          ROUND(AVG(r.score), 1) AS moyenne,
          COUNT(r.score)         AS votants
   FROM episodes e
   LEFT JOIN episode_ratings r ON r.episode_id = e.id
   WHERE e.content_id = ?
   GROUP BY e.id`
);

const listMesNotes = db.prepare(
  `SELECT r.episode_id, r.score
   FROM episode_ratings r
   JOIN episodes e ON e.id = r.episode_id
   WHERE e.content_id = ? AND r.user_id = ?`
);

const listCommentCounts = db.prepare(
  `SELECT c.episode_id, COUNT(*) AS n
   FROM episode_comments c
   JOIN episodes e ON e.id = c.episode_id
   WHERE e.content_id = ?
   GROUP BY c.episode_id`
);

const listSources = db.prepare(
  'SELECT id, label, url FROM episode_sources WHERE episode_id = ? ORDER BY position, id'
);

const listEpisodes = db.prepare(
  `SELECT id, season, number, title, synopsis, thumbnail_url, video_url
   FROM episodes WHERE content_id = ? ORDER BY season, number`
);

// Indique au client s'il doit poser une balise <video> ou un lecteur externe
// en <iframe>.
const playerKind = (url) => (url ? (isDirectVideo(url) ? 'video' : 'embed') : null);

function decorate(item, favIds, seen, withEpisodes = false, currentUserId = null) {
  item.files = listFiles.all(item.id);
  item.player = playerKind(item.video_url);
  item.favorite = favIds.has(item.id);
  item.watched = seen.contents.has(item.id);

  if (item.type === 'serie') {
    // Le catalogue n'a besoin que du décompte ; la fiche, de la liste complète.
    const eps = listEpisodes.all(item.id);
    item.episodeCount = eps.length;
    item.seasonCount = new Set(eps.map((e) => e.season)).size;
    item.watchedCount = eps.filter((e) => seen.episodes.has(e.id)).length;
    if (withEpisodes) {
      const notes = new Map(listNotes.all(item.id).map((r) => [r.episode_id, r]));
      const miennes = new Map(
        listMesNotes.all(item.id, currentUserId).map((r) => [r.episode_id, r.score])
      );
      const commentaires = new Map(listCommentCounts.all(item.id).map((r) => [r.episode_id, r.n]));

      item.episodes = eps.map((e) => ({
        ...e,
        player: playerKind(e.video_url),
        watched: seen.episodes.has(e.id),
        // Chaque source porte son propre type de lecteur : un épisode peut
        // mélanger un fichier vidéo et des lecteurs externes.
        sources: listSources.all(e.id).map((s) => ({ ...s, player: playerKind(s.url) })),
        moyenne: notes.get(e.id)?.votants ? notes.get(e.id).moyenne : null,
        votants: notes.get(e.id)?.votants ?? 0,
        maNote: miennes.get(e.id) ?? null,
        commentaires: commentaires.get(e.id) ?? 0,
      }));
    }
  }
  return item;
}

// Identifiants vus par ce membre, pour marquer episodes et titres.
function watchedIds(userId) {
  const rows = db.prepare('SELECT content_id, episode_id FROM watched WHERE user_id = ?').all(userId);
  return {
    contents: new Set(rows.filter((r) => r.episode_id === null).map((r) => r.content_id)),
    episodes: new Set(rows.filter((r) => r.episode_id !== null).map((r) => r.episode_id)),
  };
}

function favoriteIds(userId) {
  return new Set(
    db.prepare('SELECT content_id FROM favorites WHERE user_id = ?').all(userId).map((r) => r.content_id)
  );
}

// Reprise de lecture : pour chaque serie commencee, le premier episode encore
// non vu, dans l'ordre saison puis numero.
//
// On ne se fie pas au « dernier episode vu » : watched_at n'a qu'une precision
// d'une seconde, donc deux episodes enchaines rapidement deviennent
// indistinguables et la reprise se trompe. Le premier trou dans la liste est
// une reponse deterministe, et c'est aussi ce qu'attend le membre.
function resumeRows(userId) {
  const commencees = db
    .prepare(
      `SELECT w.content_id, MAX(w.watched_at) AS dernier
       FROM watched w
       WHERE w.user_id = ? AND w.episode_id IS NOT NULL
       GROUP BY w.content_id
       ORDER BY dernier DESC`
    )
    .all(userId);

  const suivant = db.prepare(
    `SELECT e.id, e.season, e.number, e.title, e.thumbnail_url
     FROM episodes e
     WHERE e.content_id = ?
       AND e.id NOT IN (SELECT episode_id FROM watched
                        WHERE user_id = ? AND episode_id IS NOT NULL)
     ORDER BY e.season, e.number
     LIMIT 1`
  );

  const out = [];
  for (const serie of commencees) {
    const next = suivant.get(serie.content_id, userId);
    if (next) out.push({ content_id: serie.content_id, next });
  }
  return out;
}

router.get('/', (req, res) => {
  const favIds = favoriteIds(req.user.id);
  const seen = watchedIds(req.user.id);
  const rows = db
    .prepare('SELECT * FROM content ORDER BY sort_order, id DESC')
    .all()
    .map((r) => decorate(r, favIds, seen));

  const byId = new Map(rows.map((r) => [r.id, r]));
  const reprendre = resumeRows(req.user.id)
    .filter((r) => r.next && byId.has(r.content_id))
    .map((r) => ({ ...byId.get(r.content_id), resume: r.next }));

  // Le carrousel montre les titres mis en avant. Aucun de coche : on prend les
  // plus recents, pour qu'il ne soit jamais vide.
  const enAvant = rows.filter((r) => r.featured);
  const carrousel = (enAvant.length ? enAvant : rows.slice(0, 5)).slice(0, 8);

  // Genres reellement presents, avec leur nombre de titres. Construits ici
  // plutot que devines cote client : le client ne voit pas les titres filtres.
  const parGenre = new Map();
  for (const r of rows) {
    if (!r.genre) continue;
    parGenre.set(r.genre, (parGenre.get(r.genre) || 0) + 1);
  }
  const genres = [...parGenre.entries()]
    .map(([nom, total]) => ({ nom, total }))
    .sort((a, b) => b.total - a.total || a.nom.localeCompare(b.nom, 'fr'));

  res.json({
    // « featured » reste au singulier pour ne rien casser ; « carrousel » est
    // la liste complete.
    featured: carrousel[0] || null,
    carrousel,
    genres,
    reprendre,
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
  const seen = watchedIds(req.user.id);
  // Quelques titres proches, pour ne pas laisser la fiche se terminer sur rien.
  const similar = db
    .prepare(
      `SELECT * FROM content
       WHERE id <> ? AND (type = ? OR (genre IS NOT NULL AND genre = ?))
       ORDER BY (genre IS NOT NULL AND genre = ?) DESC, id DESC LIMIT 8`
    )
    .all(item.id, item.type, item.genre, item.genre)
    .map((r) => decorate(r, favIds, seen));

  res.json({ item: decorate(item, favIds, seen, true, req.user.id), similar });
});

// Marque un titre ou un episode comme vu, ou l'oublie. Un simple bascule.
router.post('/:id/watched', (req, res) => {
  const item = db.prepare('SELECT id, type FROM content WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Introuvable' });

  let episodeId = null;
  if (req.body.episodeId !== undefined && req.body.episodeId !== null) {
    const ep = db
      .prepare('SELECT id FROM episodes WHERE id = ? AND content_id = ?')
      .get(req.body.episodeId, item.id);
    if (!ep) return res.status(400).json({ error: 'Cet épisode n’appartient pas à ce titre.' });
    episodeId = ep.id;
  }

  const already = db
    .prepare(
      'SELECT 1 FROM watched WHERE user_id = ? AND content_id = ? AND COALESCE(episode_id, 0) = ?'
    )
    .get(req.user.id, item.id, episodeId ?? 0);

  if (already && req.body.watched !== true) {
    db.prepare(
      'DELETE FROM watched WHERE user_id = ? AND content_id = ? AND COALESCE(episode_id, 0) = ?'
    ).run(req.user.id, item.id, episodeId ?? 0);
    return res.json({ ok: true, watched: false });
  }

  db.prepare(
    `INSERT INTO watched (user_id, content_id, episode_id) VALUES (?, ?, ?)
     ON CONFLICT DO UPDATE SET watched_at = strftime('%Y-%m-%d %H:%M:%f', 'now')`
  ).run(req.user.id, item.id, episodeId);
  res.json({ ok: true, watched: true });
});

// Marque ou démarque une saison entière d'un coup.
//
// Une seule transaction : sur une saison de vingt-cinq épisodes, vingt-cinq
// requêtes séparées laisseraient l'interface à moitié à jour si le réseau
// lâchait en cours de route.
router.post('/:id/watched-season', (req, res) => {
  const item = db.prepare('SELECT id, type FROM content WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Introuvable' });
  if (item.type !== 'serie')
    return res.status(400).json({ error: 'Seules les séries ont des saisons.' });

  const season = Number(req.body.season);
  if (!Number.isInteger(season)) return res.status(400).json({ error: 'Saison invalide.' });

  const episodes = db
    .prepare('SELECT id FROM episodes WHERE content_id = ? AND season = ?')
    .all(item.id, season);
  if (!episodes.length) return res.status(404).json({ error: 'Cette saison n’a aucun épisode.' });

  const watched = req.body.watched !== false;

  const marquer = db.prepare(
    `INSERT INTO watched (user_id, content_id, episode_id) VALUES (?, ?, ?)
     ON CONFLICT DO UPDATE SET watched_at = strftime('%Y-%m-%d %H:%M:%f', 'now')`
  );
  const oublier = db.prepare(
    'DELETE FROM watched WHERE user_id = ? AND content_id = ? AND episode_id = ?'
  );

  db.exec('BEGIN');
  try {
    for (const e of episodes) {
      if (watched) marquer.run(req.user.id, item.id, e.id);
      else oublier.run(req.user.id, item.id, e.id);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  res.json({ ok: true, watched, season, episodes: episodes.map((e) => e.id) });
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
