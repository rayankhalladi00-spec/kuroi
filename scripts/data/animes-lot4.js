// Gros lot de séries animées, fiches seules — aucun épisode.
//
// Les descriptions sont rédigées pour ce site : de brèves mises en situation,
// elles ne recopient aucun résumé existant.
//
// L'année est celle de la première diffusion de l'adaptation animée. Les
// titres retenus sont ceux sous lesquels la série est connue en français,
// qui est parfois le titre original.

const animes = [
  /* --------------------------------- shonen ------------------------------- */

  ['One Piece', 1999, 'Aventure', 200,
    "Un garçon au corps élastique prend la mer avec un équipage qu'il recrute " +
    "au fil des îles, pour retrouver le trésor laissé par le roi des pirates."],

  ['Dragon Ball Z', 1989, 'Action', 30,
    "Un combattant élevé sur Terre apprend qu'il vient d'un peuple guerrier, " +
    "au moment où les siens viennent réclamer des comptes."],

  ['Fairy Tail', 2009, 'Aventure', 340,
    "Une apprentie mage rejoint une guilde bruyante et mal famée, où l'on " +
    "détruit plus de bâtiments qu'on n'en sauve."],

  ['Black Clover', 2017, 'Aventure', 260,
    "Dans un monde où tout le monde manie la magie, un orphelin n'en a aucune. " +
    "Il vise quand même le poste de chef des mages."],

  ['Tokyo Revengers', 2021, 'Action', 250,
    "Un homme sans avenir découvre qu'il peut remonter douze ans en arrière, et " +
    "tente d'empêcher la mort de son ancienne petite amie."],

  ['JoJo’s Bizarre Adventure', 2012, 'Action', 300,
    "Une famille et sa lignée traversent les générations, chaque héritier " +
    "affrontant à son époque le même mal, avec des pouvoirs très personnels."],

  ['Gintama', 2006, 'Comédie', 205,
    "Dans un Japon d'époque envahi par des extraterrestres, un samouraï " +
    "désabusé accepte n'importe quel petit boulot pour payer son loyer."],

  ['Hell’s Paradise', 2023, 'Action', 355,
    "Un condamné à mort insensible aux exécutions se voit offrir sa grâce s'il " +
    "rapporte l'élixir de vie d'une île dont personne ne revient."],

  ['Mashle', 2023, 'Comédie', 40,
    "Dans une école de magie, un élève sans le moindre pouvoir compense par une " +
    "force physique que rien n'explique."],

  ['Undead Unluck', 2023, 'Action', 350,
    "Une fille qui porte malheur à quiconque la touche rencontre un homme qui " +
    "ne peut pas mourir. Le duo est aussi improbable qu'utile."],

  ['Kaiju No. 8', 2024, 'Action', 220,
    "Un employé chargé de nettoyer les carcasses de monstres se transforme " +
    "lui-même en créature, et postule à l'unité qui les combat."],

  ['Solo Leveling', 2024, 'Action', 265,
    "Le chasseur le plus faible de son rang survit à un donjon qui décime son " +
    "groupe, et devient le seul à pouvoir progresser sans limite."],

  ['Wind Breaker', 2024, 'Action', 195,
    "Un lycéen venu pour se battre découvre que son nouveau lycée, réputé " +
    "infréquentable, protège en réalité le quartier."],

  ['Sakamoto Days', 2025, 'Action', 210,
    "Un tueur à gages légendaire a raccroché pour tenir une supérette et élever " +
    "sa fille. Son ancien milieu ne l'entend pas ainsi."],

  /* --------------------------------- drame -------------------------------- */

  ['Your Lie in April', 2014, 'Drame', 320,
    "Un ancien prodige du piano ne supporte plus le son de son instrument " +
    "depuis la mort de sa mère. Une violoniste le pousse à rejouer."],

  ['Anohana', 2011, 'Drame', 290,
    "Cinq amis d'enfance qui ne se parlent plus se retrouvent quand l'un d'eux " +
    "revoit la fille morte des années plus tôt."],

  ['Violet Evergarden', 2018, 'Drame', 210,
    "Une ancienne enfant soldat devient écrivaine publique et met des mots sur " +
    "les sentiments des autres, sans comprendre les siens."],

  ['Angel Beats!', 2010, 'Drame', 200,
    "Des adolescents morts trop tôt se retrouvent dans un lycée dont on ne sort " +
    "pas, et s'organisent contre celle qui semble en tenir les règles."],

  ['Erased', 2016, 'Psychologique', 220,
    "Un homme est renvoyé dans son enfance à chaque fois qu'un drame se prépare. " +
    "Cette fois, le retour porte sur une série d'enlèvements."],

  ['Monster', 2004, 'Psychologique', 240,
    "Un chirurgien choisit de sauver un enfant plutôt qu'un notable. Des années " +
    "plus tard, il comprend qui il a laissé vivre."],

  ['Psycho-Pass', 2012, 'Psychologique', 270,
    "Un système mesure en continu la propension au crime de chaque citoyen. " +
    "Une inspectrice débutante découvre ce qu'il en coûte."],

  ['Terror in Resonance', 2014, 'Psychologique', 200,
    "Deux adolescents revendiquent un attentat à Tokyo par des énigmes " +
    "diffusées publiquement, et un policier écarté cherche à les comprendre."],

  ['Code Geass', 2006, 'Science-fiction', 275,
    "Un prince déchu reçoit le pouvoir d'imposer un ordre à quiconque le " +
    "regarde, et s'en sert pour renverser l'empire de son père."],

  ['Golden Kamuy', 2018, 'Aventure', 25,
    "Un soldat rescapé et une chasseuse aïnou suivent la piste d'un or caché, " +
    "dont le plan est tatoué sur la peau de prisonniers évadés."],

  ['Beastars', 2019, 'Drame', 260,
    "Dans un lycée où carnivores et herbivores cohabitent mal, un loup discret " +
    "lutte contre ses propres instincts après un meurtre."],

  /* --------------------------- tranche de vie et romance ------------------ */

  ['Fruits Basket', 2019, 'Romance', 320,
    "Une lycéenne orpheline est recueillie par une famille dont les membres se " +
    "changent en animaux du zodiaque au moindre contact."],

  ['Kaguya-sama: Love Is War', 2019, 'Comédie', 340,
    "Deux têtes du conseil des élèves s'aiment sans vouloir l'avouer, et " +
    "montent des stratagèmes pour que l'autre se déclare en premier."],

  ['Oshi no Ko', 2023, 'Drame', 330,
    "Un médecin de campagne renaît dans l'enfant de l'idole qu'il admirait, et " +
    "grandit dans un milieu du spectacle qui cache beaucoup."],

  ['Bocchi the Rock!', 2022, 'Comédie', 335,
    "Une guitariste que la timidité paralyse est recrutée dans un groupe, et " +
    "doit jouer devant du monde."],

  ['My Dress-Up Darling', 2022, 'Romance', 345,
    "Un lycéen qui fabrique des poupées en secret est repéré par la fille la " +
    "plus populaire de sa classe, qui veut se faire coudre des costumes."],

  ['Skip and Loafer', 2023, 'Comédie', 190,
    "Une provinciale brillante et maladroite arrive dans un lycée de Tokyo, " +
    "avec un plan de carrière et aucun sens de l'orientation."],

  ['Komi Can’t Communicate', 2021, 'Comédie', 350,
    "Une lycéenne admirée de tous est en réalité incapable de parler aux gens. " +
    "Un camarade se donne pour tâche de lui trouver cent amis."],

  ['Kimi ni Todoke', 2009, 'Romance', 355,
    "Une lycéenne que tout le monde évite à cause de son allure se lie enfin " +
    "avec ses camarades, grâce au garçon le plus populaire de la classe."],

  ['Ouran High School Host Club', 2006, 'Comédie', 300,
    "Une boursière casse un vase hors de prix dans un lycée de riches et doit " +
    "rembourser en travaillant dans le club le plus voyant de l'école."],

  ['Given', 2019, 'Drame', 210,
    "Un guitariste accepte d'apprendre à jouer à un garçon silencieux qui " +
    "trimballe une guitare dont il ne sait rien, et qui se met à chanter."],

  ['Nichijou', 2011, 'Comédie', 180,
    "Le quotidien de lycéennes et d'une scientifique en culotte courte, où le " +
    "moindre incident prend des proportions absurdes."],

  /* ------------------------------ autres genres --------------------------- */

  ['Frieren', 2023, 'Aventure', 190,
    "Une elfe qui a vaincu le roi démon voit ses compagnons humains vieillir et " +
    "mourir, et reprend la route pour comprendre ce qu'elle a manqué."],

  ['The Apothecary Diaries', 2023, 'Mystère', 285,
    "Une apothicaire enlevée et vendue au palais impérial se fait remarquer en " +
    "résolvant des empoisonnements qu'on croyait des malédictions."],

  ['Dungeon Meshi', 2024, 'Aventure', 35,
    "Une équipe d'aventuriers ruinée descend dans un donjon en se nourrissant " +
    "des monstres qu'elle affronte, recettes à l'appui."],

  ['Ranking of Kings', 2021, 'Aventure', 45,
    "Un prince sourd et sans force, moqué par tout le royaume, se lie d'amitié " +
    "avec une ombre et part se rendre digne du trône."],

  ['The Promised Neverland', 2019, 'Psychologique', 230,
    "Des enfants heureux dans un orphelinat modèle découvrent ce qui attend " +
    "réellement ceux qui sont adoptés."],

  ['Assassination Classroom', 2015, 'Comédie', 120,
    "Une classe reléguée reçoit pour mission de tuer son professeur, une " +
    "créature qui a détruit la Lune et qui enseigne remarquablement bien."],

  ['Fire Force', 2019, 'Action', 15,
    "Des brigades spéciales affrontent des humains qui s'embrasent " +
    "spontanément. Un jeune pompier cherche ce qui est arrivé à sa famille."],

  ['Noragami', 2014, 'Fantastique', 205,
    "Un dieu mineur sans sanctuaire accepte n'importe quel travail à cinq yens, " +
    "aidé d'une lycéenne dont l'âme se détache du corps."],

  ['Bungo Stray Dogs', 2016, 'Action', 220,
    "Une agence de détectives aux pouvoirs nommés d'après des écrivains " +
    "recueille un orphelin, et se heurte à la pègre de la ville."],

  ['Zom 100', 2023, 'Comédie', 100,
    "Un salarié épuisé par son entreprise se réveille en pleine épidémie " +
    "zombie, et dresse enfin la liste de tout ce qu'il veut faire."],

  ['Ao Ashi', 2022, 'Sport', 210,
    "Un attaquant instinctif de province est repéré par un centre de formation " +
    "de Tokyo, où on lui demande de jouer à un poste qu'il déteste."],

  ['Blue Period', 2021, 'Drame', 230,
    "Un lycéen sans passion découvre la peinture et vise l'école des beaux-arts " +
    "la plus difficile du pays, à deux ans du concours."],

  ['Bakuman', 2010, 'Drame', 200,
    "Deux lycéens se lancent dans le manga, l'un au dessin, l'autre au " +
    "scénario, avec une promesse à tenir avant la fin de leurs études."],

  ['Silver Spoon', 2013, 'Comédie', 90,
    "Un élève de la ville s'inscrit dans un lycée agricole pour fuir la " +
    "pression scolaire, et découvre d'où vient ce qu'il mange."],

  ['Great Teacher Onizuka', 1999, 'Comédie', 40,
    "Un ancien voyou devient professeur, avec des méthodes que l'administration " +
    "réprouve et une classe qui a fait craquer tous ses prédécesseurs."],
];

const series = animes.map(([title, year, genre, hue, description]) => ({
  meta: { type: 'serie', title, year, genre, hue, description },
}));

module.exports = { series };
