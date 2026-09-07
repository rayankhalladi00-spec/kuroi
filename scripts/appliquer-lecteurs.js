// Pose des lecteurs sur les episodes d'une serie, en une fois.
//
//   node scripts/appliquer-lecteurs.js <fichier> [options]
//
// Le fichier tient une ligne par episode. Trois ecritures sont acceptees, on
// peut les melanger :
//
//   S01E01 https://exemple.tld/lecteur/1
//   1x02   <iframe src="https://exemple.tld/lecteur/2"></iframe>
//   3      https://exemple.tld/lecteur/3          (saison 1 par defaut)
//
// La serie se declare en tete du fichier, ou en argument :
//
//   # serie: Rick et Morty
//
// Un meme fichier peut enchainer plusieurs series : chaque « # serie: » ouvre
// une section, et les lignes qui suivent lui appartiennent.
//
// Options :
//   --serie "Titre"   la serie visee, si le fichier ne la declare pas
//   --saison N        saison par defaut pour les lignes sans saison (1)
//   --essai           montre ce qui serait fait, n'ecrit rien
//   --remplacer       ecrase un lecteur deja en place (sinon on n'y touche pas)
//   --source          ajoute en lecteur supplementaire au lieu du principal
//
// Idempotent : relancer ne duplique rien. Sans --remplacer, un episode qui a
// deja un lecteur est laisse tel quel et compte comme « inchange ».
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { db, audit } = require('../db');
const { extractEmbedUrl } = require('../lib/embed');

/* ------------------------------- lecture ---------------------------------- */

// « S01E02 », « 1x02 », « S1 E2 », ou un simple numero.
const MOTIFS = [
  /^s(?<saison>\d{1,2})\s*[eé]\s*(?<numero>\d{1,3})\b/i,
  /^(?<saison>\d{1,2})\s*x\s*(?<numero>\d{1,3})\b/i,
  /^(?<numero>\d{1,3})\b/,
];

// Une valeur de lecteur commence par une adresse ou par une balise. L'exiger
// ecarte les lignes d'en-tete : « 13 episodes — Lecteur Sibnet » etait sinon
// lue comme l'episode 13, et un en-tete pris pour un episode finit tot ou tard
// par ecraser une vraie donnee.
const RESSEMBLE_A_UN_LECTEUR = /^(https?:\/\/|<|\/\/)/i;

function lireLigne(ligne, saisonParDefaut) {
  const texte = ligne.trim();
  if (!texte || texte.startsWith('#')) return null;

  for (const motif of MOTIFS) {
    const m = texte.match(motif);
    if (!m) continue;

    // Un separateur peut suivre le numero : « S01E01 : adresse », « 3 - adresse ».
    const reste = texte.slice(m[0].length).replace(/^\s*[:=|–—-]\s*/, '').trim();
    if (!reste) return { erreur: 'aucun lecteur après le numéro' };
    if (!RESSEMBLE_A_UN_LECTEUR.test(reste))
      return { erreur: 'ce qui suit le numéro n’est ni une adresse ni un code d’intégration' };

    return {
      saison: Number(m.groups.saison ?? saisonParDefaut),
      numero: Number(m.groups.numero),
      brut: reste,
    };
  }
  return { erreur: 'ligne illisible, un numéro d’épisode est attendu au début' };
}

// Un fichier peut enchainer plusieurs series, chacune introduite par sa ligne
// « # serie: ». Les lignes appartiennent a la section ouverte au-dessus d'elles.
//
// Auparavant le nom de serie etait simplement ecrase a chaque en-tete pendant
// que les lignes s'accumulaient : un fichier de trente-deux series posait ses
// deux mille lignes sur la derniere, ecrasant les episodes des autres sans
// rien signaler. Le regroupement par section supprime ce risque.
function lireFichier(chemin, saisonParDefaut) {
  const lignes = fs.readFileSync(chemin, 'utf8').split(/\r?\n/);
  const sections = [];
  const refusees = [];
  let courante = null;

  const ouvrir = (nom) => {
    courante = { serie: nom, entrees: [] };
    sections.push(courante);
    return courante;
  };

  lignes.forEach((ligne, i) => {
    const enTete = ligne.match(/^#\s*s[ée]rie\s*:\s*(.+)$/i);
    if (enTete) return void ouvrir(enTete[1].trim());

    const lu = lireLigne(ligne, saisonParDefaut);
    if (!lu) return;
    if (lu.erreur) return refusees.push({ ligne: i + 1, texte: ligne.trim(), message: lu.erreur });

    // Le code d'integration complet est accepte : seule l'adresse est gardee,
    // comme dans le panneau d'administration.
    let url;
    try {
      url = extractEmbedUrl(lu.brut).url;
    } catch (e) {
      return refusees.push({ ligne: i + 1, texte: ligne.trim(), message: e.message });
    }

    // Sans en-tete, une section anonyme recueille les lignes : la serie sera
    // donnee par --serie.
    (courante || ouvrir(null)).entrees.push({ ...lu, url });
  });

  return { sections, refusees };
}

/* ------------------------------ application -------------------------------- */

function trouverSerie(titre) {
  const exact = db
    .prepare('SELECT id, title, type FROM content WHERE title = ? COLLATE NOCASE')
    .get(titre);
  if (exact) return exact;

  const proches = db
    .prepare("SELECT id, title, type FROM content WHERE title LIKE ? COLLATE NOCASE")
    .all(`%${titre}%`);
  if (proches.length === 1) return proches[0];
  if (proches.length > 1)
    throw new Error(
      `Plusieurs titres correspondent à « ${titre} » : ` +
        proches.map((p) => `${p.title} (#${p.id})`).join(', ')
    );
  throw new Error(`Aucun titre ne correspond à « ${titre} ».`);
}

function appliquer(serie, entrees, options) {
  const trouverEp = db.prepare(
    'SELECT id, season, number, video_url FROM episodes WHERE content_id = ? AND season = ? AND number = ?'
  );
  const poser = db.prepare('UPDATE episodes SET video_url = ? WHERE id = ?');
  const sourceExiste = db.prepare(
    'SELECT id FROM episode_sources WHERE episode_id = ? AND url = ?'
  );
  const ajouterSource = db.prepare(
    'INSERT INTO episode_sources (episode_id, label, url, position) VALUES (?, ?, ?, ?)'
  );
  const rangSuivant = db.prepare(
    'SELECT COALESCE(MAX(position), 0) + 1 AS rang FROM episode_sources WHERE episode_id = ?'
  );

  const bilan = { poses: 0, inchanges: 0, absents: [], sources: 0 };

  for (const e of entrees) {
    const ep = trouverEp.get(serie.id, e.saison, e.numero);
    if (!ep) {
      bilan.absents.push(`S${e.saison}E${e.numero}`);
      continue;
    }

    if (options.source) {
      if (sourceExiste.get(ep.id, e.url)) {
        bilan.inchanges++;
        continue;
      }
      if (!options.essai)
        ajouterSource.run(ep.id, null, e.url, rangSuivant.get(ep.id).rang);
      bilan.sources++;
      continue;
    }

    // Sans --remplacer, un lecteur deja en place est respecte : on ne veut pas
    // ecraser un choix fait a la main par un import lance deux fois.
    if (ep.video_url && !options.remplacer) {
      bilan.inchanges++;
      continue;
    }
    if (ep.video_url === e.url) {
      bilan.inchanges++;
      continue;
    }
    if (!options.essai) poser.run(e.url, ep.id);
    bilan.poses++;
  }

  return bilan;
}

/* --------------------------------- entree ---------------------------------- */

function main() {
  const args = process.argv.slice(2);
  const valeur = (nom) => {
    const i = args.indexOf(nom);
    return i >= 0 ? args[i + 1] : null;
  };
  const options = {
    essai: args.includes('--essai'),
    remplacer: args.includes('--remplacer'),
    source: args.includes('--source'),
  };

  const fichier = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--serie'
    && args[args.indexOf(a) - 1] !== '--saison');
  if (!fichier) {
    console.error('Usage : node scripts/appliquer-lecteurs.js <fichier> [--serie "Titre"] [--essai]');
    process.exit(1);
  }
  if (!fs.existsSync(fichier)) {
    console.error(`Fichier introuvable : ${fichier}`);
    process.exit(1);
  }

  const saisonParDefaut = Number(valeur('--saison') || 1);
  const lu = lireFichier(fichier, saisonParDefaut);
  const impose = valeur('--serie');

  if (!lu.sections.length) {
    console.error('Aucun lecteur lu dans ce fichier.');
    process.exit(1);
  }
  if (impose && lu.sections.length > 1) {
    console.error(
      `--serie impose une seule série, or le fichier en déclare ${lu.sections.length}.\n` +
        'Retire --serie pour utiliser les en-têtes « # serie: » du fichier.'
    );
    process.exit(1);
  }

  const total = lu.sections.reduce((n, s) => n + s.entrees.length, 0);
  console.log(`Sections : ${lu.sections.length} — ${total} lecteur(s) lu(s)`);

  if (lu.refusees.length) {
    console.log(`Lignes refusées : ${lu.refusees.length}`);
    for (const r of lu.refusees.slice(0, 10))
      console.log(`  ligne ${r.ligne} — ${r.message} : ${r.texte.slice(0, 60)}`);
    if (lu.refusees.length > 10) console.log(`  … et ${lu.refusees.length - 10} autres`);
  }

  // Les séries sont d'abord toutes résolues : mieux vaut s'arrêter avant
  // d'écrire quoi que ce soit qu'à mi-chemin d'un fichier de trente séries.
  const aFaire = [];
  const introuvables = [];
  for (const section of lu.sections) {
    const titre = impose || section.serie;
    if (!titre) {
      console.error(
        'Série non précisée. Ajoute « # serie: Titre » en tête du fichier, ou --serie "Titre".'
      );
      process.exit(1);
    }
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
    aFaire.push({ serie, entrees: section.entrees });
  }

  if (introuvables.length) {
    console.log(`\nSéries écartées : ${introuvables.length}`);
    for (const i of introuvables) console.log('  ' + i);
  }

  const cumul = { poses: 0, inchanges: 0, sources: 0, absents: 0 };
  console.log('');
  for (const { serie, entrees } of aFaire) {
    const bilan = appliquer(serie, entrees, options);
    cumul.poses += bilan.poses;
    cumul.inchanges += bilan.inchanges;
    cumul.sources += bilan.sources;
    cumul.absents += bilan.absents.length;

    const pose = options.source ? bilan.sources : bilan.poses;
    console.log(
      `  ${serie.title.padEnd(38).slice(0, 38)} ${String(pose).padStart(4)} posé(s)  ` +
        `${String(bilan.inchanges).padStart(4)} inchangé(s)` +
        (bilan.absents.length ? `  ${bilan.absents.length} absent(s) du catalogue` : '')
    );

    if (!options.essai && pose) {
      audit(null, 'import_lecteurs', `content#${serie.id}`,
        `${serie.title} : ${pose} lecteur(s) depuis ${path.basename(fichier)}`);
    }
  }

  console.log(options.essai ? '\n--- essai, rien n’a été écrit ---' : '');
  console.log(
    `Total : ${options.source ? cumul.sources : cumul.poses} posé(s), ` +
      `${cumul.inchanges} inchangé(s)` +
      (cumul.absents ? `, ${cumul.absents} épisode(s) absent(s) du catalogue` : '')
  );
}

if (require.main === module) main();

module.exports = { lireLigne, lireFichier, trouverSerie, appliquer };
