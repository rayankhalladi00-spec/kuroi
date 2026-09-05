// Instance jetable pour reproduire l'accueil. Non destinee au depot.
process.env.DATA_DIR = process.env.VERIF_DIR;
process.env.PORT = '34599';
process.env.SESSION_SECRET = 'verification-locale';
process.env.NODE_ENV = 'development';

const bcrypt = require('bcryptjs');
const { db } = require('./db');

db.prepare(
  "INSERT INTO users (username, email, password_hash, role) VALUES ('chef','chef@test.local',?,'admin')"
).run(bcrypt.hashSync(process.env.VERIF_MDP, 10));

const img = (id, w, h) => `https://picsum.photos/id/${id}/${w}/${h}`;

function titre(nom, genre, avecPaysage, enAvant) {
  return Number(
    db
      .prepare(
        `INSERT INTO content (type, title, description, year, genre, backdrop_url, poster_url, featured)
         VALUES ('serie', ?, ?, 2024, ?, ?, ?, ?)`
      )
      .run(
        nom,
        'Une série de contrôle pour vérifier la mise en page de l’accueil.',
        genre,
        avecPaysage ? img(1015, 1600, 900) : null,
        img(30 + (nom.length % 40), 400, 600),
        enAvant ? 1 : 0
      ).lastInsertRowid
  );
}

// Comme chez Rayan : des affiches partout, mais aucune image en paysage.
const a = titre('Sans image en paysage', 'Action', false, true);
titre('Deuxième à la une', 'Romance', false, true);
titre('Avec image en paysage', 'Aventure', true, true);
for (const [n, g] of [
  ['Comédie du soir', 'Comédie'],
  ['Frissons', 'Horreur'],
  ['Enquête', 'Policier'],
  ['Romance d’été', 'Romance'],
  ['Combat', 'Action'],
]) titre(n, g, false, false);

const eps = [];
for (let n = 1; n <= 6; n++) {
  eps.push(
    Number(
      db
        .prepare(
          `INSERT INTO episodes (content_id, season, number, title, video_url)
           VALUES (?, 1, ?, ?, ?)`
        )
        .run(a, n, 'Épisode ' + n, 'https://lecteur.example.com/e' + n).lastInsertRowid
    )
  );
}
db.prepare('INSERT INTO watched (user_id, content_id, episode_id) VALUES (1, ?, ?)').run(a, eps[0]);

// Contournement LOCAL de l'authentification : l'automatisation du navigateur
// n'arrive pas a soumettre le formulaire de connexion, et je ne saisis pas de
// mot de passe. On remplace donc les gardes par un membre fixe, uniquement
// dans cette instance jetable. Ce fichier n'est pas dans le depot.
const auth = require('./middleware/auth');
const membre = db.prepare('SELECT * FROM users WHERE id = 1').get();
auth.loadUser = (req, _res, next) => { req.user = membre; next(); };
auth.requireAuth = (req, _res, next) => { req.user = membre; next(); };
auth.requireAdmin = (req, _res, next) => { req.user = membre; next(); };

console.log('pret (authentification court-circuitee en local)');
require('./server.js');
