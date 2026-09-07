// Remplace les affiches générées par les visuels de TMDB.
//
//   TMDB_API_KEY=... node scripts/affiches-tmdb.js [options]
//
// Options :
//   --essai      montre ce qui serait fait, n'écrit rien
//   --force      remplace aussi les affiches déjà envoyées à la main
//   --type X     ne traite que « film » ou « serie »
//   --limite N   s'arrête après N fiches (pour essayer sur un échantillon)
//
// Pourquoi TMDB plutôt que de récupérer des images au hasard : une affiche est
// une œuvre protégée. TMDB met ses visuels à disposition des applications qui
// utilisent son interface, à condition de le mentionner — c'est ce que fait le
// pied de page du site. Une clé gratuite s'obtient sur themoviedb.org.
//
// Le script ne télécharge rien : il enregistre l'adresse servie par TMDB. Rien
// n'est copié sur le disque, et l'image reste chez eux.
require('dotenv').config();

const { db, audit } = require('../db');

const CLE = process.env.TMDB_API_KEY;
const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

// TMDB tolère une quarantaine d'appels par dizaine de secondes. On reste très
// en dessous : rien ne presse, et se faire couper au milieu de deux cents
// fiches coûterait plus cher que d'attendre.
const PAUSE_MS = 300;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const TYPE_TMDB = { film: 'movie', serie: 'tv' };

// Un titre français ne donne pas toujours de résultat : on retente en retirant
// ce qui suit « : », puis sans les accents.
function variantes(titre) {
  const sansAccents = titre.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const avantDeuxPoints = titre.split(/\s*[:—–]\s*/)[0];
  return [...new Set([titre, avantDeuxPoints, sansAccents])].filter(Boolean);
}

async function chercher(type, titre, annee) {
  for (const essai of variantes(titre)) {
    const params = new URLSearchParams({
      api_key: CLE,
      query: essai,
      language: 'fr-FR',
      include_adult: 'false',
    });
    // L'année écarte les homonymes, mais elle est parfois décalée d'un an
    // entre la sortie originale et la sortie française : on ne la donne qu'en
    // premier essai, et on relance sans elle si rien ne sort.
    for (const avecAnnee of annee ? [true, false] : [false]) {
      const p = new URLSearchParams(params);
      if (avecAnnee) p.set(type === 'movie' ? 'primary_release_year' : 'first_air_date_year', annee);

      const res = await fetch(`${BASE}/search/${type}?${p}`);
      if (res.status === 401) throw new Error('Clé TMDB refusée (401).');
      if (res.status === 429) {
        await pause(2000);
        continue;
      }
      if (!res.ok) continue;

      const { results } = await res.json();
      const trouve = (results || []).find((r) => r.poster_path);
      if (trouve) return { ...trouve, essai, avecAnnee };
      await pause(PAUSE_MS);
    }
  }
  return null;
}

async function main() {
  if (!CLE) {
    console.error(
      'Clé absente. Ajoute TMDB_API_KEY=... dans .env, ou passe-la en variable\n' +
        'd’environnement. Une clé gratuite s’obtient sur themoviedb.org, dans les\n' +
        'paramètres du compte, rubrique API.'
    );
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const valeur = (n) => {
    const i = args.indexOf(n);
    return i >= 0 ? args[i + 1] : null;
  };
  const essai = args.includes('--essai');
  const force = args.includes('--force');
  const type = valeur('--type');
  const limite = Number(valeur('--limite') || 0);

  // Par défaut on ne touche qu'aux affiches générées : celles que Rayan a
  // envoyées lui-même sont ses choix, on ne les écrase pas sans --force.
  let sql =
    'SELECT id, type, title, year, poster_url, backdrop_url FROM content WHERE type IN (?, ?)';
  const params = ['film', 'serie'];
  if (!force) sql += " AND (poster_url IS NULL OR poster_url LIKE '/img/posters/%')";
  if (type) {
    sql = sql.replace('type IN (?, ?)', 'type = ?');
    params.length = 0;
    params.push(type);
  }
  sql += ' ORDER BY id';

  let fiches = db.prepare(sql).all(...params);
  if (limite) fiches = fiches.slice(0, limite);

  console.log(`${fiches.length} fiche(s) à traiter${essai ? ' (essai)' : ''}\n`);

  const poser = db.prepare('UPDATE content SET poster_url = ?, backdrop_url = ? WHERE id = ?');
  const bilan = { trouves: 0, sansResultat: [], erreurs: 0 };

  for (const f of fiches) {
    let r;
    try {
      r = await chercher(TYPE_TMDB[f.type], f.title, f.year);
    } catch (e) {
      console.error(`  ! ${f.title} — ${e.message}`);
      if (/401/.test(e.message)) process.exit(1);
      bilan.erreurs++;
      continue;
    }

    if (!r) {
      bilan.sansResultat.push(`${f.type} — ${f.title}${f.year ? ' (' + f.year + ')' : ''}`);
      console.log(`  · ${f.title} — aucun résultat`);
      await pause(PAUSE_MS);
      continue;
    }

    const affiche = `${IMG}/w500${r.poster_path}`;
    // L'image large sert au carrousel de l'accueil. Elle manque souvent, on
    // garde alors celle déjà en place plutôt que de l'effacer.
    const paysage = r.backdrop_path ? `${IMG}/w1280${r.backdrop_path}` : f.backdrop_url;

    if (!essai) poser.run(affiche, paysage, f.id);
    bilan.trouves++;
    console.log(
      `  ✓ ${f.title} → ${r.title || r.name}${r.backdrop_path ? ' (+ paysage)' : ''}`
    );
    await pause(PAUSE_MS);
  }

  console.log(`\n${essai ? '--- essai, rien écrit ---\n' : ''}Affiches posées : ${bilan.trouves}`);
  if (bilan.erreurs) console.log(`Erreurs : ${bilan.erreurs}`);
  if (bilan.sansResultat.length) {
    console.log(`Sans résultat : ${bilan.sansResultat.length}`);
    for (const s of bilan.sansResultat) console.log('   ' + s);
  }

  if (!essai && bilan.trouves) {
    audit(null, 'affiches_tmdb', null, `${bilan.trouves} affiche(s) posée(s) depuis TMDB`);
  }
}

if (require.main === module) main();

module.exports = { variantes };
