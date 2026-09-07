// Rapatrie les affiches hebergees ailleurs, et les sert depuis le site.
//
//   node scripts/rapatrier-affiches.js [--essai] [--limite N]
//
// Pourquoi. Une affiche laissee sur le serveur d'un autre site depend de son
// bon vouloir. Celui d'ou viennent les notres refuse les images quand le
// navigateur annonce venir de kuroi.me : il repond 403, et l'affiche s'affiche
// en gris. Le meme fichier demande sans referent repond 200.
//
// On ne touche pas a la politique de referent du site pour autant : elle a ete
// reglee pour que les lecteurs fonctionnent sur iPhone, et la reprendre pour
// une image casserait la lecture. On copie donc l'image chez nous, une fois.
//
// L'image rejoint data/uploads et la table files, comme une affiche televersee
// depuis le panneau d'administration ; poster_url devient /api/files/<id>/view.
// Elle reste ainsi derriere l'authentification, comme le reste du catalogue.
//
// Options :
//   --essai      montre ce qui serait fait, n'ecrit rien, ne telecharge rien
//   --limite N   s'arrete apres N affiches (pour essayer sur quelques-unes)
//
// Idempotent : une affiche deja servie par le site est ignoree.
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db, audit } = require('../db');
const { UPLOAD_DIR } = require('../lib/uploads');

const MAX = 8 * 1024 * 1024; // une affiche au-dela de 8 Mo est suspecte

// Le type annonce par le serveur fait foi : l'adresse ment parfois sur
// l'extension, et un .jpg peut renvoyer du webp.
const EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/gif': '.gif',
};

async function telecharger(url) {
  // Pas d'en-tete Referer : c'est precisement ce que le serveur d'en face
  // refuse. Un navigateur ne peut pas s'en passer, nous si.
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const ext = EXTENSIONS[type];
  if (!ext) throw new Error(`type inattendu : ${type || 'inconnu'}`);

  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error('reponse vide');
  if (buf.length > MAX) throw new Error(`${Math.round(buf.length / 1024)} Ko, trop gros`);

  return { buf, ext, mime: type };
}

async function main() {
  const args = process.argv.slice(2);
  const essai = args.includes('--essai');
  const i = args.indexOf('--limite');
  const limite = i >= 0 ? Number(args[i + 1]) : Infinity;

  const fiches = db
    .prepare(
      `SELECT id, title, poster_url FROM content
       WHERE poster_url LIKE 'http%' ORDER BY title`
    )
    .all();

  console.log(`Affiches hebergees ailleurs : ${fiches.length}`);
  if (!fiches.length) return;
  console.log(essai ? '--- essai : rien ne sera telecharge ni ecrit ---\n' : '');

  const ajouterFichier = db.prepare(
    `INSERT INTO files (content_id, kind, original_name, stored_name, mime, size)
     VALUES (?, 'poster', ?, ?, ?, ?)`
  );
  const poser = db.prepare('UPDATE content SET poster_url = ? WHERE id = ?');

  let posees = 0;
  const echecs = [];

  for (const fiche of fiches.slice(0, limite === Infinity ? undefined : limite)) {
    const court = fiche.title.padEnd(42).slice(0, 42);

    if (essai) {
      console.log(`  ${court} ${fiche.poster_url.slice(0, 60)}`);
      posees++;
      continue;
    }

    let image;
    try {
      image = await telecharger(fiche.poster_url);
    } catch (e) {
      echecs.push(`${fiche.title} — ${e.message}`);
      console.log(`  ${court} ECHEC : ${e.message}`);
      continue;
    }

    const stored = crypto.randomBytes(8).toString('hex') + image.ext;
    // Le fichier d'abord, la base ensuite : une ligne sans fichier donne une
    // affiche cassee, un fichier sans ligne ne fait que dormir.
    fs.writeFileSync(path.join(UPLOAD_DIR, stored), image.buf);

    const nom = path.basename(new URL(fiche.poster_url).pathname) || 'affiche' + image.ext;
    const res = ajouterFichier.run(fiche.id, nom, stored, image.mime, image.buf.length);
    poser.run(`/api/files/${res.lastInsertRowid}/view`, fiche.id);

    posees++;
    console.log(`  ${court} ${Math.round(image.buf.length / 1024)} Ko`);
  }

  console.log('');
  console.log(essai ? `${posees} affiche(s) seraient rapatriee(s).` : `${posees} affiche(s) rapatriee(s).`);
  if (echecs.length) {
    console.log(`\nEchecs : ${echecs.length}`);
    for (const e of echecs.slice(0, 15)) console.log('  ' + e);
    if (echecs.length > 15) console.log(`  … et ${echecs.length - 15} autres`);
  }

  if (!essai && posees) {
    audit(null, 'rapatriement_affiches', null, `${posees} affiche(s) rapatriee(s) sur le site`);
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}

module.exports = { EXTENSIONS };
