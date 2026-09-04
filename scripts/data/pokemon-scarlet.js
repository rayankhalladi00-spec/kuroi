// Pokémon Scarlet — jeu déjà présent en base, ajouté à la main par Rayan avec
// son affiche et son lien de téléchargement. Ce fichier ne complète que les
// champs restés vides : l'import n'écrase jamais une valeur déjà saisie.

const meta = {
  type: 'jeu',
  title: 'Pokémon Scarlet',
  year: 2022,
  genre: 'RPG',
  hue: 5,
  description:
    "Neuvième génération de la série, en monde ouvert. Trois intrigues se " +
    "croisent librement dans la région de Paldea : le championnat des arènes, " +
    "la chasse aux Épices Mystiques et la Team Star.",
};

// Un jeu n'a pas d'épisodes.
const titles = {};
const synopses = {};

module.exports = { meta, titles, synopses };
