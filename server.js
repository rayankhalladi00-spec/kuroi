require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const SqliteSessionStore = require('./session-store');
const { embedHosts, embedHostsVersion } = require('./lib/embed');

const { loadUser, requireAuth, requireAdmin } = require('./middleware/auth');
const ensureAdmin = require('./scripts/ensure-admin');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
// En production on n'écoute que sur la boucle locale : Nginx fait le pont vers
// l'extérieur et gère le HTTPS.
const HOST = process.env.HOST || '127.0.0.1';
const PROD = process.env.NODE_ENV === 'production';
const STARTED_AT = new Date().toISOString();

// Empreinte des fichiers statiques, telle qu'inscrite dans les pages par
// scripts/stamp-assets.js. Sert de numero de version du deploiement.
const ASSET_STAMP = (() => {
  try {
    const html = require('fs').readFileSync(path.join(__dirname, 'public', 'login.html'), 'utf8');
    return html.match(/style\.css\?v=([a-f0-9]+)/)?.[1] || 'inconnu';
  } catch {
    return 'inconnu';
  }
})();

// Le cookie de session ne peut porter l'attribut « Secure » que si le site est
// servi en HTTPS : sinon le navigateur le rejette en silence et personne ne
// reste connecte. Tant que le domaine et le certificat ne sont pas en place,
// mettre COOKIE_SECURE=false dans .env, puis repasser a true apres certbot.
const COOKIE_SECURE =
  process.env.COOKIE_SECURE === undefined
    ? PROD
    : process.env.COOKIE_SECURE === 'true';

if (!process.env.SESSION_SECRET && PROD) {
  console.error('FATAL: SESSION_SECRET manquant dans .env');
  process.exit(1);
}

// Derrière Nginx : nécessaire pour les cookies secure et le rate-limit par IP.
app.set('trust proxy', 1);

// La CSP est gérée à part : la liste des lecteurs autorisés dépend du
// catalogue, or helmet attend des directives figées.
//
// referrerPolicy : helmet pose « no-referrer » par défaut, et c'est ce réglage
// qui empêchait les lecteurs vidéo de fonctionner sur iPhone.
//
// Safari sur iOS propage la politique de la page de départ à la page vers
// laquelle on navigue, et aux iframes. Une page d'hébergeur ouverte depuis
// Kuroi héritait donc de « no-referrer » : sa propre requête vers son flux
// vidéo partait sans Referer, et l'hébergeur la refusait (mesuré : 403 sans
// Referer, 302 avec). Le même lecteur ouvert depuis un site qui laisse la
// politique par défaut fonctionnait, sur le même téléphone.
//
// « strict-origin-when-cross-origin » est la valeur par défaut des navigateurs
// modernes : elle envoie l'adresse complète en même origine — ce dont le
// lecteur a besoin — et seulement l'origine vers l'extérieur, jamais le chemin.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

// Lecteurs autorisés : Google Drive, plus les domaines réellement utilisés par
// le catalogue — on n'ouvre que le strict nécessaire. L'en-tête n'est
// reconstruit que lorsque le contenu change.
let cspCache = { version: -1, middleware: null };

app.use(function contentSecurityPolicy(req, res, next) {
  const version = embedHostsVersion();
  if (version !== cspCache.version) {
    cspCache = {
      version,
      middleware: helmet.contentSecurityPolicy({
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
          mediaSrc: ["'self'", 'https:', 'blob:'],
          frameSrc: [
            "'self'",
            'https://drive.google.com',
            'https://*.google.com',
            ...embedHosts(),
          ],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"],
        },
      }),
    };
  }
  return cspCache.middleware(req, res, next);
});

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
      secure: COOKIE_SECURE,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours
    },
  })
);

app.use(loadUser);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/content', require('./routes/content'));
app.use('/api/files', require('./routes/files'));
app.use('/api/suggestions', require('./routes/suggestions'));
app.use('/api/history', require('./routes/history'));
app.use('/api/episodes', require('./routes/episodes').router);
app.use('/api/admin', require('./routes/admin'));

// Page admin protégée côté serveur, pas seulement côté client.
app.get('/admin', requireAdmin, (req, res) =>
  res.sendFile(path.join(__dirname, 'private', 'admin.html'))
);

// Les navigateurs reclament ces adresses d'eux-memes, meme quand la page
// designe une autre icone. Sans elles, chaque visite laisse des 404.
for (const alias of ['/favicon.ico', '/apple-touch-icon.png', '/apple-touch-icon-precomposed.png']) {
  app.get(alias, (req, res) => {
    res.type('image/png');
    res.sendFile(path.join(__dirname, 'public', 'favicon-32.png'));
  });
}

// Permet de verifier que le processus en cours execute bien le code deploye :
// un deploiement interrompu avant le redemarrage laisse sinon l'ancien code en
// memoire, avec des fichiers a jour sur le disque et des routes manquantes.
app.get('/api/health', (req, res) =>
  res.json({ ok: true, startedAt: STARTED_AT, assets: ASSET_STAMP })
);

// Photos de profil envoyees depuis l'administration. Elles vivent dans data/,
// hors de l'arborescence statique : le service n'a le droit d'ecrire que la.
app.get('/api/avatars/:file', (req, res) => {
  const nom = path.basename(req.params.file); // jamais de chemin remontant
  res.sendFile(path.join(require('./lib/avatars').DIR_ENVOYEES, nom), (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
});

// Images d'episode envoyees depuis l'administration, comme les photos de
// profil : hors de l'arborescence statique, servies une par une.
// requireAuth : le catalogue est prive, et une affiche est deja protegee de la
// meme facon. Sans lui, l'adresse d'une image suffirait a la voir sans compte.
app.get('/api/episode-images/:file', requireAuth, (req, res) => {
  const nom = path.basename(req.params.file); // jamais de chemin remontant
  res.sendFile(path.join(require('./lib/uploads').EPISODE_DIR, nom), (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Route inconnue' });
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

if (PROD && !COOKIE_SECURE) {
  console.warn('ATTENTION : COOKIE_SECURE=false, les sessions circulent en clair.');
  console.warn("            À n'utiliser que le temps d'installer le HTTPS :");
  console.warn('            certbot --nginx -d ton-domaine.com, puis repasser à true.');
}

ensureAdmin();

app.listen(PORT, HOST, () => {
  console.log(`Kuroi démarré sur http://${HOST}:${PORT} (${PROD ? 'production' : 'dev'})`);
});
