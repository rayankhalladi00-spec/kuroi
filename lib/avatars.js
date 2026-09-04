const fs = require('fs');
const path = require('path');

// Les photos de profil sont un jeu fige, pose dans public/img/avatars/.
// Aucun televersement n'est offert aux membres : sinon chaque compte
// stockerait sa propre image sur le serveur. Ajouter une photo au choix
// consiste simplement a deposer un fichier dans ce dossier.
const DIR = path.join(__dirname, '..', 'public', 'img', 'avatars');
const EXT = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.avif'];

// La liste est relue a chaque appel : deposer un fichier suffit, sans
// redemarrer le serveur.
function list() {
  try {
    return fs
      .readdirSync(DIR)
      .filter((f) => EXT.includes(path.extname(f).toLowerCase()))
      .sort()
      .map((f) => ({ id: path.parse(f).name, url: `/img/avatars/${f}` }));
  } catch {
    return [];
  }
}

function exists(id) {
  return list().some((a) => a.id === id);
}

// Adresse a servir au client, ou null si l'identifiant ne correspond a rien
// (photo retiree du dossier depuis que le membre l'a choisie).
function urlFor(id) {
  return list().find((a) => a.id === id)?.url ?? null;
}

module.exports = { list, exists, urlFor, DIR };
