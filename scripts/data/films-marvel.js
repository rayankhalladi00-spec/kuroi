// Films Marvel : l'univers cinématographique, plus les Spider-Man des autres
// studios et les Deadpool de la Fox, que Rayan a demandés ensemble.
//
// Les descriptions sont rédigées pour ce site : de brèves mises en situation,
// elles ne recopient aucun résumé existant.
//
// Comme films-animes.js, ce fichier exporte plusieurs œuvres via `series`.

const films = [
  /* ------------------------- univers cinématographique ------------------- */

  ['Iron Man', 2008, 'Action', 20,
    "Un industriel de l'armement est enlevé et blessé au cours d'une " +
    "démonstration. Il s'échappe dans une armure bricolée en captivité, puis " +
    "décide de fermer sa propre branche militaire."],

  ['L’Incroyable Hulk', 2008, 'Action', 120,
    "Un chercheur en fuite cherche un remède à la transformation qui le prend " +
    "dès que son rythme cardiaque s'emballe, pendant que l'armée le traque."],

  ['Iron Man 2', 2010, 'Action', 20,
    "Sommé de livrer son armure au gouvernement, l'industriel refuse, tandis " +
    "que le réacteur qui le maintient en vie l'empoisonne lentement."],

  ['Thor', 2011, 'Action', 210,
    "Un prince héritier déclenche une guerre par orgueil. Déchu et privé de ses " +
    "pouvoirs, il est exilé sur Terre pour apprendre ce qu'il n'a pas compris."],

  ['Captain America : First Avenger', 2011, 'Action', 220,
    "Refusé à l'engagement pour sa constitution fragile, un jeune homme accepte " +
    "un protocole expérimental et devient le visage d'une campagne de guerre."],

  ['Avengers', 2012, 'Action', 210,
    "Une agence réunit des individus qui ne se supportent pas pour empêcher un " +
    "envahisseur d'ouvrir un portail au-dessus de New York."],

  ['Iron Man 3', 2013, 'Action', 15,
    "Après la bataille de New York, l'industriel ne dort plus et enchaîne les " +
    "armures. Un attentat détruit sa maison et le laisse sans rien."],

  ['Thor : Le Monde des ténèbres', 2013, 'Action', 250,
    "Une force antérieure à l'univers se réveille, et le prince asgardien doit " +
    "s'allier à son frère, qu'il vient d'emprisonner pour trahison."],

  ['Captain America : Le Soldat de l’hiver', 2014, 'Action', 200,
    "Un attentat contre son supérieur révèle que l'agence qui l'emploie est " +
    "infiltrée depuis des décennies. Le soldat ne sait plus à qui se fier."],

  ['Les Gardiens de la Galaxie', 2014, 'Aventure', 280,
    "Un pillard vole un artefact sans savoir ce qu'il contient. Poursuivi de " +
    "toutes parts, il s'associe à quatre marginaux aussi peu recommandables."],

  ['Avengers : L’Ère d’Ultron', 2015, 'Action', 0,
    "Une intelligence artificielle conçue pour protéger la Terre conclut que la " +
    "menace, c'est l'humanité, et se donne les moyens d'agir."],

  ['Ant-Man', 2015, 'Action', 340,
    "Un cambrioleur fraîchement sorti de prison hérite d'une combinaison qui " +
    "réduit sa taille, et du casse qui va avec."],

  ['Captain America : Civil War', 2016, 'Action', 355,
    "Après une opération qui tourne mal, les États réclament une tutelle sur " +
    "l'équipe. Elle se scinde en deux camps qui refusent de céder."],

  ['Doctor Strange', 2016, 'Fantastique', 300,
    "Un chirurgien perd l'usage de ses mains dans un accident. En quête d'une " +
    "guérison, il trouve un enseignement qui n'a rien de médical."],

  ['Les Gardiens de la Galaxie Vol. 2', 2017, 'Aventure', 300,
    "Le père du pillard se manifeste enfin. L'équipe découvre qui il est, et " +
    "ce qu'il attend de son fils."],

  ['Spider-Man : Homecoming', 2017, 'Action', 355,
    "Un lycéen new-yorkais veut prouver qu'il mérite mieux que les petits " +
    "délits de quartier, pendant qu'un ferrailleur revend des armes récupérées."],

  ['Thor : Ragnarok', 2017, 'Aventure', 285,
    "Privé de son marteau et vendu comme gladiateur à l'autre bout de la " +
    "galaxie, le prince doit rentrer avant que son royaume ne soit détruit."],

  ['Black Panther', 2018, 'Action', 275,
    "Un royaume africain cache sa véritable richesse au reste du monde. À la " +
    "mort du roi, son fils monte sur le trône et un prétendant se présente."],

  ['Avengers : Infinity War', 2018, 'Action', 265,
    "Un titan parcourt l'univers pour réunir six pierres et exécuter un plan " +
    "qu'il juge nécessaire. Personne n'arrive à l'arrêter à temps."],

  ['Ant-Man et la Guêpe', 2018, 'Action', 45,
    "Assigné à résidence, le cambrioleur est tiré de chez lui pour une mission " +
    "de sauvetage dans un monde microscopique."],

  ['Captain Marvel', 2019, 'Action', 230,
    "Une combattante amnésique échoue sur Terre au milieu d'une guerre entre " +
    "deux espèces, et remonte le fil de sa propre histoire."],

  ['Avengers : Endgame', 2019, 'Action', 210,
    "Les survivants vivent avec la défaite depuis cinq ans. Une piste inattendue " +
    "leur offre une dernière tentative."],

  ['Spider-Man : Far From Home', 2019, 'Action', 220,
    "Parti en voyage scolaire en Europe pour souffler, le lycéen se retrouve " +
    "enrôlé contre des créatures élémentaires par un héros venu d'ailleurs."],

  ['Black Widow', 2021, 'Action', 0,
    "En fuite, l'espionne renoue avec la fausse famille de son enfance et " +
    "remonte jusqu'au programme qui l'a formée."],

  ['Shang-Chi et la Légende des Dix Anneaux', 2021, 'Action', 30,
    "Un jeune homme qui a fui son père et son entraînement est rattrapé par " +
    "l'organisation familiale, et doit affronter ce qu'il avait laissé."],

  ['Les Éternels', 2021, 'Aventure', 40,
    "Des immortels envoyés sur Terre il y a des millénaires, tenus à la " +
    "non-intervention, se rassemblent quand leur consigne n'a plus de sens."],

  ['Spider-Man : No Way Home', 2021, 'Action', 350,
    "Son identité révélée au monde, le lycéen demande qu'on l'oublie. Le sort " +
    "dérape et fait venir des visiteurs d'ailleurs."],

  ['Doctor Strange in the Multiverse of Madness', 2022, 'Fantastique', 290,
    "Une adolescente capable de traverser les univers est poursuivie. La " +
    "protéger oblige le sorcier à voir ce que sont ses autres versions."],

  ['Thor : Love and Thunder', 2022, 'Aventure', 320,
    "Un homme décidé à tuer tous les dieux entre en scène, au moment où le " +
    "marteau du prince choisit quelqu'un d'autre."],

  ['Black Panther : Wakanda Forever', 2022, 'Action', 265,
    "Le royaume pleure son roi et doit tenir seul face aux convoitises, tandis " +
    "qu'un peuple sous-marin sort de son isolement."],

  ['Ant-Man et la Guêpe : Quantumania', 2023, 'Aventure', 190,
    "Toute la famille est aspirée dans le monde microscopique, où règne un " +
    "conquérant banni par les siens."],

  ['Les Gardiens de la Galaxie Vol. 3', 2023, 'Aventure', 300,
    "Pour sauver l'un des leurs, l'équipage remonte jusqu'au scientifique qui " +
    "l'a fabriqué, et découvre ce qu'il a subi."],

  ['The Marvels', 2023, 'Action', 235,
    "Trois héroïnes échangent leur place dès qu'elles utilisent leurs pouvoirs " +
    "en même temps, et doivent apprendre à s'en servir ensemble."],

  ['Deadpool & Wolverine', 2024, 'Action', 355,
    "Un mercenaire bavard va chercher un mutant griffu dans une autre réalité " +
    "pour sauver la sienne. Ni l'un ni l'autre n'en a envie."],

  ['Captain America : Brave New World', 2025, 'Action', 215,
    "Le nouveau porteur du bouclier se retrouve pris dans un incident " +
    "international qui met en cause la présidence des États-Unis."],

  ['Thunderbolts', 2025, 'Action', 250,
    "Un groupe d'anciens agents et de repris de justice est envoyé sur une " +
    "mission dont ils ne devaient pas revenir."],

  /* ------------------------- Spider-Man, autres studios ------------------ */

  ['Spider-Man', 2002, 'Action', 355,
    "Mordu par une araignée modifiée, un lycéen timide découvre ce qu'il peut " +
    "faire, et ce qu'il en coûte de ne rien faire."],

  ['Spider-Man 2', 2004, 'Action', 15,
    "Ses pouvoirs vacillent, ses études s'effondrent, et un chercheur devenu " +
    "monstrueux tient la ville. Il envisage d'arrêter."],

  ['Spider-Man 3', 2007, 'Action', 275,
    "Une substance venue de l'espace s'accroche à son costume et le change. " +
    "Deux ennemis surgissent en même temps."],

  ['The Amazing Spider-Man', 2012, 'Action', 200,
    "En cherchant ce qui est arrivé à ses parents, un lycéen entre dans le " +
    "laboratoire où travaillait son père, et en ressort transformé."],

  ['The Amazing Spider-Man : Le Destin d’un héros', 2014, 'Action', 190,
    "Le héros jongle entre sa promesse à un père et son histoire d'amour, " +
    "pendant qu'un employé négligé devient une menace électrique."],

  ['Spider-Man : New Generation', 2018, 'Animation', 290,
    "Un adolescent du Bronx devient l'homme-araignée de son monde, puis voit " +
    "arriver ses homologues d'autres univers, tous très différents."],

  ['Spider-Man : Across the Spider-Verse', 2023, 'Animation', 320,
    "Une société d'hommes-araignées venus de partout applique une règle que le " +
    "héros refuse d'accepter, et il fuit à travers les univers."],

  /* ------------------------------- Deadpool ------------------------------ */

  ['Deadpool', 2016, 'Action', 355,
    "Un ancien militaire atteint d'un cancer accepte un traitement qui le " +
    "défigure et le rend difficile à tuer. Il part chercher le responsable."],

  ['Deadpool 2', 2018, 'Action', 350,
    "Le mercenaire s'improvise protecteur d'un adolescent aux pouvoirs " +
    "incontrôlables, poursuivi par un soldat venu du futur."],
];

const series = films.map(([title, year, genre, hue, description]) => ({
  meta: { type: 'film', title, year, genre, hue, description },
}));

module.exports = { series };
