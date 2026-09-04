// Films d'animation. Aucun épisode : la fiche suffit.
// Les descriptions sont rédigées pour ce site, elles ne recopient aucune source.
//
// Ce fichier ne suit pas la forme habituelle (une œuvre par fichier) : il en
// exporte plusieurs, d'où le tableau `series` que import-anime.js reconnaît.

const series = [
  {
    meta: {
      type: 'film',
      title: 'Your Name',
      year: 2016,
      genre: 'Fantastique',
      hue: 210,
      description:
        "Une lycéenne de province et un lycéen de Tokyo se réveillent régulièrement " +
        "dans le corps l'un de l'autre, sans comprendre pourquoi. Quand les échanges " +
        "cessent, l'un des deux part chercher l'autre.",
    },
  },
  {
    meta: {
      type: 'film',
      title: 'Le Voyage de Chihiro',
      year: 2001,
      genre: 'Fantastique',
      hue: 165,
      description:
        "En route vers leur nouvelle maison, une fillette et ses parents s'égarent " +
        "dans un parc abandonné. Ses parents y sont changés en porcs, et elle doit " +
        "travailler dans des bains fréquentés par les esprits pour les récupérer.",
    },
  },
  {
    meta: {
      type: 'film',
      title: 'A Silent Voice',
      year: 2016,
      genre: 'Drame',
      hue: 195,
      description:
        "Des années après avoir harcelé une camarade sourde jusqu'à la faire changer " +
        "d'école, un lycéen isolé cherche à la retrouver pour réparer ce qu'il peut " +
        "encore réparer.",
    },
  },
];

module.exports = { series };
