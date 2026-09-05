// Test de bout en bout : démarre le serveur sur une base jetable et vérifie
// l'inscription, la connexion, les droits, le bannissement et le CRUD contenu.
//   node scripts/smoke-test.js
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 34517;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'kuroi-smoke-'));

let passed = 0;
let failed = 0;

function check(name, cond, extra = '') {
  if (cond) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name} ${extra}`);
  }
}

// Petit "cookie jar" par client.
function client() {
  const jar = new Map();
  return async function call(method, url, body) {
    const multipart = body instanceof FormData;
    const headers = multipart ? {} : { 'Content-Type': 'application/json' };
    if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(BASE + url, {
      method,
      headers,
      body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
      redirect: 'manual',
    });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    let data = null;
    const text = await res.text();
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  };
}

async function waitForServer(proc) {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(BASE + '/api/auth/me');
      if (r.status) return;
    } catch {
      if (proc.exitCode !== null) throw new Error('le serveur s\'est arrêté au démarrage');
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error('le serveur n\'a pas démarré');
}

(async function main() {
  const server = spawn(
    process.execPath,
    [path.join(__dirname, '..', 'server.js')],
    {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: String(PORT),
        HOST: '127.0.0.1',
        DATA_DIR,
        SESSION_SECRET: 'secret-de-test',
        ADMIN_USERNAME: 'root_admin',
        ADMIN_EMAIL: 'admin@test.local',
        ADMIN_PASSWORD: 'MotDePasseAdmin123',
        // La suite fait bien plus de 10 connexions légitimes ; le seuil réel
        // est vérifié pour de vrai en fin de parcours.
        LOGIN_RATE_LIMIT: '60',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  let serverLog = '';
  server.stdout.on('data', (d) => (serverLog += d));
  server.stderr.on('data', (d) => (serverLog += d));

  try {
    await waitForServer(server);

    const admin = client();
    const alice = client();
    const anon = client();

    console.log('\n— Authentification');
    check('anonyme rejeté sur /api/content', (await anon('GET', '/api/content')).status === 401);
    check('anonyme rejeté sur /api/admin/users', (await anon('GET', '/api/admin/users')).status === 401);

    let r = await admin('POST', '/api/auth/login', {
      identifier: 'root_admin',
      password: 'MotDePasseAdmin123',
    });
    check('connexion admin', r.status === 200 && r.data.user.role === 'admin', JSON.stringify(r.data));

    r = await admin('POST', '/api/auth/login', { identifier: 'root_admin', password: 'mauvais' });
    check('mauvais mot de passe refusé', r.status === 401);

    // Un seul identifiant suffit, et les deux chemins doivent marcher : le
    // pseudo comme l'e-mail. Seul le premier était couvert jusqu'ici.
    check('connexion par e-mail',
      (await client()('POST', '/api/auth/login', {
        identifier: 'admin@test.local', password: 'MotDePasseAdmin123',
      })).status === 200);
    check('e-mail insensible à la casse',
      (await client()('POST', '/api/auth/login', {
        identifier: 'Admin@Test.Local', password: 'MotDePasseAdmin123',
      })).status === 200);
    check('identifiant vide refusé',
      (await client()('POST', '/api/auth/login', { password: 'MotDePasseAdmin123' })).status === 400);

    // Sans cookie, la connexion renvoie 200 mais personne ne reste connecté :
    // c'est exactement ce qui arrive si « Secure » est exigé sans HTTPS.
    {
      const res = await fetch(BASE + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'root_admin', password: 'MotDePasseAdmin123' }),
      });
      const cookies = res.headers.getSetCookie?.() ?? [];
      check('un cookie de session est bien émis', cookies.some((c) => c.startsWith('kuroi.sid=')),
        JSON.stringify(cookies));
      check('cookie httpOnly', cookies.some((c) => /httponly/i.test(c)));
    }

    r = await alice('POST', '/api/auth/register', {
      username: 'alice',
      email: 'alice@test.local',
      password: 'MotDePasseAlice1',
    });
    check('inscription alice', r.status === 200 && r.data.user.role === 'user', JSON.stringify(r.data));

    r = await alice('POST', '/api/auth/register', {
      username: 'alice',
      email: 'autre@test.local',
      password: 'MotDePasseAlice1',
    });
    check('pseudo en double refusé', r.status === 409);

    r = await alice('POST', '/api/auth/register', {
      username: 'bob',
      email: 'bob@test.local',
      password: 'court',
    });
    check('mot de passe trop court refusé', r.status === 400);

    // Le mot de passe d'un compte ne doit pas ouvrir celui d'un autre.
    check('identifiant et mot de passe de comptes différents refusés',
      (await client()('POST', '/api/auth/login', {
        identifier: 'alice', password: 'MotDePasseAdmin123',
      })).status === 401);

    console.log('\n— Cloisonnement des droits');
    check('alice bloquée sur /api/admin/users', (await alice('GET', '/api/admin/users')).status === 403);
    check('alice bloquée sur /admin', (await alice('GET', '/admin')).status === 403);
    check('alice accède au catalogue', (await alice('GET', '/api/content')).status === 200);
    check('admin accède à /admin', (await admin('GET', '/admin')).status === 200);

    console.log('\n— Contenu');
    r = await admin('POST', '/api/admin/content', {
      type: 'film',
      title: 'Mon Film',
      description: 'Un test',
      video_url: 'https://drive.google.com/file/d/ABC123/view?usp=sharing',
      year: 2024,
      genre: 'Action',
      featured: 1,
    });
    check('ajout film', r.status === 200 && r.data.id > 0, JSON.stringify(r.data));
    const filmId = r.data.id;

    r = await admin('POST', '/api/admin/content', {
      type: 'jeu',
      title: 'Mon Jeu',
      external_url: 'https://drive.google.com/drive/folders/XYZ',
    });
    check('ajout jeu', r.status === 200);

    r = await admin('POST', '/api/admin/content', { type: 'film', title: '' });
    check('titre vide refusé', r.status === 400);
    r = await admin('POST', '/api/admin/content', { type: 'bidon', title: 'X' });
    check('type invalide refusé', r.status === 400);

    r = await alice('GET', '/api/content');
    check('alice voit 1 film et 1 jeu', r.data.films.length === 1 && r.data.jeux.length === 1);
    check('film à la une exposé', r.data.featured?.title === 'Mon Film');

    r = await admin('PUT', '/api/admin/content/' + filmId, { title: 'Mon Film v2' });
    check('modification film', r.status === 200);
    r = await alice('GET', '/api/content/' + filmId);
    check('titre modifié visible', r.data.item.title === 'Mon Film v2', JSON.stringify(r.data));

    check('alice ne peut pas ajouter de contenu',
      (await alice('POST', '/api/admin/content', { type: 'film', title: 'Pirate' })).status === 403);

    console.log("\n— Code d'intégration des lecteurs");
    {
      // Ce que colle réellement un administrateur : tout le bloc <iframe>.
      r = await admin('POST', '/api/admin/content', {
        type: 'film',
        title: 'Film intégré',
        video_url:
          '<iframe src="https://lecteur.example.com/e/xyz789" width="640" height="360" frameborder="0" allowfullscreen></iframe>',
      });
      check("code d'intégration accepté", r.status === 200, JSON.stringify(r.data));
      const embedded = r.data.id;

      r = await alice('GET', '/api/content/' + embedded);
      check("seule l'adresse est conservée",
        r.data.item.video_url === 'https://lecteur.example.com/e/xyz789', r.data.item.video_url);
      check('aucun HTML stocké en base', !/[<>]/.test(r.data.item.video_url || ''));
      check('lecteur externe détecté', r.data.item.player === 'embed');

      // Une adresse en http est basculée en https, sinon le navigateur la bloque.
      r = await admin('PUT', '/api/admin/content/' + embedded, {
        video_url: '<iframe src="http://lecteur.example.com/e/abc"></iframe>',
      });
      check('http basculé en https', r.status === 200 && /passé en https/.test(r.data.notice || ''),
        JSON.stringify(r.data));

      // Adresse relative au protocole, très courante dans les codes fournis.
      r = await admin('PUT', '/api/admin/content/' + embedded, {
        video_url: '<iframe src="//lecteur.example.com/e/rel"></iframe>',
      });
      r = await alice('GET', '/api/content/' + embedded);
      check('adresse //… complétée en https',
        r.data.item.video_url === 'https://lecteur.example.com/e/rel', r.data.item.video_url);

      // Plusieurs hébergeurs, dont sibnet, fournissent leur code sans
      // guillemets autour de src. L'exiger faisait rejeter leur intégration
      // telle qu'ils la donnent.
      r = await admin('POST', '/api/admin/content', {
        type: 'film',
        title: 'Code sans guillemets',
        video_url: '<iframe width=640 height=360 src=http://lecteur.example.com/e/nu&share=1></iframe>',
      });
      check('code d’intégration sans guillemets accepté', r.status === 200, JSON.stringify(r.data));
      check('adresse extraite, paramètres conservés, http élevé en https',
        (await admin('GET', '/api/admin/content')).data.content.find((c) => c.id === r.data.id)
          ?.video_url === 'https://lecteur.example.com/e/nu&share=1');
      await admin('DELETE', '/api/admin/content/' + r.data.id);

      check('script déguisé en lecteur refusé',
        (await admin('PUT', '/api/admin/content/' + embedded, {
          video_url: '<script>alert(1)</script>',
        })).status === 400);
      check('adresse javascript: refusée',
        (await admin('PUT', '/api/admin/content/' + embedded, {
          video_url: 'javascript:alert(1)',
        })).status === 400);

      check('fichier .mp4 reconnu comme vidéo directe',
        (await admin('PUT', '/api/admin/content/' + embedded, {
          video_url: 'https://exemple.com/film.mp4',
        })).status === 200 &&
        (await alice('GET', '/api/content/' + embedded)).data.item.player === 'video');

      // Le domaine du lecteur doit être autorisé par la politique de sécurité.
      const page = await fetch(BASE + '/login.html');
      check('domaine du lecteur autorisé dans la CSP',
        (page.headers.get('content-security-policy') || '').includes('exemple.com'),
        page.headers.get('content-security-policy'));

      await admin('DELETE', '/api/admin/content/' + embedded);
    }

    console.log('\n— Épisodes de série');
    {
      const serieId = (await admin('POST', '/api/admin/content', {
        type: 'serie', title: 'Ma Série', year: 2025, genre: 'Aventure',
      })).data.id;

      r = await admin('POST', `/api/admin/content/${serieId}/episodes`, {
        season: 1, number: 1, title: 'Le début',
        video_url: '<iframe src="https://lecteur.example.com/e/s1e1"></iframe>',
        synopsis: 'Tout commence ici.',
      });
      check('ajout d’un épisode', r.status === 200 && r.data.episode.id > 0, JSON.stringify(r.data));
      check('lecteur de l’épisode extrait du code',
        r.data.episode.video_url === 'https://lecteur.example.com/e/s1e1', r.data.episode.video_url);
      const epId = r.data.episode.id;

      await admin('POST', `/api/admin/content/${serieId}/episodes`, { season: 1, number: 2, title: 'La suite' });
      await admin('POST', `/api/admin/content/${serieId}/episodes`, { season: 2, number: 1, title: 'Nouvelle saison' });

      check('doublon saison/numéro refusé',
        (await admin('POST', `/api/admin/content/${serieId}/episodes`, { season: 1, number: 1 })).status === 409);
      check('numéro invalide refusé',
        (await admin('POST', `/api/admin/content/${serieId}/episodes`, { season: 1, number: 0 })).status === 400);
      check('épisode refusé sur un film',
        (await admin('POST', `/api/admin/content/${filmId}/episodes`, { season: 1, number: 1 })).status === 400);
      check('un membre ne peut pas ajouter d’épisode',
        (await alice('POST', `/api/admin/content/${serieId}/episodes`, { season: 3, number: 1 })).status === 403);

      r = await alice('GET', '/api/content/' + serieId);
      check('les épisodes sont visibles par un membre', r.data.item.episodes?.length === 3,
        JSON.stringify(r.data.item.episodes?.length));
      // Avancement du remplissage : sur des milliers d'épisodes, c'est le seul
      // moyen de savoir ce qui attend encore un lecteur.
      {
        const liste = (await admin('GET', '/api/admin/content')).data.content;
        const s = liste.find((c) => c.id === serieId);
        // On compare au vrai contenu plutôt qu'à un chiffre écrit en dur : le
        // nombre d'épisodes de cette série change au fil du parcours de test.
        const reels = (await admin('GET', `/api/admin/content/${serieId}/episodes`)).data.episodes;
        check('la fiche annonce son nombre d’épisodes', s.episodeCount === reels.length,
          `${s.episodeCount} annoncés pour ${reels.length} réels`);
        check('elle compte ceux qui ont un lecteur',
          s.episodesAvecLecteur === reels.filter((e) => e.video_url).length,
          String(s.episodesAvecLecteur));
        check('elle désigne le premier épisode sans lecteur',
          Number.isInteger(s.premierEpisodeSansLecteur), String(s.premierEpisodeSansLecteur));

        const film = liste.find((c) => c.id === filmId);
        check('un film n’a pas de décompte d’épisodes', film.episodeCount === 0);
      }

      check('épisodes triés par saison puis numéro',
        r.data.item.episodes.map((e) => `${e.season}-${e.number}`).join(',') === '1-1,1-2,2-1');
      check('décompte des saisons', r.data.item.seasonCount === 2 && r.data.item.episodeCount === 3);
      check('type de lecteur fourni par épisode', r.data.item.episodes[0].player === 'embed');

      // Le domaine d'un lecteur d'épisode doit être autorisé, sinon la lecture
      // est bloquée par la politique de sécurité.
      const csp = (await fetch(BASE + '/login.html')).headers.get('content-security-policy') || '';
      check('domaine du lecteur d’épisode autorisé par la CSP',
        csp.includes('lecteur.example.com'), csp.slice(0, 200));

      r = await admin('PUT', '/api/admin/episodes/' + epId, { title: 'Le vrai début' });
      check('modification d’un épisode', r.status === 200 && r.data.episode.title === 'Le vrai début');

      // Plusieurs lecteurs par épisode : un hébergeur qui échoue sur un
      // appareil doit pouvoir être doublé par un autre.
      {
        r = await admin('PUT', '/api/admin/episodes/' + epId, {
          sources: 'https://lecteur2.example.com/a\n<iframe src="https://lecteur3.example.com/b"></iframe>',
        });
        check('lecteurs supplémentaires enregistrés', r.data.sources?.length === 2,
          JSON.stringify(r.data.sources));
        check('le code d’intégration est réduit à son adresse',
          r.data.sources?.[1]?.url === 'https://lecteur3.example.com/b', r.data.sources?.[1]?.url);
        check('les lecteurs sont numérotés à la suite du principal',
          r.data.sources?.[0]?.label === 'Lecteur 2' && r.data.sources?.[1]?.label === 'Lecteur 3');

        r = await alice('GET', '/api/content/' + serieId);
        const ep = r.data.item.episodes.find((x) => x.id === epId);
        check('un membre voit les lecteurs supplémentaires', ep?.sources?.length === 2);
        check('chaque lecteur porte son type', ep?.sources?.every((s) => s.player === 'embed'));

        // Les domaines supplémentaires doivent pouvoir être affichés en cadre.
        const csp = (await fetch(BASE + '/')).headers.get('content-security-policy') || '';
        check('les domaines des lecteurs supplémentaires passent la CSP',
          csp.includes('lecteur2.example.com') && csp.includes('lecteur3.example.com'),
          csp.slice(0, 160));

        // Une ligne invalide est signalée sans empêcher les autres.
        r = await admin('PUT', '/api/admin/episodes/' + epId, {
          sources: 'javascript:alert(1)\nhttps://lecteur4.example.com/c',
        });
        check('ligne dangereuse refusée', r.data.refuses?.length === 1, JSON.stringify(r.data.refuses));
        check('la ligne valide est conservée', r.data.sources?.length === 1);
        check('la liste remplace l’ancienne au lieu de s’y ajouter',
          r.data.sources?.[0]?.url === 'https://lecteur4.example.com/c');

        r = await admin('PUT', '/api/admin/episodes/' + epId, { sources: '' });
        check('liste vide efface les lecteurs supplémentaires', r.data.sources?.length === 0);
      }

      check('suppression d’un épisode',
        (await admin('DELETE', '/api/admin/episodes/' + epId)).status === 200);
      check('il en reste deux',
        (await alice('GET', '/api/content/' + serieId)).data.item.episodes.length === 2);

      // Les épisodes doivent disparaître avec la série.
      await admin('DELETE', '/api/admin/content/' + serieId);
      check('épisodes supprimés avec la série',
        (await admin('GET', `/api/admin/content/${serieId}/episodes`)).data.episodes.length === 0);

      // La fiche propose des titres proches, pour ne pas finir sur du vide.
      r = await alice('GET', '/api/content/' + filmId);
      check('titres similaires proposés', Array.isArray(r.data.similar));
    }

    console.log('\n— Pièces jointes et affiches');
    {
      const jeuId = (await admin('POST', '/api/admin/content', { type: 'jeu', title: 'Jeu joint' })).data.id;

      // Un .torrent est du bencode : il commence par « d ».
      const torrent = Buffer.from('d8:announce30:http://exemple.local/announcee');
      const post = async (client, id, route, filename, buf) => {
        const form = new FormData();
        form.append('file', new Blob([buf]), filename);
        return client('POST', `/api/admin/content/${id}/${route}`, form);
      };

      r = await post(admin, jeuId, 'files', 'jeu.torrent', torrent);
      check('envoi du .torrent', r.status === 200 && r.data.file.size === torrent.length,
        JSON.stringify(r.data));
      const fileId = r.data.file?.id;

      check('extension refusée',
        (await post(admin, jeuId, 'files', 'virus.exe', Buffer.from('MZ'))).status === 400);
      check('faux .torrent refusé',
        (await post(admin, jeuId, 'files', 'faux.torrent', Buffer.from('pas du bencode'))).status === 400);

      r = await alice('GET', '/api/content/' + jeuId);
      check('pièce jointe visible par un membre', r.data.item.files.length === 1);
      check('nom d’origine conservé', r.data.item.files[0].original_name === 'jeu.torrent');

      // Le téléchargement doit rester réservé aux membres.
      const anonDl = await fetch(`${BASE}/api/files/${fileId}`);
      check('téléchargement refusé sans session', anonDl.status === 401);

      r = await alice('GET', '/api/files/' + fileId);
      check('téléchargement autorisé pour un membre', r.status === 200);

      // Affiche : PNG minimal, signature vérifiée côté serveur.
      const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
      r = await post(admin, jeuId, 'poster', 'affiche.png', png);
      check("envoi de l'affiche", r.status === 200 && r.data.poster_url.startsWith('/api/files/'),
        JSON.stringify(r.data));
      const posterUrl = r.data.poster_url;

      check('image invalide refusée',
        (await post(admin, jeuId, 'poster', 'faux.png', Buffer.from('pas une image'))).status === 400);

      r = await alice('GET', '/api/content/' + jeuId);
      check("affiche rattachée au contenu", r.data.item.poster_url === posterUrl);
      check("l'affiche n'apparaît pas dans les téléchargements", r.data.item.files.length === 1);

      const posterRes = await fetch(BASE + posterUrl);
      check('affiche protégée elle aussi', posterRes.status === 401);

      // Supprimer le contenu doit emporter ses fichiers.
      await admin('DELETE', '/api/admin/content/' + jeuId);
      check('fichiers supprimés avec le contenu',
        (await alice('GET', '/api/files/' + fileId)).status === 404);
    }

    console.log('\n— Gestion des utilisateurs');
    r = await admin('GET', '/api/admin/users');
    const aliceRow = r.data.users.find((u) => u.username === 'alice');
    check('alice listée', !!aliceRow);
    check('aucun mot de passe exposé par l\'API',
      !JSON.stringify(r.data).includes('password_hash') && !JSON.stringify(r.data).includes('$2a$'));

    r = await admin('POST', `/api/admin/users/${aliceRow.id}/reset-password`, {});
    check('réinitialisation génère un mot de passe', r.status === 200 && r.data.generated && r.data.password.length >= 8);
    const nouveauMdp = r.data.password;

    const alice2 = client();
    r = await alice2('POST', '/api/auth/login', { identifier: 'alice', password: nouveauMdp });
    check('alice se reconnecte avec le nouveau mot de passe', r.status === 200, JSON.stringify(r.data));

    r = await admin('POST', `/api/admin/users/${aliceRow.id}/ban`, { banned: true, reason: 'test' });
    check('bannissement', r.status === 200 && r.data.user.banned === 1, JSON.stringify(r.data));
    check('session bannie coupée immédiatement', (await alice2('GET', '/api/content')).status === 403);
    r = await alice2('POST', '/api/auth/login', { identifier: 'alice', password: nouveauMdp });
    check('reconnexion impossible si banni', r.status === 403 && r.data.reason === 'test');

    r = await admin('POST', `/api/admin/users/${aliceRow.id}/ban`, { banned: false });
    check('débannissement', r.status === 200 && r.data.user.banned === 0);

    console.log('\n— Garde-fous');
    const adminRow = (await admin('GET', '/api/admin/users')).data.users.find((u) => u.username === 'root_admin');
    check('auto-bannissement refusé',
      (await admin('POST', `/api/admin/users/${adminRow.id}/ban`, { banned: true })).status === 400);
    check('auto-suppression refusée',
      (await admin('DELETE', `/api/admin/users/${adminRow.id}`)).status === 400);
    check('auto-rétrogradation refusée',
      (await admin('POST', `/api/admin/users/${adminRow.id}/role`, { role: 'user' })).status === 400);

    r = await admin('POST', `/api/admin/users/${aliceRow.id}/role`, { role: 'admin' });
    check('promotion admin', r.status === 200 && r.data.user.role === 'admin');
    r = await admin('POST', `/api/admin/users/${aliceRow.id}/role`, { role: 'user' });
    check('rétrogradation', r.status === 200 && r.data.user.role === 'user');

    console.log('\n— Création et suppression de compte par l\'admin');
    r = await admin('POST', '/api/admin/users', { username: 'carol', email: 'carol@test.local' });
    check('création de compte avec mot de passe généré', r.status === 200 && r.data.password.length >= 8);
    const carolId = r.data.user.id;
    const carol = client();
    check('carol peut se connecter',
      (await carol('POST', '/api/auth/login', { identifier: 'carol', password: r.data.password })).status === 200);
    check('suppression de carol', (await admin('DELETE', `/api/admin/users/${carolId}`)).status === 200);
    check('carol ne peut plus se connecter',
      (await client()('POST', '/api/auth/login', { identifier: 'carol', password: 'peu importe' })).status === 401);

    console.log('\n— Suivi de visionnage');
    {
      const serie = (await admin('POST', '/api/admin/content', { type: 'serie', title: 'Suivi Test' })).data.id;
      const eps = [];
      for (const [s, n] of [[1, 1], [1, 2], [2, 1]]) {
        const r = await admin('POST', `/api/admin/content/${serie}/episodes`, {
          season: s, number: n, title: `S${s}E${n}`,
          video_url: `https://lecteur.example.com/e/${s}-${n}`,
        });
        eps.push(r.data.episode.id);
      }

      r = await alice('GET', '/api/content/' + serie);
      check('aucun épisode vu au départ', r.data.item.episodes.every((e) => !e.watched));
      check('compteur de vus à zéro', r.data.item.watchedCount === 0);

      r = await alice('POST', `/api/content/${serie}/watched`, { episodeId: eps[0], watched: true });
      check('épisode marqué comme vu', r.status === 200 && r.data.watched === true);

      r = await alice('GET', '/api/content/' + serie);
      check('le vu est bien enregistré', r.data.item.episodes.find((e) => e.id === eps[0])?.watched === true);
      check('compteur mis à jour', r.data.item.watchedCount === 1);

      // Le suivi est propre a chaque membre.
      r = await admin('GET', '/api/content/' + serie);
      check('le suivi ne fuit pas d’un compte à l’autre', r.data.item.watchedCount === 0);

      r = await alice('GET', '/api/content');
      const reprise = r.data.reprendre.find((x) => x.id === serie);
      check('la série apparaît dans « Reprendre »', !!reprise, JSON.stringify(r.data.reprendre));
      check('l’épisode proposé est le suivant', reprise?.resume?.id === eps[1],
        JSON.stringify(reprise?.resume));

      // Vu le dernier episode d'une saison : la reprise doit passer a la suivante.
      await alice('POST', `/api/content/${serie}/watched`, { episodeId: eps[1], watched: true });
      r = await alice('GET', '/api/content');
      check('la reprise franchit les saisons',
        r.data.reprendre.find((x) => x.id === serie)?.resume?.id === eps[2]);

      // Serie terminee : plus rien a reprendre.
      await alice('POST', `/api/content/${serie}/watched`, { episodeId: eps[2], watched: true });
      r = await alice('GET', '/api/content');
      check('série terminée : plus de reprise', !r.data.reprendre.find((x) => x.id === serie));

      // Bascule inverse.
      r = await alice('POST', `/api/content/${serie}/watched`, { episodeId: eps[2] });
      check('second clic retire le vu', r.data.watched === false);

      // Marquage d'une saison entière.
      {
        const s2 = (await admin('POST', `/api/admin/content/${serie}/episodes`,
          { season: 2, number: 2, title: 'S2E2', video_url: 'https://lecteur.example.com/2-2' })).data.episode.id;

        r = await alice('POST', `/api/content/${serie}/watched-season`, { season: 1 });
        check('saison entière marquée', r.status === 200 && r.data.episodes.length === 2,
          JSON.stringify(r.data));

        let fiche = (await alice('GET', '/api/content/' + serie)).data.item;
        check('les deux épisodes de la saison 1 sont vus',
          fiche.episodes.filter((e) => e.season === 1).every((e) => e.watched));
        check('la saison 2 n’est pas touchée',
          fiche.episodes.filter((e) => e.season === 2).every((e) => !e.watched));

        r = await alice('POST', `/api/content/${serie}/watched-season`, { season: 1, watched: false });
        check('saison entière démarquée', r.data.watched === false);
        fiche = (await alice('GET', '/api/content/' + serie)).data.item;
        check('plus aucun épisode vu en saison 1',
          fiche.episodes.filter((e) => e.season === 1).every((e) => !e.watched));
        check('compteur global remis à zéro', fiche.watchedCount === 0, String(fiche.watchedCount));

        // Marquer deux fois ne doit pas empiler de lignes.
        await alice('POST', `/api/content/${serie}/watched-season`, { season: 1 });
        await alice('POST', `/api/content/${serie}/watched-season`, { season: 1 });
        check('marquer deux fois ne duplique rien',
          (await alice('GET', '/api/content/' + serie)).data.item.watchedCount === 2);

        check('saison inexistante refusée',
          (await alice('POST', `/api/content/${serie}/watched-season`, { season: 99 })).status === 404);
        check('saison non numérique refusée',
          (await alice('POST', `/api/content/${serie}/watched-season`, { season: 'abc' })).status === 400);
        check('saison refusée sur un film',
          (await alice('POST', `/api/content/${filmId}/watched-season`, { season: 1 })).status === 400);

        await alice('POST', `/api/content/${serie}/watched-season`, { season: 1, watched: false });
        await admin('DELETE', '/api/admin/episodes/' + s2);
      }

      check('épisode d’une autre série refusé',
        (await alice('POST', `/api/content/${filmId}/watched`, { episodeId: eps[0] })).status === 400);

      // Un film se marque sans episode.
      r = await alice('POST', `/api/content/${filmId}/watched`);
      check('film marqué comme vu', r.data.watched === true);
      check('le film est marqué dans le catalogue',
        (await alice('GET', '/api/content')).data.films.find((f) => f.id === filmId)?.watched === true);
      r = await alice('POST', `/api/content/${filmId}/watched`);
      check('film démarqué', r.data.watched === false);

      // ------------------------- notes et commentaires -------------------------
      {
        const ep = eps[0];

        r = await alice('PUT', `/api/episodes/${ep}/rating`, { score: 8 });
        check('note enregistrée', r.status === 200 && r.data.maNote === 8 && r.data.votants === 1,
          JSON.stringify(r.data));

        // Renoter remplace : la cle primaire interdit d'empiler deux avis.
        r = await alice('PUT', `/api/episodes/${ep}/rating`, { score: 6 });
        check('renoter remplace au lieu d’ajouter',
          r.data.maNote === 6 && r.data.votants === 1, JSON.stringify(r.data));

        r = await admin('PUT', `/api/episodes/${ep}/rating`, { score: 9 });
        check('moyenne calculée sur tous les votants',
          r.data.votants === 2 && r.data.moyenne === 7.5, JSON.stringify(r.data));

        for (const mauvaise of [0, 11, 5.5, 'huit', null]) {
          check(`note ${JSON.stringify(mauvaise)} refusée`,
            (await alice('PUT', `/api/episodes/${ep}/rating`, { score: mauvaise })).status === 400);
        }
        check('note sur un épisode inexistant refusée',
          (await alice('PUT', '/api/episodes/999999/rating', { score: 5 })).status === 404);

        // La fiche porte deja moyenne et note personnelle : la page n'a pas a
        // lancer une requete par episode pour les afficher.
        {
          const fiche = (await alice('GET', '/api/content/' + serie)).data.item;
          const vu = fiche.episodes.find((e) => e.id === ep);
          check('la fiche donne la moyenne de l’épisode', vu.moyenne === 7.5 && vu.votants === 2,
            String(vu.moyenne));
          check('la fiche donne ma note à moi', vu.maNote === 6, String(vu.maNote));
          // Chacun voit la sienne : la note d'Alice ne doit pas fuir chez l'admin.
          const coteAdmin = (await admin('GET', '/api/content/' + serie)).data.item.episodes
            .find((e) => e.id === ep);
          check('chaque membre voit sa propre note', coteAdmin.maNote === 9, String(coteAdmin.maNote));
          const autre = fiche.episodes.find((e) => e.id !== ep);
          check('un épisode sans note n’affiche pas de moyenne',
            autre.moyenne === null && autre.votants === 0 && autre.maNote === null);
        }

        r = await alice('DELETE', `/api/episodes/${ep}/rating`);
        check('note retirée', r.status === 200 && r.data.maNote === null && r.data.votants === 1,
          JSON.stringify(r.data));
        check('retirer une note absente répond 404',
          (await alice('DELETE', `/api/episodes/${ep}/rating`)).status === 404);

        // Commentaires.
        r = await alice('POST', `/api/episodes/${ep}/comments`, { body: '  Très bon début.  ' });
        check('commentaire publié', r.status === 200 && r.data.comment.body === 'Très bon début.',
          JSON.stringify(r.data));
        const comAlice = r.data.comment.id;
        check('commentaire vide refusé',
          (await alice('POST', `/api/episodes/${ep}/comments`, { body: '   ' })).status === 400);
        check('commentaire sur épisode inexistant refusé',
          (await alice('POST', '/api/episodes/999999/comments', { body: 'ok' })).status === 404);

        r = await admin('POST', `/api/episodes/${ep}/comments`, { body: 'Noté.' });
        const comAdmin = r.data.comment.id;
        check('l’étoile suit le rôle de l’auteur', r.data.comment.author_role === 'admin',
          String(r.data.comment.author_role));

        r = await alice('GET', `/api/episodes/${ep}/comments`);
        check('les commentaires sont listés', r.data.comments.length === 2,
          String(r.data.comments.length));
        check('le plus récent en premier', r.data.comments[0].id === comAdmin);
        check('un membre ordinaire n’a pas d’étoile',
          r.data.comments.find((c) => c.id === comAlice).author_role === 'user');
        check('la photo de profil accompagne le commentaire',
          'avatarUrl' in r.data.comments[0], Object.keys(r.data.comments[0]).join(','));

        check('la fiche compte les commentaires',
          (await alice('GET', '/api/content/' + serie)).data.item.episodes
            .find((e) => e.id === ep).commentaires === 2);

        // « J'aime » : un simple bascule, une voix par membre.
        r = await alice('POST', `/api/episodes/comments/${comAdmin}/like`);
        check('j’aime enregistré', r.status === 200 && r.data.liked === true && r.data.likes === 1,
          JSON.stringify(r.data));
        r = await alice('POST', `/api/episodes/comments/${comAdmin}/like`);
        check('second clic retire le j’aime', r.data.liked === false && r.data.likes === 0);
        await alice('POST', `/api/episodes/comments/${comAdmin}/like`);
        r = await admin('POST', `/api/episodes/comments/${comAdmin}/like`);
        check('les j’aime s’additionnent entre membres', r.data.likes === 2, String(r.data.likes));
        check('j’aime sur un commentaire inexistant refusé',
          (await alice('POST', '/api/episodes/comments/999999/like')).status === 404);

        r = await alice('GET', `/api/episodes/${ep}/comments`);
        {
          const vu = r.data.comments.find((c) => c.id === comAdmin);
          check('la liste porte le décompte des j’aime', vu.likes === 2, String(vu.likes));
          check('la liste dit si j’ai déjà aimé', vu.liked === true, String(vu.liked));
        }

        // Reponses : un seul niveau, toujours rattachees au message d'origine.
        r = await admin('POST', `/api/episodes/${ep}/comments`,
          { body: 'Merci du retour.', parentId: comAlice });
        check('réponse publiée', r.status === 200 && r.data.comment.parent_id === comAlice,
          JSON.stringify(r.data.comment));
        const reponse = r.data.comment.id;

        r = await alice('POST', `/api/episodes/${ep}/comments`,
          { body: 'De rien.', parentId: reponse });
        check('répondre à une réponse reste au même fil', r.data.comment.parent_id === comAlice,
          String(r.data.comment.parent_id));

        r = await alice('GET', `/api/episodes/${ep}/comments`);
        check('les réponses ne sont pas des fils à part', r.data.comments.length === 2,
          String(r.data.comments.length));
        check('les réponses sont rangées sous leur message',
          r.data.comments.find((c) => c.id === comAlice).replies.length === 2);
        check('les réponses sont dans l’ordre où elles ont été écrites',
          r.data.comments.find((c) => c.id === comAlice).replies[0].id === reponse);

        {
          const autreEp = (await admin('POST', `/api/admin/content/${serie}/episodes`,
            { season: 3, number: 1, title: 'Ailleurs' })).data.episode.id;
          check('on ne répond pas à un commentaire d’un autre épisode',
            (await alice('POST', `/api/episodes/${autreEp}/comments`,
              { body: 'perdu', parentId: comAlice })).status === 400);
          await admin('DELETE', '/api/admin/episodes/' + autreEp);
        }

        check('la fiche compte aussi les réponses',
          (await alice('GET', '/api/content/' + serie)).data.item.episodes
            .find((e) => e.id === ep).commentaires === 4);

        check('on ne supprime pas le commentaire d’un autre',
          (await alice('DELETE', '/api/episodes/comments/' + comAdmin)).status === 403);

        // Supprimer un message emporte ses reponses : aucune ne doit rester
        // orpheline dans la liste.
        r = await alice('DELETE', '/api/episodes/comments/' + comAlice);
        check('chacun supprime le sien', r.status === 200);
        check('les réponses partent avec le message supprimé', r.data.supprimes === 3,
          String(r.data.supprimes));
        check('plus qu’un seul commentaire',
          (await alice('GET', `/api/episodes/${ep}/comments`)).data.comments.length === 1);

        check('un administrateur supprime n’importe lequel',
          (await admin('DELETE', '/api/episodes/comments/' + comAdmin)).status === 200);
        check('commentaire déjà supprimé : 404',
          (await admin('DELETE', '/api/episodes/comments/' + comAdmin)).status === 404);

        check('notes et commentaires réservés aux membres connectés',
          (await client()('GET', `/api/episodes/${ep}/comments`)).status === 401);

        // Supprimer l'episode doit emporter notes et commentaires avec lui.
        await alice('PUT', `/api/episodes/${eps[1]}/rating`, { score: 4 });
        await alice('POST', `/api/episodes/${eps[1]}/comments`, { body: 'à effacer' });
        await admin('DELETE', '/api/admin/episodes/' + eps[1]);
        check('notes et commentaires disparaissent avec l’épisode',
          (await alice('GET', `/api/episodes/${eps[1]}/comments`)).status === 404);
      }
      await admin('DELETE', '/api/admin/content/' + serie);
    }

    console.log('\n— Historique et photo de profil');
    {
      const serie = (await admin('POST', '/api/admin/content', { type: 'serie', title: 'Histo Test' })).data.id;
      const e1 = (await admin('POST', `/api/admin/content/${serie}/episodes`,
        { season: 1, number: 1, title: 'Un', video_url: 'https://lecteur.example.com/h1' })).data.episode.id;

      check('historique vide au départ', (await alice('GET', '/api/history')).data.history.length === 0);

      await alice('POST', `/api/content/${serie}/watched`, { episodeId: e1, watched: true });
      r = await alice('GET', '/api/history');
      check('l’épisode vu entre dans l’historique', r.data.history.length === 1, JSON.stringify(r.data));
      check('l’historique porte le titre et l’épisode',
        r.data.history[0].title === 'Histo Test' && r.data.history[0].number === 1);
      check('l’historique est horodaté',
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(r.data.history[0].watched_at || ''),
        r.data.history[0].watched_at);

      check('l’historique ne fuit pas d’un compte à l’autre',
        (await admin('GET', '/api/history')).data.history.length === 0);

      r = await alice('DELETE', `/api/history?contentId=${serie}&episodeId=${e1}`);
      check('une entrée se retire', r.status === 200);
      check('l’épisode repasse en non vu',
        (await alice('GET', '/api/content/' + serie)).data.item.episodes[0].watched === false);
      check('retirer deux fois répond 404',
        (await alice('DELETE', `/api/history?contentId=${serie}&episodeId=${e1}`)).status === 404);

      await alice('POST', `/api/content/${serie}/watched`, { episodeId: e1, watched: true });
      await alice('POST', `/api/content/${filmId}/watched`, { watched: true });
      r = await alice('DELETE', '/api/history/all');
      check('tout effacer vide l’historique',
        r.data.supprimees === 2 && (await alice('GET', '/api/history')).data.history.length === 0);

      // Photo de profil : les membres choisissent dans un jeu figé, ils n'y
      // déposent rien.
      //
      // Le jeu est alimenté ici plutôt que supposé non vide : le site ne livre
      // plus aucune photo par défaut, c'est l'administration qui le remplit.
      {
        const carre = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          'base64'
        );
        const semis = new FormData();
        semis.append('file', new Blob([carre], { type: 'image/png' }), 'jeu.png');
        check('une photo peut être mise à disposition',
          (await admin('POST', '/api/admin/avatars', semis)).status === 200);
      }

      r = await alice('GET', '/api/auth/avatars');
      check('le jeu de photos est proposé', r.status === 200 && r.data.avatars.length > 0,
        JSON.stringify(r.data).slice(0, 120));
      const photo = r.data.avatars[0].id;

      check('photo hors du jeu refusée',
        (await alice('POST', '/api/auth/avatar', { avatar: '../../etc/passwd' })).status === 400);
      check('photo inventée refusée',
        (await alice('POST', '/api/auth/avatar', { avatar: 'nexiste-pas' })).status === 400);

      r = await alice('POST', '/api/auth/avatar', { avatar: photo });
      check('photo choisie', r.status === 200 && r.data.avatar === photo);
      check('la photo revient dans le profil',
        (await alice('GET', '/api/auth/me')).data.user.avatarUrl?.includes(photo));

      r = await alice('POST', '/api/auth/avatar', { avatar: null });
      check('photo retirée', r.status === 200 && r.data.avatar === null);

      // Cycle complet d'une photo envoyée. Ce chemin n'était pas testé, et il
      // échouait en production : les envois allaient dans public/, que le
      // service n'a pas le droit d'écrire (ProtectSystem=strict).
      {
        const png = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          'base64'
        );
        const form = new FormData();
        form.append('file', new Blob([png], { type: 'image/png' }), 'photo.png');
        r = await admin('POST', '/api/admin/avatars', form);
        check('photo envoyée depuis l’administration', r.status === 200, JSON.stringify(r.data));

        const ajoutee = r.data.avatars?.find((a) => a.url.startsWith('/api/avatars/'));
        check('elle est rangée hors de l’arborescence statique', !!ajoutee,
          JSON.stringify(r.data.avatars?.slice(-1)));

        if (ajoutee) {
          const servie = await fetch(BASE + ajoutee.url);
          check('elle est bien servie', servie.status === 200 &&
            (servie.headers.get('content-type') || '').startsWith('image/'),
            `HTTP ${servie.status}`);

          check('un membre peut la choisir',
            (await alice('POST', '/api/auth/avatar', { avatar: ajoutee.id })).status === 200);

          r = await admin('DELETE', '/api/admin/avatars/' + encodeURIComponent(ajoutee.id));
          check('elle se supprime', r.status === 200);
          check('elle ne figure plus dans le jeu',
            !r.data.avatars.some((a) => a.id === ajoutee.id));
        }

        // Une photo livrée avec le code vit dans un dossier en lecture seule :
        // la supprimer doit être refusé proprement, pas planter.
        const fournie = (await admin('GET', '/api/admin/avatars')).data.avatars
          .find((a) => a.url.startsWith('/img/avatars/'));
        if (fournie) {
          check('une photo livrée avec le site n’est pas supprimable',
            (await admin('DELETE', '/api/admin/avatars/' + fournie.id)).status === 400);
        }
      }

      await admin('DELETE', '/api/admin/content/' + serie);
    }

    console.log('\n— Boîte à idées');
    {
      check('anonyme rejeté', (await anon('GET', '/api/suggestions')).status === 401);

      r = await alice('POST', '/api/suggestions', {
        type: 'film',
        title: 'Un film très attendu',
        note: 'Version longue si possible',
      });
      check('proposition créée', r.status === 200, JSON.stringify(r.data));
      check("l'auteur vote pour la sienne", r.data.suggestion.votes === 1 && r.data.suggestion.voted === 1);
      const ideaId = r.data.suggestion.id;

      check('doublon refusé',
        (await admin('POST', '/api/suggestions', { type: 'film', title: 'un FILM très attendu' })).status === 409);
      check('type invalide refusé',
        (await alice('POST', '/api/suggestions', { type: 'livre', title: 'Test' })).status === 400);
      check('titre trop court refusé',
        (await alice('POST', '/api/suggestions', { type: 'film', title: 'x' })).status === 400);

      r = await admin('POST', `/api/suggestions/${ideaId}/vote`);
      check('vote d’un autre membre', r.data.suggestion.votes === 2);
      r = await admin('POST', `/api/suggestions/${ideaId}/vote`);
      check('deuxième clic retire le vote', r.data.suggestion.votes === 1);

      r = await alice('GET', '/api/suggestions');
      check('liste visible par les membres', r.status === 200 && r.data.suggestions.length === 1);

      check('un membre ne change pas le statut',
        (await alice('POST', `/api/suggestions/${ideaId}/status`, { status: 'ajoute' })).status === 403);
      r = await admin('POST', `/api/suggestions/${ideaId}/status`, {
        status: 'prevu',
        admin_note: 'Prévu pour le mois prochain',
      });
      check('admin change le statut', r.status === 200 && r.data.suggestion.status === 'prevu');
      check('statut invalide refusé',
        (await admin('POST', `/api/suggestions/${ideaId}/status`, { status: 'bidon' })).status === 400);

      // Une proposition d'alice ne doit pas pouvoir être supprimée par un autre membre.
      const dave = client();
      await dave('POST', '/api/auth/register', {
        username: 'dave', email: 'dave@test.local', password: 'MotDePasseDave12',
      });
      const daveDel = await dave('DELETE', '/api/suggestions/' + ideaId);
      check('un tiers ne peut pas supprimer', daveDel.status === 403,
        `-> HTTP ${daveDel.status} ${JSON.stringify(daveDel.data)}`);
      check('l’auteur peut supprimer la sienne',
        (await alice('DELETE', '/api/suggestions/' + ideaId)).status === 200);
    }

    console.log('\n— Ma liste (favoris)');
    {
      r = await alice('GET', '/api/content');
      check('aucun favori au départ', r.data.favoris.length === 0);

      r = await alice('POST', `/api/content/${filmId}/favorite`);
      check('ajout aux favoris', r.status === 200 && r.data.favorite === true);

      r = await alice('GET', '/api/content');
      check('le favori apparaît dans ma liste', r.data.favoris.length === 1);
      check('le film est marqué comme favori', r.data.films.find((f) => f.id === filmId)?.favorite === true);

      // Les favoris sont propres à chaque membre.
      r = await admin('GET', '/api/content');
      check('les favoris ne fuient pas d’un compte à l’autre', r.data.favoris.length === 0);

      r = await alice('POST', `/api/content/${filmId}/favorite`);
      check('retrait des favoris', r.data.favorite === false);
      check('ma liste est de nouveau vide', (await alice('GET', '/api/content')).data.favoris.length === 0);
    }

    console.log('\n— Carrousel, genres et images');
    {
      const serie = (await admin('POST', '/api/admin/content', {
        type: 'serie', title: 'Série en paysage', genre: 'Aventure', featured: 1,
        backdrop_url: 'https://exemple.test/paysage.jpg',
        poster_url: 'https://exemple.test/affiche.jpg',
      })).data.id;

      const autre = (await admin('POST', '/api/admin/content', {
        type: 'film', title: 'Film du même genre', genre: 'Aventure',
      })).data.id;

      const solo = (await admin('POST', '/api/admin/content', {
        type: 'film', title: 'Film seul en son genre', genre: 'Documentaire',
      })).data.id;

      // L'image en paysage doit survivre a l'aller-retour : c'est elle qui
      // remplit le carrousel, l'affiche etant en portrait.
      let fiche = (await alice('GET', '/api/content/' + serie)).data.item;
      check('l’image en paysage est conservée',
        fiche.backdrop_url === 'https://exemple.test/paysage.jpg', String(fiche.backdrop_url));

      let cat = (await alice('GET', '/api/content')).data;
      check('le catalogue expose un carrousel', Array.isArray(cat.carrousel),
        typeof cat.carrousel);
      check('le titre mis en avant est dans le carrousel',
        cat.carrousel.some((c) => c.id === serie),
        cat.carrousel.map((c) => c.title).join(', '));
      check('le carrousel porte l’image en paysage',
        cat.carrousel.find((c) => c.id === serie)?.backdrop_url ===
          'https://exemple.test/paysage.jpg');

      // Genres : reellement presents, comptes, et tries du plus fourni au moins.
      check('le catalogue expose les genres', Array.isArray(cat.genres));
      const aventure = cat.genres.find((g) => g.nom === 'Aventure');
      check('un genre porte son nombre de titres', aventure && aventure.total >= 2,
        JSON.stringify(aventure));
      check('les genres sont triés du plus fourni au moins fourni',
        cat.genres.every((g, i) => i === 0 || cat.genres[i - 1].total >= g.total),
        cat.genres.map((g) => `${g.nom}:${g.total}`).join(' '));
      check('un genre à un seul titre est listé aussi',
        cat.genres.some((g) => g.nom === 'Documentaire'));

      // Image d'episode : enregistrement, relecture, et presence sur la reprise.
      const ep1 = (await admin('POST', `/api/admin/content/${serie}/episodes`, {
        season: 1, number: 1, title: 'Départ',
        thumbnail_url: 'https://exemple.test/e1.jpg',
        video_url: 'https://lecteur.example.com/e1',
      })).data.episode;
      check('l’image d’épisode est enregistrée',
        ep1.thumbnail_url === 'https://exemple.test/e1.jpg', String(ep1.thumbnail_url));

      await admin('POST', `/api/admin/content/${serie}/episodes`, {
        season: 1, number: 2, title: 'Suite',
        thumbnail_url: 'https://exemple.test/e2.jpg',
        video_url: 'https://lecteur.example.com/e2',
      });

      fiche = (await alice('GET', '/api/content/' + serie)).data.item;
      check('la fiche porte l’image de chaque épisode',
        fiche.episodes.every((e) => e.thumbnail_url && e.thumbnail_url.startsWith('https://')),
        JSON.stringify(fiche.episodes.map((e) => e.thumbnail_url)));

      // Modifier un episode ne doit pas effacer son image au passage.
      await admin('PUT', '/api/admin/episodes/' + ep1.id, { title: 'Le vrai départ' });
      const relu = (await admin('GET', `/api/admin/content/${serie}/episodes`))
        .data.episodes.find((e) => e.id === ep1.id);
      check('modifier un épisode ne perd pas son image',
        relu.thumbnail_url === 'https://exemple.test/e1.jpg', String(relu.thumbnail_url));

      // La reprise doit porter l'image : c'est tout l'interet de la carte.
      await alice('POST', `/api/content/${serie}/watched`, { episodeId: ep1.id, watched: true });
      cat = (await alice('GET', '/api/content')).data;
      const reprise = cat.reprendre.find((r) => r.id === serie);
      check('la reprise pointe l’épisode suivant', reprise && reprise.resume.number === 2,
        JSON.stringify(reprise?.resume));
      check('la reprise porte l’image de l’épisode',
        reprise.resume.thumbnail_url === 'https://exemple.test/e2.jpg',
        String(reprise.resume.thumbnail_url));

      await alice('POST', `/api/content/${serie}/watched`, { episodeId: ep1.id, watched: false });
      for (const id of [serie, autre, solo]) await admin('DELETE', '/api/admin/content/' + id);
    }

    console.log('\n— Journal et statistiques');
    r = await admin('GET', '/api/admin/logs');
    check('journal alimenté', r.status === 200 && r.data.logs.length > 5);
    check('bannissement tracé', r.data.logs.some((l) => l.action === 'ban'));
    r = await admin('GET', '/api/admin/stats');
    check('statistiques cohérentes', r.data.films === 1 && r.data.jeux === 1 && r.data.admins === 1,
      JSON.stringify(r.data));

    console.log('\n— Déconnexion');
    check('déconnexion', (await admin('POST', '/api/auth/logout')).status === 200);
    check('session close après déconnexion', (await admin('GET', '/api/admin/users')).status === 401);

    console.log('\n— Protection contre la force brute');
    {
      // Le quota est volontairement relevé pour les tests : on vérifie ici
      // qu'il finit bien par bloquer, plutôt que de supposer qu'il existe.
      const attacker = client();
      let blocked = 0;
      for (let i = 1; i <= 70; i++) {
        const res = await attacker('POST', '/api/auth/login', {
          identifier: 'root_admin',
          password: 'essai-' + i,
        });
        if (res.status === 429) {
          blocked = i;
          break;
        }
      }
      check(
        'les connexions répétées finissent par être bloquées (429)',
        blocked > 0,
        blocked ? `bloqué après ${blocked} essais` : 'jamais bloqué en 70 essais'
      );
    }

    console.log('\n— Migration du schéma');
    {
      // La base de production est ancienne : elle n'a que les tables et les
      // colonnes qui existaient le jour de son installation. Une nouveaute
      // ajoutee au bloc de creation ne l'atteint pas, et un index pose sur une
      // colonne encore absente fait echouer le demarrage sur place, alors que
      // tout va bien sur une base neuve. Ce test recree cette situation.
      const { DatabaseSync } = require('node:sqlite');
      const vieux = fs.mkdtempSync(path.join(os.tmpdir(), 'kuroi-vieux-'));
      try {
        const ancienne = new DatabaseSync(path.join(vieux, 'kuroi.db'));
        ancienne.exec(`
          CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE COLLATE NOCASE,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
            banned INTEGER NOT NULL DEFAULT 0,
            ban_reason TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            last_login_at TEXT
          );
          CREATE TABLE content (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL CHECK (type IN ('film','serie','jeu')),
            title TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          );
          CREATE TABLE episodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content_id INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
            season INTEGER NOT NULL DEFAULT 1,
            number INTEGER NOT NULL,
            UNIQUE (content_id, season, number)
          );
          -- Volontairement sans parent_id, et sans table comment_likes.
          CREATE TABLE episode_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            author TEXT NOT NULL,
            body TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          );
          INSERT INTO users (username, email, password_hash) VALUES ('temoin','t@x.fr','x');
          INSERT INTO content (type, title) VALUES ('serie','Temoin');
          INSERT INTO episodes (content_id, season, number) VALUES (1,1,1);
          INSERT INTO episode_comments (episode_id, user_id, author, body)
            VALUES (1, 1, 'temoin', 'message ecrit avant la migration');
        `);
        ancienne.close();

        const sortie = require('child_process').spawnSync(
          process.execPath,
          ['-e', "require('./db'); console.log('DEMARRE');"],
          {
            cwd: path.join(__dirname, '..'),
            env: { ...process.env, DATA_DIR: vieux },
            encoding: 'utf8',
          }
        );
        check(
          'le schéma se met à jour sur une base déjà installée',
          sortie.status === 0 && sortie.stdout.includes('DEMARRE'),
          String(sortie.stderr || '').split('\n').slice(0, 3).join(' | ')
        );

        if (sortie.status === 0) {
          const apres = new DatabaseSync(path.join(vieux, 'kuroi.db'));
          const colonnes = apres.prepare('PRAGMA table_info(episode_comments)').all().map((c) => c.name);
          check('la colonne des réponses est ajoutée', colonnes.includes('parent_id'),
            colonnes.join(','));
          check('la table des j’aime est créée',
            apres.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='comment_likes'")
              .all().length === 1);
          check('l’index des réponses est créé',
            apres.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_comments_parent'")
              .all().length === 1);
          check('les commentaires déjà écrits sont conservés',
            apres.prepare('SELECT COUNT(*) AS n FROM episode_comments').get().n === 1);
          check('la colonne de l’image en paysage est ajoutée',
            apres.prepare('PRAGMA table_info(content)').all()
              .some((c) => c.name === 'backdrop_url'));
          check('la colonne de l’image d’épisode est ajoutée',
            apres.prepare('PRAGMA table_info(episodes)').all()
              .some((c) => c.name === 'thumbnail_url'));
          apres.close();
        }
      } finally {
        fs.rmSync(vieux, { recursive: true, force: true });
      }
    }

    console.log('\n— Scripts du navigateur');
    {
      // Les scripts de page partagent l'espace global avec common.js. Une
      // fonction homonyme y ecrase silencieusement celle de common.js : c'est
      // ainsi qu'un renderNav local a fait disparaitre la barre de navigation
      // de toutes les fiches, sans la moindre erreur en console.
      const jsDir = path.join(__dirname, '..', 'public', 'js');
      const noms = (f) =>
        [...fs.readFileSync(path.join(jsDir, f), 'utf8')
          .matchAll(/^(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);

      const communs = new Set(noms('common.js'));
      const collisions = [];
      for (const f of fs.readdirSync(jsDir)) {
        if (f === 'common.js' || f === 'theme.js' || !f.endsWith('.js')) continue;
        for (const n of noms(f)) if (communs.has(n)) collisions.push(`${f}:${n}`);
      }
      check('aucun script de page n’écrase une fonction de common.js',
        collisions.length === 0, collisions.join(', '));

      // Un onglet d'administration sans sa section reste invisible : le bouton
      // s'active, rien n'apparaît. C'est arrivé avec l'onglet Photos.
      const html = fs.readFileSync(path.join(__dirname, '..', 'private', 'admin.html'), 'utf8');
      const boutons = [...html.matchAll(/class="tab[^"]*"\s+data-tab="([^"]+)"/g)].map((m) => m[1]);
      const sections = new Set([...html.matchAll(/id="tab-([^"]+)"/g)].map((m) => m[1]));
      const orphelins = boutons.filter((b) => !sections.has(b));
      check('chaque onglet d’administration a sa section',
        boutons.length > 0 && orphelins.length === 0,
        orphelins.length ? `sans section : ${orphelins.join(', ')}` : 'aucun onglet trouvé');
    }

    console.log('\n— Referer des lecteurs vidéo');
    {
      // Ces deux reglages ont empeche pendant des mois tout lecteur video de
      // fonctionner sur iPhone. Safari sur iOS propage la politique de referer
      // de la page de depart a la page ouverte, iframe comprise. Avec
      // « no-referrer », la page de l'hebergeur reclamait son propre flux sans
      // Referer, et l'hebergeur la refusait (403 mesure sur sibnet ; 302 des
      // qu'un Referer de son origine etait present).
      //
      // Le meme lecteur ouvert depuis un site qui laisse la politique par
      // defaut fonctionnait, sur le meme telephone : c'est ce qui a permis de
      // remonter jusqu'ici.
      const entetes = (await fetch(BASE + '/login.html')).headers;
      const politique = (entetes.get('referrer-policy') || '').toLowerCase();
      check('la politique de referer ne coupe pas le referer',
        politique !== 'no-referrer' && politique !== 'same-origin',
        `Referrer-Policy: ${politique || '(absent)'}`);
      check('la politique de referer laisse passer la même origine en entier',
        politique === 'strict-origin-when-cross-origin', politique);

      // rel="noreferrer" sur le lien de secours produisait le meme effet, mais
      // pour l'ouverture en nouvel onglet : d'ou le « meme en nouvel onglet, ca
      // ne marche pas ». noopener seul protege autant sans couper le Referer.
      // Les lignes de commentaire sont retirees : elles parlent justement de
      // rel="noreferrer" pour expliquer pourquoi il ne faut pas le remettre,
      // et le test se declenchait sur son propre avertissement.
      const watchJs = fs
        .readFileSync(path.join(__dirname, '..', 'public', 'js', 'watch.js'), 'utf8')
        .split(/\r?\n/)
        .filter((l) => !l.trim().startsWith('//'))
        .join(' ');
      check('le lien « ouvrir dans un nouvel onglet » ne coupe pas le referer',
        !/rel="[^"]*noreferrer/.test(watchJs),
        (watchJs.match(/rel="[^"]*"/g) || []).join(' '));
      check('ce lien garde tout de même noopener',
        /rel="noopener"/.test(watchJs));
      check('l’iframe du lecteur pose sa politique de referer',
        /referrerpolicy="strict-origin-when-cross-origin"/.test(watchJs));
    }

    console.log('\n— Pages statiques');
    check('page de connexion servie', (await fetch(BASE + '/login.html')).status === 200);

    // Sans empreinte dans l'adresse, un navigateur garde son ancienne copie du
    // CSS et le site paraît inchangé après un déploiement.
    {
      const html = await (await fetch(BASE + '/login.html')).text();
      const assets = [...html.matchAll(/(?:href|src)="(\/(?:css|js)\/[^"]+)"/g)].map((m) => m[1]);
      check('la page référence bien du CSS et du JS', assets.length >= 2, JSON.stringify(assets));
      check('chaque fichier statique porte une empreinte',
        assets.length > 0 && assets.every((a) => /\?v=[a-f0-9]{8}$/.test(a)),
        JSON.stringify(assets));

      const served = await Promise.all(assets.map((a) => fetch(BASE + a).then((r) => r.status)));
      check('les fichiers empreintés sont bien servis', served.every((s) => s === 200),
        JSON.stringify(served));

      const cache = (await fetch(BASE + '/css/style.css')).headers.get('cache-control') || '';
      check('le CSS est revalidé, pas figé pour des jours',
        !/max-age=(?!0)\d+/.test(cache), `Cache-Control: ${cache}`);
    }
    // Les navigateurs reclament ces adresses d'eux-memes : elles ne doivent
    // pas repondre 404, et surtout pas renvoyer la page 404 en HTML.
    for (const alias of ['/favicon.ico', '/apple-touch-icon.png', '/apple-touch-icon-precomposed.png']) {
      const res = await fetch(BASE + alias);
      check(`${alias} servi comme image`,
        res.status === 200 && (res.headers.get('content-type') || '').startsWith('image/'),
        `HTTP ${res.status} ${res.headers.get('content-type')}`);
    }

    // Permet de detecter un deploiement dont le redemarrage a echoue : le
    // processus servirait alors une empreinte differente de celle des pages.
    {
      const health = await (await fetch(BASE + '/api/health')).json();
      const html = await (await fetch(BASE + '/login.html')).text();
      const inPage = html.match(/style\.css\?v=([a-f0-9]+)/)?.[1];
      check('le processus sert bien la version des pages',
        health.ok && health.assets === inPage, `processus ${health.assets} / pages ${inPage}`);
    }

    check('404 sur page inconnue', (await fetch(BASE + '/nexistepas')).status === 404);
    check('dossier private non exposé', (await fetch(BASE + '/admin.html')).status === 404);
  } catch (e) {
    failed++;
    console.error('\nErreur pendant le test :', e.message);
    console.error(serverLog);
  } finally {
    server.kill();
    await new Promise((r) => setTimeout(r, 300));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  }

  console.log(`\n${passed} réussis, ${failed} échoués\n`);
  process.exit(failed ? 1 : 0);
})();
