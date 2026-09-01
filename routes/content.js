const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM content ORDER BY sort_order, id DESC')
    .all();

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
  res.json({ item });
});

module.exports = router;
