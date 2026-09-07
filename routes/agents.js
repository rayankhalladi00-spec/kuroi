// Messagerie entre les agents qui travaillent sur le site.
//
// Elle ne passe pas par les comptes des membres : un agent n'est pas un
// visiteur du catalogue. Il s'authentifie avec un jeton partagé, envoyé dans
// l'en-tête Authorization, et rien d'autre ne donne accès à ces échanges — ni
// une session de membre, ni même un compte administrateur.
//
// Le jeton vit dans .env, jamais dans le dépôt : celui-ci est public.
// Sans AGENT_TOKEN configuré, les routes répondent 503 plutôt que de s'ouvrir.
const express = require('express');
const crypto = require('crypto');
const { db } = require('../db');

const router = express.Router();

const MAX_MESSAGE = 4000;
const MAX_LISTE = 200;

function jeton() {
  const t = process.env.AGENT_TOKEN;
  return t && t.length >= 16 ? t : null;
}

// Comparaison à durée constante : une comparaison ordinaire laisse deviner le
// jeton caractère par caractère en mesurant le temps de réponse.
function jetonValide(fourni) {
  const attendu = jeton();
  if (!attendu || !fourni) return false;
  const a = Buffer.from(attendu);
  const b = Buffer.from(fourni);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

router.use((req, res, next) => {
  if (!jeton())
    return res.status(503).json({
      error: 'Messagerie des agents désactivée : AGENT_TOKEN absent de .env.',
    });

  const entete = req.get('authorization') || '';
  const fourni = entete.startsWith('Bearer ') ? entete.slice(7).trim() : null;
  if (!jetonValide(fourni)) return res.status(401).json({ error: 'Jeton invalide.' });

  next();
});

// Les messages, du plus ancien au plus récent — on lit une conversation dans
// l'ordre où elle s'est tenue. « depuis » ne renvoie que ce qui a suivi.
router.get('/messages', (req, res) => {
  const depuis = Number(req.query.depuis || 0);
  const limite = Math.min(Number(req.query.limite || 50), MAX_LISTE);

  const messages = db
    .prepare(
      `SELECT id, agent, body, created_at FROM agent_messages
       WHERE id > ? ORDER BY id DESC LIMIT ?`
    )
    .all(Number.isFinite(depuis) ? depuis : 0, limite)
    .reverse();

  const dernier = db.prepare('SELECT COALESCE(MAX(id), 0) AS n FROM agent_messages').get().n;
  res.json({ messages, dernier });
});

router.post('/messages', (req, res) => {
  const agent = String(req.body.agent || '').trim().slice(0, 60);
  const body = String(req.body.body || '').trim().slice(0, MAX_MESSAGE);

  if (!agent) return res.status(400).json({ error: 'Nom de l’agent manquant.' });
  if (!body) return res.status(400).json({ error: 'Message vide.' });

  const info = db
    .prepare('INSERT INTO agent_messages (agent, body) VALUES (?, ?)')
    .run(agent, body);

  res.json({
    ok: true,
    message: db
      .prepare('SELECT id, agent, body, created_at FROM agent_messages WHERE id = ?')
      .get(Number(info.lastInsertRowid)),
  });
});

module.exports = router;
