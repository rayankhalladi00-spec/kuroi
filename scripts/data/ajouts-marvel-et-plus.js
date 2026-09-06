// Gros lot d'ajouts : Marvel et Spider-Man, quelques films hors animation,
// et une trentaine de series qui manquaient au catalogue.
//
// Les descriptions sont redigees pour ce site : de breves mises en situation,
// elles ne recopient aucun resume existant. Titres et annees sont des faits.
//
// Ce fichier exporte plusieurs oeuvres via le tableau `series`, forme que
// import-anime.js reconnait. Aucune n'a d'episodes : la fiche suffit, les
// episodes se posent ensuite.

/* ------------------------------ films Marvel ------------------------------- */

const marvel = [
  ['Iron Man', 2008, 'Action', 20,
    "Un industriel de l'armement est enlevé et blessé. Il s'échappe grâce à une armure " +
    "bricolée en captivité, puis décide de la perfectionner plutôt que de vendre des armes."],
  ['Iron Man 2', 2010, 'Action', 20,
    "L'armure qui le maintient en vie est aussi en train de l'empoisonner, pendant qu'un " +
    "rival et le fils d'un ancien associé lui contestent son invention."],
  ['Thor', 2011, 'Fantastique', 210,
    "Un prince arrogant est privé de ses pouvoirs et banni sur Terre par son père, le temps " +
    "d'apprendre ce que vaut un trône."],
  ['Captain America : First Avenger', 2011, 'Action', 210,
    "Réformé pour faiblesse, un jeune homme est accepté dans un programme militaire " +
    "expérimental pendant la Seconde Guerre mondiale."],
  ['Avengers', 2012, 'Action', 200,
    "Une organisation réunit des individus qui n'ont ni l'habitude ni l'envie de travailler " +
    "ensemble, face à une invasion venue d'ailleurs."],
  ['Iron Man 3', 2013, 'Action', 15,
    "Insomniaque depuis la bataille de New York, il perd tout et doit repartir de rien, " +
    "sans ses ateliers ni ses armures."],
  ['Thor : Le Monde des ténèbres', 2013, 'Fantastique', 230,
    "Une force antérieure aux royaumes refait surface, et il doit s'allier à son frère, " +
    "qu'il a toutes les raisons de ne pas croire."],
  ['Captain America : Le Soldat de l’hiver', 2014, 'Action', 205,
    "Il découvre que l'organisation qu'il sert est infiltrée depuis des décennies, et se " +
    "retrouve traqué par un tueur dont le visage lui est familier."],
  ['Les Gardiens de la Galaxie', 2014, 'Science-fiction', 280,
    "Un pilleur d'épaves, une tueuse, un colosse, un raton laveur armé et un arbre qui ne dit " +
    "qu'une phrase se retrouvent en prison ensemble, puis obligés de coopérer."],
  ['Avengers : L’Ère d’Ultron', 2015, 'Action', 200,
    "Une intelligence artificielle conçue pour protéger la Terre conclut que la menace, " +
    "c'est l'humanité."],
  ['Ant-Man', 2015, 'Action', 340,
    "Un cambrioleur fraîchement sorti de prison hérite d'une combinaison qui permet de " +
    "changer de taille, et d'un vieil inventeur qui a un cambriolage à lui proposer."],
  ['Captain America : Civil War', 2016, 'Action', 195,
    "Après trop de dégâts collatéraux, on demande aux héros de rendre des comptes. " +
    "Le groupe se coupe en deux sur la question."],
  ['Doctor Strange', 2016, 'Fantastique', 290,
    "Un chirurgien perd l'usage de ses mains dans un accident. Sa recherche d'un remède le " +
    "mène auprès de gens qui lui proposent tout autre chose."],
  ['Les Gardiens de la Galaxie Vol. 2', 2017, 'Science-fiction', 300,
    "L'équipe rencontre celui qui se présente comme le père de leur capitaine, pendant que " +
    "chacun règle ses comptes avec sa propre famille."],
  ['Spider-Man : Homecoming', 2017, 'Action', 10,
    "Quinze ans, un stage inventé pour justifier ses absences, et un ferrailleur devenu " +
    "trafiquant d'armes qui se trouve être le père d'une camarade."],
  ['Thor : Ragnarok', 2017, 'Fantastique', 275,
    "Privé de son marteau et vendu comme gladiateur à l'autre bout de la galaxie, il doit " +
    "rentrer avant que son royaume ne soit rasé."],
  ['Black Panther', 2018, 'Action', 265,
    "Un roi monte sur le trône d'un pays qui cache sa richesse au monde, et voit arriver un " +
    "prétendant qui connaît le secret de famille."],
  ['Avengers : Infinity War', 2018, 'Action', 260,
    "Un titan collectionne des pierres qui, réunies, donnent le pouvoir de réécrire " +
    "l'univers. Il en manque encore quelques-unes."],
  ['Ant-Man et la Guêpe', 2018, 'Action', 45,
    "Assigné à résidence, il est tiré de chez lui pour une expédition dans un monde " +
    "microscopique où quelqu'un est resté coincé trente ans."],
  ['Captain Marvel', 2019, 'Science-fiction', 30,
    "Une combattante sans souvenirs s'écrase sur Terre dans les années 1990 et remonte le fil " +
    "de ce qu'on lui a fait oublier."],
  ['Avengers : Endgame', 2019, 'Action', 205,
    "Les survivants vivent depuis cinq ans avec leur échec, jusqu'à ce qu'une idée improbable " +
    "leur donne une dernière chose à tenter."],
  ['Spider-Man : Far From Home', 2019, 'Action', 0,
    "Un voyage scolaire en Europe tourne court : on lui demande d'aider un homme qui prétend " +
    "venir d'un autre monde."],
  ['Black Widow', 2021, 'Action', 0,
    "Elle retrouve la fausse famille de son enfance d'espionne pour en finir avec le " +
    "programme qui les a fabriquées."],
  ['Shang-Chi et la Légende des Dix Anneaux', 2021, 'Action', 35,
    "Voiturier à San Francisco sous un faux nom, il est rattrapé par le père qu'il a fui et " +
    "par l'organisation que celui-ci dirige."],
  ['Les Éternels', 2021, 'Science-fiction', 320,
    "Des immortels envoyés sur Terre il y a des millénaires, avec l'interdiction d'intervenir " +
    "dans l'histoire humaine, se réunissent enfin pour comprendre pourquoi."],
  ['Spider-Man : No Way Home', 2021, 'Action', 350,
    "Son identité révélée, il demande qu'on l'efface de toutes les mémoires. Le sort dérape " +
    "et fait entrer des visiteurs d'autres mondes."],
  ['Doctor Strange in the Multiverse of Madness', 2022, 'Fantastique', 305,
    "Une adolescente capable de traverser les mondes est poursuivie par quelque chose qui " +
    "veut son pouvoir."],
  ['Thor : Love and Thunder', 2022, 'Fantastique', 315,
    "Un homme décidé à tuer les dieux traverse l'univers, pendant que son ancienne compagne " +
    "se retrouve à porter son marteau."],
  ['Black Panther : Wakanda Forever', 2022, 'Action', 270,
    "Un pays pleure son roi et doit tenir face au reste du monde, puis face à un peuple sous-marin " +
    "qui protège le même secret."],
  ['Ant-Man et la Guêpe : Quantumania', 2023, 'Science-fiction', 150,
    "Toute la famille est aspirée dans le monde microscopique, où règne quelqu'un qui attendait " +
    "précisément leur venue."],
  ['Les Gardiens de la Galaxie Vol. 3', 2023, 'Science-fiction', 130,
    "Pour sauver l'un des leurs, l'équipe doit exhumer le passé de laboratoire du raton laveur."],
  ['The Marvels', 2023, 'Science-fiction', 55,
    "Trois femmes échangent de place chaque fois qu'elles usent de leurs pouvoirs, ce qui les " +
    "oblige à s'entendre très vite."],
  ['Deadpool & Wolverine', 2024, 'Action', 5,
    "Un mercenaire bavard va chercher, dans un autre monde, un homme qui n'a aucune envie de " +
    "l'aider."],
  ['Deadpool', 2016, 'Action', 0,
    "Un ancien militaire atteint d'un cancer accepte un traitement qui le laisse défiguré et " +
    "quasi indestructible. Il part chercher celui qui lui a fait ça."],
  ['Deadpool 2', 2018, 'Action', 350,
    "Il monte une équipe improvisée pour protéger un adolescent d'un soldat venu du futur."],
  ['Logan', 2017, 'Drame', 25,
    "Vieilli et affaibli, il conduit une enfant vers le nord, poursuivi par ceux qui l'ont créée."],
];

/* --------------------------- Spider-Man hors MCU --------------------------- */

const spiderman = [
  ['Spider-Man', 2002, 'Action', 355,
    "Mordu par une araignée modifiée, un lycéen timide découvre ses capacités le jour où il " +
    "apprend, trop tard, ce que coûte de ne pas s'en servir."],
  ['Spider-Man 2', 2004, 'Action', 210,
    "Ses pouvoirs le lâchent par intermittence pendant qu'un chercheur brillant devient " +
    "prisonnier de sa propre invention."],
  ['Spider-Man 3', 2007, 'Action', 250,
    "Une substance venue de l'espace s'accroche à son costume et fait ressortir ce qu'il a de " +
    "moins recommandable."],
  ['The Amazing Spider-Man', 2012, 'Action', 190,
    "En cherchant ce qui est arrivé à ses parents, un lycéen tombe sur les travaux d'un " +
    "biologiste manchot qui teste sur lui-même."],
  ['The Amazing Spider-Man : Le Destin d’un héros', 2014, 'Action', 60,
    "Un technicien ignoré de tous devient électricité pure, pendant qu'un ami d'enfance " +
    "malade réclame son sang."],
  ['Spider-Man : New Generation', 2018, 'Animation', 285,
    "Un adolescent du Bronx hérite des pouvoirs au moment où des versions de lui venues " +
    "d'autres mondes débarquent dans le sien."],
  ['Spider-Man : Across the Spider-Verse', 2023, 'Animation', 330,
    "Il découvre une société entière de gens comme lui, et une règle qu'il refuse d'accepter."],
];

/* ------------------------- films hors animation ---------------------------- */

const autresFilms = [
  ['Inception', 2010, 'Science-fiction', 215,
    "Une équipe entre dans les rêves pour y voler des idées. On leur demande cette fois d'en " +
    "déposer une."],
  ['Interstellar', 2014, 'Science-fiction', 220,
    "La Terre s'épuise. Un ancien pilote laisse ses enfants pour aller chercher, de l'autre côté " +
    "d'un passage, un monde où recommencer."],
  ['The Dark Knight', 2008, 'Action', 240,
    "Un criminel sans mobile ni exigence met la ville au défi de rester honnête."],
  ['Fight Club', 1999, 'Thriller', 10,
    "Un employé insomniaque rencontre un vendeur de savon, et ils fondent ensemble un club dont " +
    "la première règle est de ne pas en parler."],
  ['Seven', 1995, 'Thriller', 200,
    "Deux inspecteurs suivent un tueur qui met en scène ses meurtres autour des sept péchés."],
  ['Gone Girl', 2014, 'Thriller', 195,
    "Une femme disparaît le jour de son anniversaire de mariage, et l'enquête se retourne peu " +
    "à peu contre son mari."],
  ['Shutter Island', 2010, 'Thriller', 225,
    "Deux marshals enquêtent sur l'évasion impossible d'une patiente, dans un hôpital " +
    "psychiatrique sur une île isolée."],
  ['Whiplash', 2014, 'Drame', 40,
    "Un batteur de conservatoire tombe sur un professeur qui pousse ses élèves jusqu'à la " +
    "rupture, et décide de tenir."],
  ['Parasite (2019)', 2019, 'Thriller', 100,
    "Une famille sans ressources s'introduit une par une au service d'une famille fortunée."],
  ['Le Loup de Wall Street', 2013, 'Drame', 45,
    "L'ascension d'un courtier qui monte une maison de titres sur des ventes agressives et de " +
    "l'argent qui n'existe pas."],
  ['Joker', 2019, 'Drame', 280,
    "Un clown pour anniversaires, humilié partout où il passe, glisse lentement vers autre chose."],
  ['Matrix', 1999, 'Science-fiction', 130,
    "Un informaticien découvre que le monde où il vit est une simulation, et qu'on l'attendait."],
  ['Django Unchained', 2012, 'Aventure', 25,
    "Un esclave affranchi apprend le métier de chasseur de primes auprès de celui qui l'a libéré, " +
    "puis part chercher sa femme."],
  ['Le Prestige', 2006, 'Thriller', 235,
    "Deux illusionnistes se détruisent l'un l'autre pour percer le secret d'un tour."],
  ['Blade Runner 2049', 2017, 'Science-fiction', 30,
    "Un agent chargé de retirer les anciens modèles découvre une preuve qui remet en cause la " +
    "frontière entre humains et répliques."],
  ['Dune', 2021, 'Science-fiction', 35,
    "Une famille noble reçoit la charge d'une planète désertique dont l'unique ressource est " +
    "convoitée par tous."],
  ['Oppenheimer', 2023, 'Drame', 20,
    "Le physicien qui a dirigé la mise au point de la bombe, et ce qu'on lui a fait payer ensuite."],
  ['Everything Everywhere All at Once', 2022, 'Science-fiction', 300,
    "Une gérante de laverie débordée par ses impôts se découvre au centre d'un conflit qui " +
    "traverse tous les mondes possibles."],
];

/* --------------------------- series a completer ---------------------------- */

const seriesTv = [
  ['One Piece', 1999, 'Aventure', 210,
    "Un garçon élastique part chercher le trésor laissé par le roi des pirates, en recrutant " +
    "un équipage un membre à la fois."],
  ['Dragon Ball Z', 1989, 'Action', 35,
    "Devenu adulte, le combattant élevé sur Terre apprend d'où il vient le jour où sa famille " +
    "d'origine vient le chercher."],
  ['Fairy Tail', 2009, 'Fantastique', 340,
    "Une magicienne rejoint une guilde connue pour ses résultats et pour les dégâts qu'elle laisse " +
    "derrière elle."],
  ['Black Clover', 2017, 'Fantastique', 15,
    "Deux orphelins visent le même titre. L'un a une magie immense, l'autre n'en a aucune."],
  ['Tokyo Revengers', 2021, 'Action', 190,
    "Un homme sans avenir remonte douze ans en arrière pour empêcher la mort de son ancienne " +
    "petite amie."],
  ['Fire Force', 2019, 'Action', 20,
    "Des brigades combattent des humains qui s'enflamment. Le nouvel arrivant cherche surtout à " +
    "savoir ce qui est arrivé à sa mère."],
  ['Bungo Stray Dogs', 2016, 'Action', 230,
    "Une agence de détectives aux capacités particulières recrute un adolescent chassé de son " +
    "orphelinat."],
  ['The Promised Neverland', 2019, 'Thriller', 130,
    "Trois enfants d'un orphelinat modèle découvrent ce qui arrive vraiment à ceux qui sont adoptés."],
  ['Assassination Classroom', 2015, 'Comédie', 90,
    "Une classe reléguée reçoit pour mission de tuer son professeur avant la fin de l'année. " +
    "Il est aussi le meilleur qu'ils aient eu."],
  ['Violet Evergarden', 2018, 'Drame', 195,
    "Une ancienne enfant soldat devient écrivain public et apprend, lettre après lettre, ce que " +
    "les gens veulent dire."],
  ['Your Lie in April', 2014, 'Drame', 330,
    "Un pianiste qui n'entend plus son instrument depuis la mort de sa mère rencontre une " +
    "violoniste qui joue comme elle l'entend."],
  ['Fruits Basket', 2019, 'Romance', 320,
    "Une lycéenne orpheline est recueillie par une famille dont les membres se transforment en " +
    "animaux au moindre contact."],
  ['Frieren', 2023, 'Aventure', 180,
    "Une elfe qui a vaincu le roi démon voit ses compagnons humains vieillir et mourir, et repart " +
    "sur leurs traces pour comprendre ce qu'elle a manqué."],
  ['Oshi no Ko', 2023, 'Drame', 340,
    "Un médecin et sa patiente renaissent comme les enfants d'une idole, et grandissent dans les " +
    "coulisses du spectacle."],
  ['Solo Leveling', 2024, 'Action', 250,
    "Le plus faible des chasseurs de donjons survit à un massacre et se retrouve seul à pouvoir " +
    "gagner en puissance."],
  ['Kaiju No. 8', 2024, 'Action', 200,
    "Un employé du nettoyage après les attaques de monstres se retrouve transformé en l'un d'eux, " +
    "au moment précis où il tentait enfin d'entrer dans les forces de défense."],
  ['Jojo’s Bizarre Adventure', 2012, 'Action', 300,
    "Une famille et sa rivalité héréditaire, traversées sur plusieurs générations et plusieurs " +
    "continents."],
  ['Gintama', 2006, 'Comédie', 210,
    "Dans un Japon d'époque envahi par des extraterrestres, un ancien samouraï accepte n'importe " +
    "quel petit boulot pour payer le loyer."],
  ['Hell’s Paradise', 2023, 'Action', 355,
    "Un condamné à mort obtient sa grâce s'il rapporte l'élixir d'immortalité d'une île dont " +
    "personne ne revient."],
  ['Wind Breaker', 2024, 'Action', 220,
    "Un lycéen venu pour se battre découvre que son école protège le quartier au lieu de le rançonner."],
  ['Sakamoto Days', 2025, 'Action', 190,
    "Un tueur à gages à la retraite tient une épicerie de quartier. Son ancien milieu ne l'a pas " +
    "oublié."],
  ['Overlord', 2015, 'Fantastique', 285,
    "Le dernier joueur d'un jeu en ligne qui ferme reste coincé dans le corps de son personnage, " +
    "un mort-vivant que tous redoutent."],
  ['Erased', 2016, 'Thriller', 205,
    "Un homme revit malgré lui des minutes passées, jusqu'au jour où il est renvoyé dix-huit ans " +
    "en arrière, quelques semaines avant un enlèvement."],
  ['Kaguya-sama : Love is War', 2019, 'Comédie', 330,
    "Deux élèves brillants s'aiment sans vouloir l'avouer, et transforment chaque conversation en " +
    "manœuvre pour faire craquer l'autre."],
  ['Anohana', 2011, 'Drame', 150,
    "Cinq amis d'enfance séparés par un accident sont réunis par la sixième, que seul l'un d'eux voit."],
  ['Noragami', 2014, 'Fantastique', 195,
    "Un dieu sans sanctuaire accepte des petits travaux à cinq yens, en attendant d'avoir un " +
    "temple à lui."],
  ['Black Butler', 2008, 'Fantastique', 265,
    "Un enfant devenu chef de famille à dix ans est servi par un majordome qui exécute tout ce " +
    "qu'on lui demande, en échange d'une chose."],
  ['Tokyo Revengers : Christmas Showdown', 2023, 'Action', 0,
    "La suite du conflit entre bandes, après le retour dans le passé."],
  ['Bocchi the Rock!', 2022, 'Comédie', 350,
    "Une guitariste incapable d'adresser la parole à quiconque est recrutée dans un groupe la " +
    "veille d'un concert."],
  ['Sword Art Online : Alicization', 2018, 'Science-fiction', 220,
    "Un joueur se réveille dans un monde qu'il ne peut pas quitter, peuplé d'êtres qui ignorent " +
    "qu'ils sont des programmes."],
];

/* ---------------------------------- export --------------------------------- */

const enFilm = (t) =>
  t.map(([title, year, genre, hue, description]) => ({
    meta: { type: 'film', title, year, genre, hue, description },
  }));

const enSerie = (t) =>
  t.map(([title, year, genre, hue, description]) => ({
    meta: { type: 'serie', title, year, genre, hue, description },
  }));

const series = [
  ...enFilm(marvel),
  ...enFilm(spiderman),
  ...enFilm(autresFilms),
  ...enSerie(seriesTv),
];

module.exports = { series };
