const express = require('express');
const path = require('path');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { UPLOAD_DIR, mimeForImage } = require('../lib/uploads');

const router = express.Router();

// Ni les pièces jointes ni les affiches ne sont exposées en statique :
// data/uploads n'est servi que par ces deux routes, réservées aux membres.
router.use(requireAuth);

function getFile(req, res) {
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!file) {
    res.status(404).json({ error: 'Fichier introuvable' });
    return null;
  }
  return file;
}

// Affichage en ligne — utilisé par les balises <img> des affiches.
router.get('/:id/view', (req, res) => {
  const file = getFile(req, res);
  if (!file) return;

  res.type(file.mime || mimeForImage(file.original_name));
  // Le contenu d'un identifiant donné ne change jamais : on peut le garder
  // longtemps en cache, mais uniquement dans le navigateur du membre.
  res.setHeader('Cache-Control', 'private, max-age=604800');
  res.sendFile(path.join(UPLOAD_DIR, file.stored_name), (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
});

// Téléchargement, avec le nom d'origine.
router.get('/:id', (req, res) => {
  const file = getFile(req, res);
  if (!file) return;

  res.download(path.join(UPLOAD_DIR, file.stored_name), file.original_name, (err) => {
    if (err && !res.headersSent) {
      console.error('téléchargement :', err.message);
      res.status(404).json({ error: 'Fichier absent du disque' });
    }
  });
});

module.exports = router;
