// Rick et Morty — titres releves saison par saison puis recoupes sur une
// seconde source. Les saisons 3 et 7 ont montre des ecarts entre catalogues
// francophones sur quelques titres ; la version conservee est celle du releve,
// signalee comme telle plutot que tranchee au hasard.
//
// Aucun resume : je n en ai pas de verifie, et mieux vaut vide qu invente.

const meta = {
  title: 'Rick et Morty',
  year: 2013,
  genre: 'Comédie',
};

const titles = {
  1: [
    "De la graine de héros",
    "I, Croquette",
    "Anatomy Park",
    "M. Night Shaym-Aliens!",
    "La boîte à larbins",
    "E-Rick-xir d'amour",
    "Gazorpazorp Junior",
    "Télé...visions",
    "La petite bou-Rick des horreurs",
    "Rencontres du 3e Rick",
    "Ricksy Business"
  ],
  2: [
    "Effet Rick-ochet",
    "Prout, l'extra-terrestre",
    "Assimilation auto-érotique",
    "Total Rickall",
    "On va vous faire schwifter",
    "Les Ricks sont tombés sur la tête",
    "Mini-Rick, méga hic",
    "Câble interdimensionnel 2 : Tenter le destin",
    "Qui est-ce qui purge, maintenant ?",
    "Mariage à la squanchaise"
  ],
  3: [
    "L'Évadé de Rick-catraz",
    "À la Rick-suite du diamant vert",
    "Rick-ornichon",
    "Revancheurs 3 : Finisseurdemondes le retour",
    "Tournez manège !",
    "Détente et Ricklaxation",
    "Contes de la Citadelle",
    "Les Souvenirs effacés de Morty",
    "La Belle et la Beth",
    "Les Hommes-Morty du Rick-sident"
  ],
  4: [
    "Edge of Tomorty: Rick Die Rickpeat",
    "Le Vieil Homme et la merde",
    "Vol au-dessus d'un nid de Morty",
    "C'est mon dragon et bien plus encore",
    "Rattlestar Ricklactica",
    "Rickstoires sans fin",
    "Promortheus",
    "L'Episode de la cuve d'acide",
    "Les Rick de Morty",
    "Star Mort : Le Ricktour du Jerry"
  ],
  5: [
    "Les Ricksins de la colère",
    "Mes doubles, mon Morty et moi",
    "Une Vérickté qui dérange",
    "Rickdependence Jet",
    "Amortycan Grafrickty",
    "Rick et Morty : Spécial Thanksgiving",
    "GoTron JerrySis Rickvangelion",
    "Rick, un ami qui vous veut pas que du bien",
    "Sans SaRick rien ne va",
    "SamouRick Jack"
  ],
  6: [
    "Solaricks",
    "Une Mort-vie bien vécue",
    "Bethic Instinct",
    "Famille nocturne",
    "Desmithation finale",
    "JuRicksic Mort",
    "Le Héros aux mille et un Rick",
    "De mal en pisse",
    "Les Rickvalier du Roi Morthur",
    "Le Père Rick-Noël est une Mortyure"
  ],
  7: [
    "La Vie, c'est comme une Boîte-À-Caca",
    "Deux Rick ami-ami",
    "Air Force Wong",
    "Soleil Ve-Rick",
    "ImpRicktoyable",
    "Mater n'est pas jouer",
    "Wet Kuat Amortican Summer",
    "Le Soulèvement des Numéricons : le film",
    "Mort : Ragnarick",
    "ConjuRick"
  ],
  8: [
    "La Summer de toutes les peurs",
    "Valkyrick",
    "Le Rick, Le Mort & Le Truand",
    "La Dernière tentation de Jerry",
    "Cryo Mort a Rickver",
    "L'Étrange Rickstoire de Benjamin Button",
    "L'Incroyable Destin de HaMort Rick",
    "NoMortland",
    "Tel Morty, tel Junior",
    "Sexy Rick"
  ]
};

module.exports = { meta, titles };
