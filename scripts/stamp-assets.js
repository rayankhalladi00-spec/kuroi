// Ajoute une empreinte aux liens vers le CSS et le JS dans les pages HTML :
//   <link href="/css/style.css">  ->  <link href="/css/style.css?v=a1b2c3d4">
//
// Sans cela, un navigateur qui a déjà chargé un fichier continue de servir sa
// copie tant qu'elle n'a pas expiré : le site paraît inchangé après un
// déploiement. Comme l'empreinte dérive du contenu, l'adresse change dès qu'un
// fichier change — et seulement à ce moment-là.
//
//   node scripts/stamp-assets.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const ASSET_DIRS = [path.join(ROOT, 'public', 'css'), path.join(ROOT, 'public', 'js')];
const HTML_DIRS = [path.join(ROOT, 'public'), path.join(ROOT, 'private')];

function filesIn(dir) {
  return fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => path.join(dir, e.name))
        .sort()
    : [];
}

// Une seule empreinte pour tout le lot : plus simple à raisonner qu'une par
// fichier, et le site est assez petit pour que ce soit sans conséquence.
const hash = crypto.createHash('sha256');
for (const file of ASSET_DIRS.flatMap(filesIn)) {
  hash.update(path.basename(file));
  hash.update(fs.readFileSync(file));
}
const version = hash.digest('hex').slice(0, 8);

// href="/css/…" ou src="/js/…", avec ou sans empreinte déjà présente.
const LINK = /((?:href|src)=")(\/(?:css|js)\/[^"?]+)(?:\?v=[a-f0-9]+)?(")/g;

let changed = 0;
for (const file of HTML_DIRS.flatMap(filesIn).filter((f) => f.endsWith('.html'))) {
  const before = fs.readFileSync(file, 'utf8');
  const after = before.replace(LINK, `$1$2?v=${version}$3`);
  if (after !== before) {
    fs.writeFileSync(file, after);
    changed++;
  }
}

console.log(`Empreinte ${version} appliquée (${changed} page(s) modifiée(s)).`);
