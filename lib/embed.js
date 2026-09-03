const { db } = require('../db');

// Extensions traitées comme un fichier vidéo direct (balise <video>) plutôt
// que comme un lecteur externe (balise <iframe>).
const VIDEO_EXT = /\.(mp4|webm|ogv|ogg|m4v|mov)(\?|#|$)/i;

/**
 * Accepte ce que l'administrateur colle dans le champ « lecteur » :
 *   - une URL simple            → https://exemple.com/embed/abc
 *   - un code d'intégration     → <iframe src="//exemple.com/e/abc" …></iframe>
 * et n'en garde que l'adresse du lecteur.
 *
 * On ne stocke jamais le HTML fourni : l'afficher tel quel permettrait
 * d'injecter un script exécuté chez tous les visiteurs (XSS stocké).
 * On reconstruit nous-mêmes une balise propre à partir de cette seule adresse.
 *
 * @returns {{url: string, upgraded: boolean}}
 * @throws  {Error} si aucune adresse exploitable n'est trouvée
 */
function extractEmbedUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) throw new Error('Lien ou code d’intégration vide.');

  // src="…" d'une balise iframe/embed/source, sinon l'entrée telle quelle.
  const tag = raw.match(/<(?:iframe|embed|source|video)[^>]*\ssrc\s*=\s*["']([^"']+)["']/i);
  let candidate = tag ? tag[1] : raw;

  // Un reste de balises signifie qu'on n'a pas su isoler l'adresse.
  if (!tag && /<[a-z]/i.test(candidate))
    throw new Error("Code d’intégration non reconnu : colle le lien du lecteur, ou un code contenant une balise <iframe src=\"…\">.");

  candidate = candidate.replace(/&amp;/g, '&').trim();
  if (candidate.startsWith('//')) candidate = 'https:' + candidate;

  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(`Adresse invalide : ${candidate.slice(0, 80)}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new Error('Seules les adresses http et https sont acceptées.');

  // Le site est servi en HTTPS : un lecteur en HTTP serait bloqué par le
  // navigateur (contenu mixte). On tente donc le HTTPS d'office.
  let upgraded = false;
  if (url.protocol === 'http:') {
    url.protocol = 'https:';
    upgraded = true;
  }

  return { url: url.toString(), upgraded };
}

function isDirectVideo(url) {
  return VIDEO_EXT.test(url || '');
}

/* ---------------------------------------------------------------------------
 * La politique de sécurité du contenu (CSP) n'autorise l'affichage que des
 * domaines réellement utilisés par le catalogue. La liste est recalculée à
 * partir de la base, et mise en cache jusqu'à la prochaine modification.
 * ------------------------------------------------------------------------- */

let cache = null;
// Incrémenté à chaque invalidation : permet à server.js de savoir quand
// reconstruire l'en-tête CSP, qui attend une liste figée.
let version = 0;

function embedHostsVersion() {
  return version;
}

function embedHosts() {
  if (cache) return cache;
  const hosts = new Set();
  for (const row of db.prepare("SELECT video_url FROM content WHERE video_url IS NOT NULL AND video_url <> ''").all()) {
    try {
      const u = new URL(row.video_url);
      if (u.protocol === 'https:' || u.protocol === 'http:') hosts.add(u.origin);
    } catch {
      /* adresse illisible : ignorée */
    }
  }
  cache = [...hosts];
  return cache;
}

function invalidateEmbedHosts() {
  cache = null;
  version++;
}

module.exports = {
  extractEmbedUrl,
  isDirectVideo,
  embedHosts,
  embedHostsVersion,
  invalidateEmbedHosts,
};
