// Insere les episodes d'une serie a partir d'un fichier de donnees.
// Les lecteurs ne sont pas renseignes : ils se remplissent depuis /admin.
//
//   node scripts/import-episodes.js <id-du-contenu> <fichier> [--dry]
//
// L'import est idempotent : un episode deja present (meme saison, meme numero)
// voit son titre et son resume mis a jour, son lecteur reste intact.
require('dotenv').config();

const path = require('path');
const { db, audit } = require('../db');

const [, , contentIdArg, dataArg, ...flags] = process.argv;
const dryRun = flags.includes('--dry');

if (!contentIdArg || !dataArg) {
  console.error('Usage : node scripts/import-episodes.js <id-du-contenu> <fichier> [--dry]');
  process.exit(1);
}

const content = db.prepare('SELECT id, type, title FROM content WHERE id = ?').get(Number(contentIdArg));
if (!content) {
  console.error(`Contenu #${contentIdArg} introuvable.`);
  process.exit(1);
}
if (content.type !== 'serie') {
  console.error(`« ${content.title} » est de type « ${content.type} » : seules les séries ont des épisodes.`);
  process.exit(1);
}

const { titles, synopses } = require(path.resolve(dataArg));

const existing = db.prepare('SELECT id, season, number FROM episodes WHERE content_id = ?').all(content.id);
const key = (s, n) => `${s}-${n}`;
const byKey = new Map(existing.map((e) => [key(e.season, e.number), e]));

const insert = db.prepare(
  `INSERT INTO episodes (content_id, season, number, title, synopsis) VALUES (?, ?, ?, ?, ?)`
);
// Le lecteur n'est jamais touche : il est renseigne a la main depuis /admin.
const update = db.prepare(`UPDATE episodes SET title = ?, synopsis = ? WHERE id = ?`);

let ajoutes = 0;
let majs = 0;

for (const [saisonStr, liste] of Object.entries(titles)) {
  const saison = Number(saisonStr);
  liste.forEach((titre, i) => {
    const numero = i + 1;
    const resume = synopses?.[saison]?.[i] ?? null;
    const deja = byKey.get(key(saison, numero));

    if (deja) {
      if (!dryRun) update.run(titre, resume, deja.id);
      majs++;
    } else {
      if (!dryRun) insert.run(content.id, saison, numero, titre, resume);
      ajoutes++;
    }
  });
}

const totalResumes = Object.values(synopses || {}).reduce((n, l) => n + l.length, 0);

if (!dryRun) {
  audit(null, 'import_episodes', `content#${content.id}`,
    `${content.title} : ${ajoutes} ajoutés, ${majs} mis à jour`);
}

console.log(`${dryRun ? '[simulation] ' : ''}« ${content.title} »`);
console.log(`  saisons          : ${Object.keys(titles).length}`);
console.log(`  épisodes ajoutés : ${ajoutes}`);
console.log(`  mis à jour       : ${majs}`);
console.log(`  résumés fournis  : ${totalResumes}`);
console.log(`  lecteurs         : aucun (à renseigner depuis /admin)`);
