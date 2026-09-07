// Pose les images d'episode (les vignettes) d'une ou plusieurs series.
//
//   node scripts/appliquer-vignettes.js <dossier> [options]
//
// Le dossier attendu est celui d'une serie, ou un dossier qui en contient
// plusieurs. Une serie se presente ainsi :
//
//   041-Bleach/
//     readers.txt          (facultatif : sa ligne « # serie: » nomme la serie)
//     Saison-01/S01E01.jpg
//     Saison-01/S01E02.jpg
//
// Le nom de la serie vient de « # serie: » dans readers.txt ; a defaut, du nom
// du dossier prive de son prefixe numerique (« 041-Bleach » donne « Bleach »).
//
// La saison et le numero viennent du nom du fichier, pas du dossier : c'est le
// fichier qui fait foi. Si les deux se contredisent, l'image est refusee plutot
// que devinee — une vignette posee sur le mauvais episode ne se remarque pas.
//
// Options :
//   --serie "Titre"   impose la serie (un seul dossier de serie, alors)
//   --essai           montre ce qui serait fait, n'ecrit rien
//   --remplacer       ecrase une vignette deja en place (sinon on n'y touche pas)
//
// Idempotent : relancer ne repose rien. Sans --remplacer, un episode qui a deja
// sa vignette est laisse tel quel et compte comme « inchange ».
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { db, audit } = require('../db');
const { EPISODE_DIR } = require('../lib/uploads');

const IMAGE = /^s(\d{1,2})e(\d{1,3})\.(jpg|jpeg|png|webp)$/i;
const SAISON_DOSSIER = /^saison[-_ ]?(\d{1,2})$/i;

/* --------------------------------- noms ----------------------------------- */

// Le catalogue n'a pas de colonne d'identifiant court : on en fabrique un a
// partir du titre. Les accents sont deposes plutot que supprimes, sans quoi
// « Hunter × Hunter » et « Hunter Hunter » donneraient deux noms differents
// pour la meme serie selon l'ecriture rencontree.
function slug(titre) {
  return titre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function nomFichier(slugSerie, saison, numero, ext) {
  const s = String(saison).padStart(2, '0');
  const e = String(numero).padStart(2, '0');
  return `${slugSerie}-s${s}e${e}${ext.toLowerCase()}`;
}

/* -------------------------------- lecture --------------------------------- */

function nomDeSerie(dossier) {
  const readers = path.join(dossier, 'readers.txt');
  if (fs.existsSync(readers)) {
    for (const ligne of fs.readFileSync(readers, 'utf8').split(/\r?\n/)) {
      const m = ligne.match(/^#\s*s[ée]rie\s*:\s*(.+)$/i);
      if (m) return m[1].trim();
    }
  }
  // « 041-Bleach » donne « Bleach ». Un dossier sans prefixe reste entier.
  return path.basename(dossier).replace(/^\d{1,4}\s*-\s*/, '').trim();
}

// Rend les images d'une serie, et les fichiers ecartes avec leur raison.
function lireDossierSerie(dossier) {
  const images = [];
  const refusees = [];

  for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
    if (!entree.isDirectory()) continue;
    const saisonDossier = entree.name.match(SAISON_DOSSIER);
    if (!saisonDossier) continue;
    const attendue = Number(saisonDossier[1]);

    const sousDossier = path.join(dossier, entree.name);
    for (const fichier of fs.readdirSync(sousDossier)) {
      const m = fichier.match(IMAGE);
      if (!m) {
        // Les notes et les rapports du lot ne sont pas des images manquees.
        if (!/^lire-moi|\.(json|txt|md)$/i.test(fichier))
          refusees.push({ fichier: path.join(entree.name, fichier), message: 'nom illisible' });
        continue;
      }
      const saison = Number(m[1]);
      const numero = Number(m[2]);
      if (saison !== attendue) {
        refusees.push({
          fichier: path.join(entree.name, fichier),
          message: `le fichier dit saison ${saison}, le dossier saison ${attendue}`,
        });
        continue;
      }
      images.push({
        saison,
        numero,
        ext: path.extname(fichier),
        source: path.join(sousDossier, fichier),
      });
    }
  }

  images.sort((a, b) => a.saison - b.saison || a.numero - b.numero);
  return { images, refusees };
}

// Un dossier de serie porte des « Saison-XX » ; un dossier parent porte des
// dossiers de series.
function estDossierSerie(dossier) {
  return fs
    .readdirSync(dossier, { withFileTypes: true })
    .some((e) => e.isDirectory() && SAISON_DOSSIER.test(e.name));
}

/* ------------------------------- catalogue -------------------------------- */

function trouverSerie(titre) {
  const exact = db
    .prepare('SELECT id, title, type FROM content WHERE title = ? COLLATE NOCASE')
    .get(titre);
  if (exact) return exact;

  const proches = db
    .prepare('SELECT id, title, type FROM content WHERE title LIKE ? COLLATE NOCASE')
    .all(`%${titre}%`);
  if (proches.length === 1) return proches[0];
  if (proches.length > 1)
    throw new Error(
      `Plusieurs titres correspondent à « ${titre} » : ` +
        proches.map((p) => `${p.title} (#${p.id})`).join(', ')
    );
  throw new Error(`Aucun titre ne correspond à « ${titre} ».`);
}

/* -------------------------------- ecriture -------------------------------- */

function appliquer(serie, images, options) {
  const trouverEp = db.prepare(
    'SELECT id, thumbnail_url FROM episodes WHERE content_id = ? AND season = ? AND number = ?'
  );
  const poser = db.prepare('UPDATE episodes SET thumbnail_url = ? WHERE id = ?');
  const slugSerie = slug(serie.title);

  const bilan = { posees: 0, inchangees: 0, absents: [], erreurs: [] };

  for (const img of images) {
    const ep = trouverEp.get(serie.id, img.saison, img.numero);
    if (!ep) {
      bilan.absents.push(`S${img.saison}E${img.numero}`);
      continue;
    }

    const nom = nomFichier(slugSerie, img.saison, img.numero, img.ext);
    const url = `/api/episode-images/${nom}`;

    // Deja posee, fichier present : rien a faire, quelle que soit l'option.
    if (ep.thumbnail_url === url && fs.existsSync(path.join(EPISODE_DIR, nom))) {
      bilan.inchangees++;
      continue;
    }
    // Sans --remplacer, une vignette deja en place est respectee : elle peut
    // avoir ete choisie a la main depuis le panneau d'administration.
    if (ep.thumbnail_url && !options.remplacer) {
      bilan.inchangees++;
      continue;
    }

    if (!options.essai) {
      // Le fichier d'abord, la base ensuite : une image sur le disque sans
      // ligne en base ne se voit pas, l'inverse donne une vignette cassee.
      try {
        fs.copyFileSync(img.source, path.join(EPISODE_DIR, nom));
      } catch (e) {
        bilan.erreurs.push(`${nom} : ${e.message}`);
        continue;
      }
      poser.run(url, ep.id);
    }
    bilan.posees++;
  }

  return bilan;
}

/* ---------------------------------- main ---------------------------------- */

function main() {
  const args = process.argv.slice(2);

  const valeur = (nom) => {
    const i = args.indexOf(nom);
    return i >= 0 ? args[i + 1] : null;
  };
  const options = {
    essai: args.includes('--essai'),
    remplacer: args.includes('--remplacer'),
  };
  const impose = valeur('--serie');

  // Le premier argument libre est le dossier : ni une option, ni la valeur
  // qui suit « --serie ».
  let dossier = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) continue;
    if (i > 0 && args[i - 1] === '--serie') continue;
    dossier = args[i];
    break;
  }

  if (!dossier) {
    console.error('Usage : node scripts/appliquer-vignettes.js <dossier> [--essai] [--remplacer]');
    process.exit(1);
  }
  if (!fs.existsSync(dossier)) {
    console.error(`Dossier introuvable : ${dossier}`);
    process.exit(1);
  }

  const dossiers = estDossierSerie(dossier)
    ? [dossier]
    : fs
        .readdirSync(dossier, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => path.join(dossier, e.name))
        .filter(estDossierSerie)
        .sort();

  if (!dossiers.length) {
    console.error('Aucun dossier de série trouvé (il faut des sous-dossiers « Saison-XX »).');
    process.exit(1);
  }
  if (impose && dossiers.length > 1) {
    console.error(`--serie impose une seule série, or ce dossier en contient ${dossiers.length}.`);
    process.exit(1);
  }

  // Tout est resolu avant la moindre ecriture : mieux vaut s'arreter net que
  // s'interrompre a mi-chemin de trente series.
  const aFaire = [];
  const introuvables = [];
  const slugs = new Map();

  for (const d of dossiers) {
    const titre = impose || nomDeSerie(d);
    let serie;
    try {
      serie = trouverSerie(titre);
    } catch (e) {
      introuvables.push(`${titre} — ${e.message}`);
      continue;
    }
    if (serie.type !== 'serie') {
      introuvables.push(`${serie.title} — ce n’est pas une série, elle n’a pas d’épisodes`);
      continue;
    }
    // Deux titres qui donneraient le meme nom de fichier ecraseraient
    // mutuellement leurs vignettes, en silence.
    const s = slug(serie.title);
    if (slugs.has(s) && slugs.get(s) !== serie.id) {
      introuvables.push(`${serie.title} — même nom de fichier qu’une autre série (« ${s} »)`);
      continue;
    }
    slugs.set(s, serie.id);

    const { images, refusees } = lireDossierSerie(d);
    aFaire.push({ serie, images, refusees });
  }

  if (introuvables.length) {
    console.log(`Séries écartées : ${introuvables.length}`);
    for (const i of introuvables) console.log('  ' + i);
    console.log('');
  }

  const total = aFaire.reduce((n, x) => n + x.images.length, 0);
  console.log(`Séries : ${aFaire.length} — ${total} image(s) lue(s)\n`);

  const cumul = { posees: 0, inchangees: 0, absents: 0, refusees: 0, erreurs: [] };
  for (const { serie, images, refusees } of aFaire) {
    const bilan = appliquer(serie, images, options);
    cumul.posees += bilan.posees;
    cumul.inchangees += bilan.inchangees;
    cumul.absents += bilan.absents.length;
    cumul.refusees += refusees.length;
    cumul.erreurs.push(...bilan.erreurs);

    console.log(
      `  ${serie.title.padEnd(38).slice(0, 38)} ${String(bilan.posees).padStart(4)} posée(s)  ` +
        `${String(bilan.inchangees).padStart(4)} inchangée(s)` +
        (bilan.absents.length ? `  ${bilan.absents.length} absent(s) du catalogue` : '') +
        (refusees.length ? `  ${refusees.length} fichier(s) refusé(s)` : '')
    );
    for (const r of refusees.slice(0, 5)) console.log(`      refusé : ${r.fichier} — ${r.message}`);

    if (!options.essai && bilan.posees) {
      audit(
        null,
        'import_vignettes',
        `content#${serie.id}`,
        `${serie.title} : ${bilan.posees} vignette(s)`
      );
    }
  }

  console.log(options.essai ? '\n--- essai, rien n’a été écrit ---' : '');
  console.log(
    `Total : ${cumul.posees} posée(s), ${cumul.inchangees} inchangée(s)` +
      (cumul.absents ? `, ${cumul.absents} épisode(s) absent(s) du catalogue` : '') +
      (cumul.refusees ? `, ${cumul.refusees} fichier(s) refusé(s)` : '')
  );
  if (cumul.erreurs.length) {
    console.log(`\nÉchecs de copie : ${cumul.erreurs.length}`);
    for (const e of cumul.erreurs.slice(0, 10)) console.log('  ' + e);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { slug, nomFichier, nomDeSerie, lireDossierSerie, estDossierSerie };
