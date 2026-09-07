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
// Un episode peut recevoir plusieurs lecteurs : il suffit de repeter son
// numero. Le premier devient le lecteur principal, les suivants des lecteurs
// de secours, et le visiteur bascule de l'un a l'autre depuis la page de
// lecture quand celui affiche ne repond plus.
//
//   S01E01 https://exemple.tld/lecteur/1        (principal)
//   S01E01 https://autre.tld/lecteur/1          (secours)
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

// Un episode peut recevoir plusieurs lecteurs : le premier devient le lecteur
// principal, les suivants des lecteurs de secours entre lesquels le visiteur
// bascule quand l'un d'eux ne repond plus.
//
// Sans ce regroupement, la deuxieme ligne d'un meme episode se contentait de
// constater que le principal etait deja pose, et le lecteur de secours etait
// perdu en silence — un fichier de trois lecteurs par episode n'en aurait
// installe qu'un seul.
function grouper(entrees) {
  const groupes = new Map();
  for (const e of entrees) {
    const cle = `${e.saison}x${e.numero}`;
    if (!groupes.has(cle)) groupes.set(cle, { saison: e.saison, numero: e.numero, urls: [] });
    const g = groupes.get(cle);
    // La meme adresse deux fois n'ajoute pas un choix, elle en ajoute l'illusion.
    if (!g.urls.includes(e.url)) g.urls.push(e.url);
  }
  return [...groupes.values()];
}

// Un film n'a pas d'episode : son lecteur principal vit dans content.video_url
// et ses secours dans content_sources. Les numeros presents dans le fichier ne
// servent alors qu'a donner l'ordre des lecteurs.
function appliquerFilm(film, entrees, options) {
  const poser = db.prepare('UPDATE content SET video_url = ? WHERE id = ?');
  const sourceExiste = db.prepare(
    'SELECT id FROM content_sources WHERE content_id = ? AND url = ?'
  );
  const ajouterSource = db.prepare(
    'INSERT INTO content_sources (content_id, label, url, position) VALUES (?, ?, ?, ?)'
  );
  const rangSuivant = db.prepare(
    'SELECT COALESCE(MAX(position), 0) + 1 AS rang FROM content_sources WHERE content_id = ?'
  );

  const bilan = { poses: 0, inchanges: 0, absents: [], sources: 0 };

  const urls = [];
  for (const e of entrees) if (!urls.includes(e.url)) urls.push(e.url);
  if (!urls.length) return bilan;

  const principal = options.source ? null : urls[0];
  const secours = options.source ? urls : urls.slice(1);
  let enPlace = db.prepare('SELECT video_url FROM content WHERE id = ?').get(film.id).video_url;

  if (principal !== null) {
    if (enPlace === principal) {
      bilan.inchanges++;
    } else if (enPlace && !options.remplacer) {
      bilan.inchanges++;
    } else {
      if (!options.essai) poser.run(principal, film.id);
      bilan.poses++;
      enPlace = principal;
    }
  }

  for (const url of secours) {
    if (url === enPlace) continue;
    if (sourceExiste.get(film.id, url)) {
      bilan.inchanges++;
      continue;
    }
    if (!options.essai) ajouterSource.run(film.id, null, url, rangSuivant.get(film.id).rang);
    bilan.sources++;
  }

  return bilan;
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

  for (const g of grouper(entrees)) {
    const ep = trouverEp.get(serie.id, g.saison, g.numero);
    if (!ep) {
      bilan.absents.push(`S${g.saison}E${g.numero}`);
      continue;
    }

    // --source : tout le fichier part en secours, le lecteur principal n'est
    // pas touche. Sinon le premier lecteur de l'episode devient le principal
    // et les suivants ses secours.
    const principal = options.source ? null : g.urls[0];
    const secours = options.source ? g.urls : g.urls.slice(1);

    if (principal !== null) {
      if (ep.video_url === principal) {
        bilan.inchanges++;
      } else if (ep.video_url && !options.remplacer) {
        // Sans --remplacer, un lecteur deja en place est respecte : on ne veut
        // pas ecraser un choix fait a la main par un import lance deux fois.
        bilan.inchanges++;
      } else {
        if (!options.essai) poser.run(principal, ep.id);
        bilan.poses++;
        // Les secours se comparent au principal reellement en place.
        ep.video_url = principal;
      }
    }

    for (const url of secours) {
      if (url === ep.video_url) continue; // deja le principal, pas un secours
      if (sourceExiste.get(ep.id, url)) {
        bilan.inchanges++;
        continue;
      }
      if (!options.essai) ajouterSource.run(ep.id, null, url, rangSuivant.get(ep.id).rang);
      bilan.sources++;
    }
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
    if (serie.type !== 'serie' && serie.type !== 'film') {
      introuvables.push(`${serie.title} — ni une série ni un film, on n’y pose pas de lecteur`);
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
    const bilan =
      serie.type === 'film'
        ? appliquerFilm(serie, entrees, options)
        : appliquer(serie, entrees, options);
    cumul.poses += bilan.poses;
    cumul.inchanges += bilan.inchanges;
    cumul.sources += bilan.sources;
    cumul.absents += bilan.absents.length;

    const pose = bilan.poses + bilan.sources;
    console.log(
      `  ${serie.title.padEnd(38).slice(0, 38)} ${String(bilan.poses).padStart(4)} principal(aux)  ` +
        `${String(bilan.sources).padStart(4)} secours  ` +
        `${String(bilan.inchanges).padStart(4)} inchangé(s)` +
        (bilan.absents.length ? `  ${bilan.absents.length} absent(s) du catalogue` : '')
    );

    if (!options.essai && pose) {
      audit(null, 'import_lecteurs', `content#${serie.id}`,
        `${serie.title} : ${bilan.poses} principal(aux) et ${bilan.sources} secours ` +
          `depuis ${path.basename(fichier)}`);
    }
  }

  console.log(options.essai ? '\n--- essai, rien n’a été écrit ---' : '');
  console.log(
    `Total : ${cumul.poses} lecteur(s) principal(aux), ${cumul.sources} de secours, ` +
      `${cumul.inchanges} inchangé(s)` +
      (cumul.absents ? `, ${cumul.absents} épisode(s) absent(s) du catalogue` : '')
  );
}

if (require.main === module) main();

module.exports = { lireLigne, lireFichier, trouverSerie, appliquer, appliquerFilm, grouper };
