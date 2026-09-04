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

      // Photo de profil : jeu figé, aucun téléversement.
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
