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

function lireLigne(ligne, saisonParDefaut) {
  const texte = ligne.trim();
  if (!texte || texte.startsWith('#')) return null;

  for (const motif of MOTIFS) {
    const m = texte.match(motif);
    if (!m) continue;
    const reste = texte.slice(m[0].length).trim();
    if (!reste) return { erreur: 'aucun lecteur après le numéro' };
    return {
      saison: Number(m.groups.saison ?? saisonParDefaut),
      numero: Number(m.groups.numero),
      brut: reste,
    };
  }
  return { erreur: 'ligne illisible, un numéro d’épisode est attendu au début' };
}

function lireFichier(chemin, saisonParDefaut) {
  const lignes = fs.readFileSync(chemin, 'utf8').split(/\r?\n/);
  const entrees = [];
  const refusees = [];
  let serie = null;

  lignes.forEach((ligne, i) => {
    const enTete = ligne.match(/^#\s*s[ée]rie\s*:\s*(.+)$/i);
    if (enTete) {
      serie = enTete[1].trim();
      return;
    }
    const lu = lireLigne(ligne, saisonParDefaut);
    if (!lu) return;
    if (lu.erreur) return refusees.push({ ligne: i + 1, texte: ligne.trim(), message: lu.erreur });

    // Le code d'integration complet est accepte : seule l'adresse est gardee,
    // comme dans le panneau d'administration.
    try {
      const { url } = extractEmbedUrl(lu.brut);
      entrees.push({ ...lu, url });
    } catch (e) {
      refusees.push({ ligne: i + 1, texte: ligne.trim(), message: e.message });
    }
  });

  return { serie, entrees, refusees };
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
  const titre = valeur('--serie') || lu.serie;
  if (!titre) {
    console.error(
      'Série non précisée. Ajoute « # serie: Titre » en tête du fichier, ou --serie "Titre".'
    );
    process.exit(1);
  }

  const serie = trouverSerie(titre);
  if (serie.type !== 'serie') {
    console.error(`« ${serie.title} » n’est pas une série : elle n’a pas d’épisodes.`);
    process.exit(1);
  }

  console.log(`Série : ${serie.title} (#${serie.id})`);
  console.log(`Lecteurs lus : ${lu.entrees.length}`);
  if (lu.refusees.length) {
    console.log(`Lignes refusées : ${lu.refusees.length}`);
    for (const r of lu.refusees.slice(0, 10))
      console.log(`  ligne ${r.ligne} — ${r.message} : ${r.texte.slice(0, 60)}`);
    if (lu.refusees.length > 10) console.log(`  … et ${lu.refusees.length - 10} autres`);
  }

  const bilan = appliquer(serie, lu.entrees, options);

  console.log(options.essai ? '\n--- essai, rien n’a été écrit ---' : '');
  if (options.source) console.log(`Lecteurs supplémentaires ajoutés : ${bilan.sources}`);
  else console.log(`Lecteurs posés : ${bilan.poses}`);
  console.log(`Inchangés : ${bilan.inchanges}`);
  if (bilan.absents.length) {
    console.log(`Épisodes absents du catalogue : ${bilan.absents.length}`);
    console.log('  ' + bilan.absents.slice(0, 15).join(', ') + (bilan.absents.length > 15 ? ' …' : ''));
  }

  if (!options.essai && (bilan.poses || bilan.sources)) {
    audit(null, 'import_lecteurs', `content#${serie.id}`,
      `${serie.title} : ${bilan.poses + bilan.sources} lecteur(s) depuis ${path.basename(fichier)}`);
  }
}

if (require.main === module) main();

module.exports = { lireLigne, lireFichier, trouverSerie, appliquer };
