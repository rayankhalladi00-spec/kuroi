// Films d animation, surtout le fonds Ghibli et Hosoda.
//
// Ce lot a ete reduit a ce qui manquait reellement : 91 fiches proches ont
// ete ajoutees au catalogue le 6 septembre a 15h18, hors de ce depot et sans
// trace au journal. Importer la liste complete aurait cree des doublons a la
// ponctuation pres (« Kaguya-sama: Love Is War » contre « Kaguya-sama : Love
// is War »), que import-anime.js ne rapproche pas.
//
// Type film.
//
// Les descriptions sont redigees pour ce site : de breves mises en situation,
// elles ne recopient aucun resume existant.

const oeuvres = [
  ["Nausicaä de la vallée du vent", 1984, "Aventure", 100,
    "Mille ans après un cataclysme, une forêt toxique gagne du terrain. La princesse d'une petite vallée refuse la guerre que ses voisins préparent."],

  ["Le Château dans le ciel", 1986, "Aventure", 200,
    "Une fille tombe du ciel, retenue par une pierre qui brille. Des pirates et l'armée la cherchent pour la cité volante à laquelle elle mène."],

  ["Kiki la petite sorcière", 1989, "Famille", 340,
    "À treize ans, une apprentie sorcière doit partir vivre un an seule dans une ville inconnue. Elle y monte un service de livraison volante."],

  ["Souvenirs goutte à goutte", 1991, "Drame", 50,
    "Une femme de vingt-sept ans part travailler à la campagne et repense, tout au long du trajet, à l'enfant qu'elle était."],

  ["Porco Rosso", 1992, "Aventure", 10,
    "Un ancien pilote de chasse, changé en cochon, chasse les pirates de l'air au-dessus de l'Adriatique et refuse de rentrer dans le rang."],

  ["Pompoko", 1994, "Comédie", 30,
    "Des tanukis capables de se métamorphoser tentent d'arrêter le chantier qui rase leur colline, par la ruse plutôt que par la force."],

  ["Le Royaume des chats", 2002, "Famille", 45,
    "Une lycéenne sauve un chat sans savoir qu'il est prince. En remerciement, on l'invite au royaume des chats — et on veut l'y garder."],

  ["Ponyo sur la falaise", 2008, "Famille", 195,
    "Un petit garçon recueille un poisson rouge échoué qui veut devenir humaine. La mer se déséquilibre à mesure qu'elle s'obstine."],

  ["Arrietty, le petit monde des chapardeurs", 2010, "Famille", 90,
    "Une famille de dix centimètres vit sous le plancher et emprunte aux humains ce qu'il lui faut. La fille se fait voir par un garçon malade."],

  ["La Colline aux coquelicots", 2011, "Romance", 210,
    "Dans le Japon des années soixante, des lycéens se battent pour sauver leur vieux foyer, pendant que deux d'entre eux découvrent un lien de famille."],

  ["Le vent se lève", 2013, "Drame", 200,
    "Un ingénieur myope qui rêvait de voler conçoit des avions dont il sait à quoi ils serviront, pendant que la femme qu'il aime s'affaiblit."],

  ["Le Conte de la princesse Kaguya", 2013, "Drame", 60,
    "Un coupeur de bambou trouve une enfant minuscule dans une tige. Devenue femme, elle est courtisée par des princes qu'elle éconduit d'épreuves."],

  ["Summer Wars", 2009, "Science-fiction", 190,
    "Un lycéen doué en mathématiques accepte de jouer le petit ami d'une camarade devant sa famille, au moment où un programme déraille en ligne."],

  ["Le Garçon et la Bête", 2015, "Aventure", 20,
    "Un enfant fugueur passe dans un monde de bêtes et devient l'élève d'un guerrier solitaire, aussi mal élevé que lui."],

  ["Mirai, ma petite sœur", 2018, "Famille", 330,
    "Un petit garçon jaloux de sa sœur nouveau-née rencontre, dans le jardin, des membres de sa famille à d'autres âges de leur vie."],

  ["Belle", 2021, "Science-fiction", 300,
    "Une lycéenne qui n'ose plus chanter devient une star dans un monde virtuel, où elle croise une créature que tout le monde traque."],

  ["Redline", 2009, "Action", 355,
    "Un pilote sans assistance électronique s'engage dans une course interdite sur une planète militaire qui ne veut pas d'elle."],

  ["Les Enfants de la mer", 2019, "Fantastique", 195,
    "Une collégienne mise à l'écart rencontre deux garçons élevés par des dugongs, au moment où les poissons du monde entier se rassemblent."],

  ["Le Sommet des dieux", 2021, "Aventure", 210,
    "Un photographe retrouve à Katmandou un appareil qui pourrait dire si l'Everest a été vaincu bien avant ce qu'on croit."],

  ["Josée, le tigre et les poissons", 2020, "Romance", 205,
    "Un étudiant qui économise pour partir plonger au Mexique est engagé comme aide d'une jeune femme en fauteuil, qui dessine et ne sort jamais."],

  ["Miss Hokusai", 2015, "Drame", 25,
    "La fille du peintre Hokusai travaille dans l'ombre de son père, signe des œuvres à son nom, et mène sa vie comme elle l'entend."],

  ["The First Slam Dunk", 2022, "Sport", 0,
    "Pendant un match décisif, le meneur d'une équipe de lycée revit ce qui l'a mené jusque-là, et ce qu'il doit à son frère."],

  ["Dragon Ball Super: Broly", 2018, "Action", 35,
    "Un guerrier survivant d'un peuple détruit est élevé loin de tout pour la vengeance de son père, et se révèle plus fort que quiconque."],

  ["One Piece Film: Red", 2022, "Aventure", 350,
    "Une chanteuse dont la voix rassemble le monde entier donne un concert sur une île, et l'équipage découvre de qui elle est la fille."],
];

const series = oeuvres.map(([title, year, genre, hue, description]) => ({
  meta: { type: "film", title, year, genre, hue, description },
}));

module.exports = { series };
