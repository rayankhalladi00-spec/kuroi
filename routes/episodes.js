const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const avatars = require('../lib/avatars');

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

// Le role et la photo viennent de la table users, pas d'une copie figee :
// promouvoir quelqu'un ou lui changer sa photo doit se voir aussi sur ses
// anciens messages.
const LISTE_COMMENTAIRES = `
  SELECT c.id, c.parent_id, c.author, c.body, c.created_at, c.user_id,
         u.role AS author_role, u.avatar AS author_avatar,
         (SELECT COUNT(*) FROM comment_likes l WHERE l.comment_id = c.id)                  AS likes,
         EXISTS(SELECT 1 FROM comment_likes l WHERE l.comment_id = c.id AND l.user_id = ?) AS liked
  FROM episode_comments c
  LEFT JOIN users u ON u.id = c.user_id
  WHERE c.episode_id = ?`;

const UN_COMMENTAIRE = `
  SELECT c.id, c.parent_id, c.author, c.body, c.created_at, c.user_id,
         u.role AS author_role, u.avatar AS author_avatar,
         0 AS likes, 0 AS liked
  FROM episode_comments c
  LEFT JOIN users u ON u.id = c.user_id
  WHERE c.id = ?`;

// Les photos sont relues du disque a chaque appel : on ne le fait qu'une fois
// par requete, pas une fois par commentaire.
function habiller(rows) {
  const urls = new Map(avatars.list().map((a) => [a.id, a.url]));
  return rows.map(({ author_avatar, ...c }) => ({
    ...c,
    liked: !!c.liked,
    avatarUrl: author_avatar ? urls.get(author_avatar) ?? null : null,
  }));
}

// Un seul niveau de reponses : les racines du plus recent au plus ancien, et
// sous chacune ses reponses dans l'ordre ou elles ont ete ecrites.
function enFils(plats) {
  const parId = new Map(plats.map((c) => [c.id, { ...c, replies: [] }]));
  const racines = [];
  for (const c of parId.values()) {
    const parent = c.parent_id ? parId.get(c.parent_id) : null;
    if (parent) parent.replies.push(c);
    else racines.push(c);
  }
  racines.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  for (const r of racines) r.replies.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  return racines;
}

router.get('/:id/comments', (req, res) => {
  if (!episodeExiste(req.params.id)) return res.status(404).json({ error: 'Épisode introuvable' });
  const plats = habiller(
    db.prepare(LISTE_COMMENTAIRES).all(req.user.id, Number(req.params.id))
  );
  res.json({ comments: enFils(plats) });
});

router.post('/:id/comments', (req, res) => {
  if (!episodeExiste(req.params.id)) return res.status(404).json({ error: 'Épisode introuvable' });

  const body = String(req.body.body || '').trim().slice(0, MAX_COMMENTAIRE);
  if (!body) return res.status(400).json({ error: 'Le commentaire est vide.' });

  // Une reponse doit viser un commentaire du meme episode. Repondre a une
  // reponse rattache la nouvelle au message d'origine : un seul niveau, sinon
  // l'affichage part en escalier.
  let parentId = null;
  if (req.body.parentId != null && req.body.parentId !== '') {
    const parent = db
      .prepare('SELECT id, parent_id, episode_id FROM episode_comments WHERE id = ?')
      .get(Number(req.body.parentId));
    if (!parent || parent.episode_id !== Number(req.params.id))
      return res.status(400).json({ error: 'Ce commentaire n’appartient pas à cet épisode.' });
    parentId = parent.parent_id ?? parent.id;
  }

  const info = db
    .prepare(
      'INSERT INTO episode_comments (episode_id, user_id, parent_id, author, body) VALUES (?, ?, ?, ?, ?)'
    )
    .run(Number(req.params.id), req.user.id, parentId, req.user.username, body);

  const [ajoute] = habiller([db.prepare(UN_COMMENTAIRE).get(Number(info.lastInsertRowid))]);
  res.json({ ok: true, comment: { ...ajoute, replies: [] } });
});

// Un membre efface les siens ; un administrateur efface n'importe lequel.
router.delete('/comments/:commentId', (req, res) => {
  const c = db
    .prepare('SELECT id, user_id FROM episode_comments WHERE id = ?')
    .get(req.params.commentId);
  if (!c) return res.status(404).json({ error: 'Commentaire introuvable' });

  if (c.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Ce commentaire n’est pas le tien.' });

  // La colonne parent_id a ete ajoutee par migration : SQLite n'y attache pas
  // de cascade apres coup, les reponses sont donc effacees explicitement.
  const reponses = db
    .prepare('SELECT id FROM episode_comments WHERE parent_id = ?')
    .all(c.id)
    .map((r) => r.id);

  db.exec('BEGIN');
  try {
    for (const id of [...reponses, c.id]) {
      db.prepare('DELETE FROM comment_likes WHERE comment_id = ?').run(id);
      db.prepare('DELETE FROM episode_comments WHERE id = ?').run(id);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  res.json({ ok: true, supprimes: reponses.length + 1 });
});

// « J'aime » : un simple bascule, une voix par membre.
router.post('/comments/:commentId/like', (req, res) => {
  const id = Number(req.params.commentId);
  if (!db.prepare('SELECT id FROM episode_comments WHERE id = ?').get(id))
    return res.status(404).json({ error: 'Commentaire introuvable' });

  const deja = db
    .prepare('SELECT 1 FROM comment_likes WHERE comment_id = ? AND user_id = ?')
    .get(id, req.user.id);

  if (deja)
    db.prepare('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?').run(id, req.user.id);
  else db.prepare('INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)').run(id, req.user.id);

  const likes = db
    .prepare('SELECT COUNT(*) AS n FROM comment_likes WHERE comment_id = ?')
    .get(id).n;
  res.json({ ok: true, liked: !deja, likes });
});

module.exports = { router, noteDe };
