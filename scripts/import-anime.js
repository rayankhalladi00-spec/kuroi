// Importe une serie entiere depuis un fichier de donnees : la fiche, son
// affiche generee, puis ses episodes.
//
//   node scripts/import-anime.js scripts/data/<fichier>.js [--dry]
//   node scripts/import-anime.js --tous [--dry]
//
// Idempotent : relancer met a jour titres et resumes sans dupliquer, et sans
// jamais toucher aux lecteurs deja renseignes.
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { db, audit } = require('../db');
const { generer } = require('./make-poster');

const DATA_DIR = path.join(__dirname, 'data');

function importer(fichier, dry) {
  const { meta, titles, synopses } = require(path.resolve(fichier));
  if (!meta?.title) throw new Error(`${fichier} : meta.title manquant.`);

  let serie = db.prepare('SELECT * FROM content WHERE title = ? COLLATE NOCASE').get(meta.title);

  if (!serie) {
    // L'affiche n'est generee qu'a la creation : une vraie affiche posee
    // ensuite depuis /admin ne doit pas etre ecrasee au prochain import.
    const affiche = dry ? null : generer(meta.title, meta.hue ?? 350);
    if (dry) {
      console.log(`  [simulation] creerait « ${meta.title} »`);
      serie = { id: 0, title: meta.title };
    } else {
      const info = db
        .prepare(
          `INSERT INTO content (type, title, description, year, genre, poster_url)
           VALUES ('serie', ?, ?, ?, ?, ?)`
        )
        .run(meta.title, meta.description ?? null, meta.year ?? null, meta.genre ?? null, affiche);
      serie = db.prepare('SELECT * FROM content WHERE id = ?').get(Number(info.lastInsertRowid));
      audit(null, 'import_anime', `content#${serie.id}`, meta.title);
    }
  } else if (serie.type !== 'serie') {
    throw new Error(`« ${meta.title} » existe deja et n'est pas une serie.`);
  }

  const existants = serie.id
    ? db.prepare('SELECT id, season, number FROM episodes WHERE content_id = ?').all(serie.id)
    : [];
  const parCase = new Map(existants.map((e) => [`${e.season}-${e.number}`, e]));

  const insert = db.prepare(
    'INSERT INTO episodes (content_id, season, number, title, synopsis) VALUES (?, ?, ?, ?, ?)'
  );
  // Le lecteur n'est jamais touche : il se renseigne depuis /admin.
  const update = db.prepare('UPDATE episodes SET title = ?, synopsis = ? WHERE id = ?');

  let ajoutes = 0;
  let majs = 0;

  for (const [saisonStr, liste] of Object.entries(titles)) {
    const saison = Number(saisonStr);
    liste.forEach((titre, i) => {
      const numero = i + 1;
      const resume = synopses?.[saison]?.[i] ?? null;
      const deja = parCase.get(`${saison}-${numero}`);
      if (deja) {
        if (!dry) update.run(titre, resume, deja.id);
        majs++;
      } else {
        if (!dry) insert.run(serie.id, saison, numero, titre, resume);
        ajoutes++;
      }
    });
  }

  const nbResumes = Object.values(synopses || {}).reduce((n, l) => n + l.length, 0);
  const nbEpisodes = Object.values(titles).reduce((n, l) => n + l.length, 0);
  console.log(
    `  ${meta.title.padEnd(34)} ${String(nbEpisodes).padStart(4)} ep.  ` +
      `${String(ajoutes).padStart(4)} ajoutes  ${String(majs).padStart(4)} majs  ` +
      `${String(nbResumes).padStart(4)} resumes`
  );
  return { ajoutes, majs, nbEpisodes, nbResumes };
}

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const cibles = args.includes('--tous')
  ? fs
      .readdirSync(DATA_DIR)
      .filter((f) => f.endsWith('.js'))
      .map((f) => path.join(DATA_DIR, f))
  : args.filter((a) => !a.startsWith('--'));

if (!cibles.length) {
  console.error('Usage : node scripts/import-anime.js <fichier|--tous> [--dry]');
  process.exit(1);
}

console.log(dry ? 'SIMULATION\n' : '');
const total = { ajoutes: 0, majs: 0, nbEpisodes: 0, nbResumes: 0 };
for (const c of cibles) {
  try {
    const r = importer(c, dry);
    for (const k of Object.keys(total)) total[k] += r[k];
  } catch (e) {
    console.error(`  ECHEC ${path.basename(c)} : ${e.message}`);
    process.exitCode = 1;
  }
}
console.log(
  `\n  ${cibles.length} serie(s) — ${total.nbEpisodes} episodes, ` +
    `${total.ajoutes} ajoutes, ${total.majs} mis a jour, ${total.nbResumes} resumes.`
);
