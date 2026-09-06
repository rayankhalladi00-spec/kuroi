// Films Marvel restants.
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
  ["L’Incroyable Hulk", 2008, "Action", 120,
    "Un chercheur en fuite cherche un remède à la transformation qui le prend dès que son rythme cardiaque s'emballe, pendant que l'armée le traque."],

  ["Captain America : Brave New World", 2025, "Action", 215,
    "Le nouveau porteur du bouclier se retrouve pris dans un incident international qui met en cause la présidence des États-Unis."],

  ["Thunderbolts", 2025, "Action", 250,
    "Un groupe d'anciens agents et de repris de justice est envoyé sur une mission dont ils ne devaient pas revenir."],
];

const series = oeuvres.map(([title, year, genre, hue, description]) => ({
  meta: { type: "film", title, year, genre, hue, description },
}));

module.exports = { series };
