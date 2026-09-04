const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../db');

// Les photos de profil sont un jeu fige : les membres choisissent dedans, mais
// n'y ajoutent rien. C'est l'administration qui l'alimente.
//
// Elles viennent de deux endroits, et il faut les deux :
//
//  * FOURNIES : livrees avec le code, dans public/img/avatars/. Servies en
//    statique. Ce dossier est en lecture seule sur le serveur.
//  * ENVOYEES : deposees depuis l'administration, dans data/avatars/.
//
// Le service tourne avec ProtectSystem=strict et ReadWritePaths=/opt/kuroi/data :
// tout le systeme de fichiers lui est en lecture seule sauf data/. Ecrire dans
// public/ echouait donc avec EROFS. Les envois vont desormais dans data/, comme
// les affiches et les pieces jointes, et sont servis par une route dediee.
const DIR_FOURNIES = path.join(__dirname, '..', 'public', 'img', 'avatars');
const DIR_ENVOYEES = path.join(DATA_DIR, 'avatars');

const EXT = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.avif', '.gif'];

function lire(dir) {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => EXT.includes(path.extname(f).toLowerCase()))
      .sort();
  } catch {
    return []; // dossier absent : simplement aucune photo de cette provenance
  }
}

// La liste est relue a chaque appel : deposer un fichier suffit, sans
// redemarrer le serveur.
function list() {
  return [
    ...lire(DIR_FOURNIES).map((f) => ({
      id: path.parse(f).name,
      url: `/img/avatars/${f}`,
      fournie: true,
    })),
    ...lire(DIR_ENVOYEES).map((f) => ({
      id: path.parse(f).name,
      url: `/api/avatars/${f}`,
      fournie: false,
    })),
  ];
}

function exists(id) {
  return list().some((a) => a.id === id);
}

// Adresse a servir au client, ou null si l'identifiant ne correspond a rien
// (photo retiree depuis que le membre l'a choisie).
function urlFor(id) {
  return list().find((a) => a.id === id)?.url ?? null;
}

// Chemin sur le disque, pour la suppression. Renvoie null pour une photo
// fournie avec le code : elle n'est pas supprimable, le dossier est en
// lecture seule.
function cheminSupprimable(id) {
  const a = list().find((x) => x.id === id);
  if (!a || a.fournie) return null;
  return path.join(DIR_ENVOYEES, path.basename(a.url));
}

module.exports = { list, exists, urlFor, cheminSupprimable, DIR_FOURNIES, DIR_ENVOYEES };
