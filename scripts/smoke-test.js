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
    const headers = { 'Content-Type': 'application/json' };
    if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(BASE + url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
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

    console.log('\n— Pages statiques');
    check('page de connexion servie', (await fetch(BASE + '/login.html')).status === 200);
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
