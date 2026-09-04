// Films d'animation. Aucun épisode : la fiche suffit.
//
// Les descriptions sont rédigées pour ce site : ce sont de brèves mises en
// situation, elles ne recopient aucun résumé existant.
//
// Ce fichier ne suit pas la forme habituelle (une œuvre par fichier) : il en
// exporte plusieurs via le tableau `series`, que import-anime.js reconnaît.

const films = [
  ['Your Name', 2016, 'Fantastique', 210,
    "Une lycéenne de province et un lycéen de Tokyo se réveillent régulièrement " +
    "dans le corps l'un de l'autre, sans comprendre pourquoi. Quand les échanges " +
    "cessent, l'un des deux part chercher l'autre."],

  ['Le Voyage de Chihiro', 2001, 'Fantastique', 165,
    "En route vers leur nouvelle maison, une fillette et ses parents s'égarent " +
    "dans un parc abandonné. Ses parents y sont changés en porcs, et elle doit " +
    "travailler dans des bains fréquentés par les esprits pour les récupérer."],

  ['A Silent Voice', 2016, 'Drame', 195,
    "Des années après avoir harcelé une camarade sourde jusqu'à la faire changer " +
    "d'école, un lycéen isolé cherche à la retrouver pour réparer ce qu'il peut " +
    "encore réparer."],

  ['Princesse Mononoké', 1997, 'Aventure', 120,
    "Frappé par une malédiction, un jeune prince quitte son village et arrive " +
    "là où une cité minière et les esprits de la forêt se font la guerre. " +
    "Il refuse de choisir un camp."],

  ['Mon voisin Totoro', 1988, 'Famille', 100,
    "Deux sœurs emménagent à la campagne pendant l'hospitalisation de leur mère, " +
    "et découvrent que les bois voisins abritent des créatures que seuls les " +
    "enfants aperçoivent."],

  ['Le Château ambulant', 2004, 'Fantastique', 45,
    "Changée en vieille femme par une sorcière, une jeune chapelière se réfugie " +
    "dans la demeure mouvante d'un magicien redouté, pendant qu'une guerre " +
    "s'étend au dehors."],

  ['Le Tombeau des lucioles', 1988, 'Drame', 20,
    "Japon, 1945. Un adolescent et sa petite sœur, restés seuls après un " +
    "bombardement, tentent de survivre dans les derniers mois de la guerre."],

  ['Akira', 1988, 'Science-fiction', 350,
    "Néo-Tokyo, 2019. Après un accident de moto, un jeune motard voit s'éveiller " +
    "en lui un pouvoir que l'armée traque depuis des décennies. Son meilleur ami " +
    "essaie de le rattraper."],

  ['Ghost in the Shell', 1995, 'Science-fiction', 180,
    "Une section d'élite traque un pirate capable de s'emparer des esprits " +
    "connectés. Sa cheffe, au corps entièrement synthétique, s'interroge sur ce " +
    "qui lui reste d'humain."],

  ['Perfect Blue', 1997, 'Thriller', 300,
    "Une chanteuse quitte son groupe pour devenir actrice. À mesure que son " +
    "nouveau rôle la dévore, elle ne distingue plus ce qu'elle vit de ce qu'elle " +
    "joue — et quelqu'un la suit."],

  ['Paprika', 2006, 'Science-fiction', 320,
    "Un appareil permettant d'entrer dans les rêves d'autrui est volé. Les songes " +
    "des uns commencent à déborder sur le quotidien des autres."],

  ['La Traversée du temps', 2006, 'Fantastique', 145,
    "Une lycéenne découvre qu'elle peut revenir en arrière de quelques minutes. " +
    "Elle s'en sert pour des broutilles, jusqu'à comprendre que chaque saut a " +
    "un coût."],

  ['Les Enfants loups', 2012, 'Drame', 105,
    "Restée seule avec deux enfants qui peuvent prendre forme de loup, une mère " +
    "quitte la ville pour un hameau isolé où ils pourront grandir sans se cacher."],

  ['Les Enfants du temps', 2019, 'Fantastique', 200,
    "Un lycéen fugueur arrive à Tokyo sous une pluie qui n'en finit pas, et " +
    "rencontre une jeune fille capable de dégager le ciel — à un prix qu'elle " +
    "lui cache."],

  ['Suzume', 2022, 'Aventure', 175,
    "Une lycéenne referme des portes qui s'ouvrent un peu partout sur le pays et " +
    "laissent passer les catastrophes, accompagnée d'un garçon changé en chaise."],

  ['Le Garçon et le Héron', 2023, 'Fantastique', 155,
    "Après la mort de sa mère, un garçon envoyé à la campagne suit un héron qui " +
    "lui parle jusque dans une tour où les vivants et les morts se croisent."],

  ['Demon Slayer : Le Train de l’Infini', 2020, 'Action', 15,
    "Envoyés enquêter sur les disparitions d'un train de nuit, les pourfendeurs " +
    "y affrontent un démon capable de plonger ses passagers dans un sommeil dont " +
    "on ne veut plus sortir."],

  ['Jujutsu Kaisen 0', 2021, 'Action', 280,
    "Hanté par l'esprit d'une amie d'enfance devenu incontrôlable, un adolescent " +
    "entre dans l'école d'exorcistes sous la surveillance de ceux qui envisagent " +
    "de l'exécuter."],
];

const series = films.map(([title, year, genre, hue, description]) => ({
  meta: { type: 'film', title, year, genre, hue, description },
}));

module.exports = { series };
