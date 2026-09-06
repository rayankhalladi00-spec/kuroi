// Films hors animation et hors Marvel, ajoutés à la demande.
//
// Les descriptions sont rédigées pour ce site : de brèves mises en situation,
// elles ne recopient aucun résumé existant.

const oeuvres = [
  ['Obsession', 2026, 'Horreur', 285,
    "Un jeune homme solitaire met la main sur un objet qui exauce les vœux. " +
    "Celle qu'il regardait de loin s'attache alors à lui sans plus pouvoir " +
    "s'en détacher, et le souhait tourne au piège."],
];

const series = oeuvres.map(([title, year, genre, hue, description]) => ({
  meta: { type: 'film', title, year, genre, hue, description },
}));

module.exports = { series };
