// Series animees, fiches seules sans episodes.
//
// Ce lot a ete reduit a ce qui manquait reellement : 91 fiches proches ont
// ete ajoutees au catalogue le 6 septembre a 15h18, hors de ce depot et sans
// trace au journal. Importer la liste complete aurait cree des doublons a la
// ponctuation pres (« Kaguya-sama: Love Is War » contre « Kaguya-sama : Love
// is War »), que import-anime.js ne rapproche pas.
//
// Type serie.
//
// Les descriptions sont redigees pour ce site : de breves mises en situation,
// elles ne recopient aucun resume existant.

const oeuvres = [
  ["Mashle", 2023, "Comédie", 40,
    "Dans une école de magie, un élève sans le moindre pouvoir compense par une force physique que rien n'explique."],

  ["Undead Unluck", 2023, "Action", 350,
    "Une fille qui porte malheur à quiconque la touche rencontre un homme qui ne peut pas mourir. Le duo est aussi improbable qu'utile."],

  ["Angel Beats!", 2010, "Drame", 200,
    "Des adolescents morts trop tôt se retrouvent dans un lycée dont on ne sort pas, et s'organisent contre celle qui semble en tenir les règles."],

  ["Monster", 2004, "Psychologique", 240,
    "Un chirurgien choisit de sauver un enfant plutôt qu'un notable. Des années plus tard, il comprend qui il a laissé vivre."],

  ["Psycho-Pass", 2012, "Psychologique", 270,
    "Un système mesure en continu la propension au crime de chaque citoyen. Une inspectrice débutante découvre ce qu'il en coûte."],

  ["Terror in Resonance", 2014, "Psychologique", 200,
    "Deux adolescents revendiquent un attentat à Tokyo par des énigmes diffusées publiquement, et un policier écarté cherche à les comprendre."],

  ["Code Geass", 2006, "Science-fiction", 275,
    "Un prince déchu reçoit le pouvoir d'imposer un ordre à quiconque le regarde, et s'en sert pour renverser l'empire de son père."],

  ["Golden Kamuy", 2018, "Aventure", 25,
    "Un soldat rescapé et une chasseuse aïnou suivent la piste d'un or caché, dont le plan est tatoué sur la peau de prisonniers évadés."],

  ["Beastars", 2019, "Drame", 260,
    "Dans un lycée où carnivores et herbivores cohabitent mal, un loup discret lutte contre ses propres instincts après un meurtre."],

  ["My Dress-Up Darling", 2022, "Romance", 345,
    "Un lycéen qui fabrique des poupées en secret est repéré par la fille la plus populaire de sa classe, qui veut se faire coudre des costumes."],

  ["Skip and Loafer", 2023, "Comédie", 190,
    "Une provinciale brillante et maladroite arrive dans un lycée de Tokyo, avec un plan de carrière et aucun sens de l'orientation."],

  ["Komi Can’t Communicate", 2021, "Comédie", 350,
    "Une lycéenne admirée de tous est en réalité incapable de parler aux gens. Un camarade se donne pour tâche de lui trouver cent amis."],

  ["Kimi ni Todoke", 2009, "Romance", 355,
    "Une lycéenne que tout le monde évite à cause de son allure se lie enfin avec ses camarades, grâce au garçon le plus populaire de la classe."],

  ["Ouran High School Host Club", 2006, "Comédie", 300,
    "Une boursière casse un vase hors de prix dans un lycée de riches et doit rembourser en travaillant dans le club le plus voyant de l'école."],

  ["Given", 2019, "Drame", 210,
    "Un guitariste accepte d'apprendre à jouer à un garçon silencieux qui trimballe une guitare dont il ne sait rien, et qui se met à chanter."],

  ["Nichijou", 2011, "Comédie", 180,
    "Le quotidien de lycéennes et d'une scientifique en culotte courte, où le moindre incident prend des proportions absurdes."],

  ["The Apothecary Diaries", 2023, "Mystère", 285,
    "Une apothicaire enlevée et vendue au palais impérial se fait remarquer en résolvant des empoisonnements qu'on croyait des malédictions."],

  ["Dungeon Meshi", 2024, "Aventure", 35,
    "Une équipe d'aventuriers ruinée descend dans un donjon en se nourrissant des monstres qu'elle affronte, recettes à l'appui."],

  ["Ranking of Kings", 2021, "Aventure", 45,
    "Un prince sourd et sans force, moqué par tout le royaume, se lie d'amitié avec une ombre et part se rendre digne du trône."],

  ["Zom 100", 2023, "Comédie", 100,
    "Un salarié épuisé par son entreprise se réveille en pleine épidémie zombie, et dresse enfin la liste de tout ce qu'il veut faire."],

  ["Ao Ashi", 2022, "Sport", 210,
    "Un attaquant instinctif de province est repéré par un centre de formation de Tokyo, où on lui demande de jouer à un poste qu'il déteste."],

  ["Blue Period", 2021, "Drame", 230,
    "Un lycéen sans passion découvre la peinture et vise l'école des beaux-arts la plus difficile du pays, à deux ans du concours."],

  ["Bakuman", 2010, "Drame", 200,
    "Deux lycéens se lancent dans le manga, l'un au dessin, l'autre au scénario, avec une promesse à tenir avant la fin de leurs études."],

  ["Silver Spoon", 2013, "Comédie", 90,
    "Un élève de la ville s'inscrit dans un lycée agricole pour fuir la pression scolaire, et découvre d'où vient ce qu'il mange."],

  ["Great Teacher Onizuka", 1999, "Comédie", 40,
    "Un ancien voyou devient professeur, avec des méthodes que l'administration réprouve et une classe qui a fait craquer tous ses prédécesseurs."],
];

const series = oeuvres.map(([title, year, genre, hue, description]) => ({
  meta: { type: "serie", title, year, genre, hue, description },
}));

module.exports = { series };
