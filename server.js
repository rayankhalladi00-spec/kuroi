require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const SqliteSessionStore = require('./session-store');

const { loadUser, requireAdmin } = require('./middleware/auth');
const ensureAdmin = require('./scripts/ensure-admin');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
// En production on n'écoute que sur la boucle locale : Nginx fait le pont vers
// l'extérieur et gère le HTTPS.
const HOST = process.env.HOST || '127.0.0.1';
const PROD = process.env.NODE_ENV === 'production';

if (!process.env.SESSION_SECRET && PROD) {
  console.error('FATAL: SESSION_SECRET manquant dans .env');
  process.exit(1);
}

// Derrière Nginx : nécessaire pour les cookies secure et le rate-limit par IP.
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        mediaSrc: ["'self'", 'https:', 'blob:'],
        // Lecteur Google Drive intégré
        frameSrc: ["'self'", 'https://drive.google.com', 'https://*.google.com'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));

app.use(
  session({
    store: new SqliteSessionStore(),
    name: 'kuroi.sid',
    secret: process.env.SESSION_SECRET || 'dev-secret-non-securise',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: PROD,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours
    },
  })
);

app.use(loadUser);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/content', require('./routes/content'));
app.use('/api/admin', require('./routes/admin'));

// Page admin protégée côté serveur, pas seulement côté client.
app.get('/admin', requireAdmin, (req, res) =>
  res.sendFile(path.join(__dirname, 'private', 'admin.html'))
);

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Route inconnue' });
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

ensureAdmin();

app.listen(PORT, HOST, () => {
  console.log(`Kuroi démarré sur http://${HOST}:${PORT} (${PROD ? 'production' : 'dev'})`);
});
