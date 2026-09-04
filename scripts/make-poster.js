// Genere une affiche typographique pour une serie, en SVG.
//
// Volontairement pas de visuel officiel : ces images appartiennent a leurs
// ayants droit. Une affiche sobre au titre de l'oeuvre evite une grille de
// cartes vides sans emprunter le travail de quelqu'un. A remplacer par une
// vraie affiche depuis /admin quand on en a une.
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'public', 'img', 'posters');

function slug(titre) {
  return titre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// Coupe le titre en lignes tenant dans la largeur de l'affiche.
function lignes(titre, maxParLigne = 13) {
  const mots = titre.split(/\s+/);
  const out = [];
  let courante = '';
  for (const mot of mots) {
    if (!courante) courante = mot;
    else if ((courante + ' ' + mot).length <= maxParLigne) courante += ' ' + mot;
    else {
      out.push(courante);
      courante = mot;
    }
  }
  if (courante) out.push(courante);
  return out.slice(0, 4);
}

function generer(titre, teinte) {
  fs.mkdirSync(DIR, { recursive: true });
  const nom = slug(titre) + '.svg';
  const l = lignes(titre.toUpperCase());
  const taille = l.length > 2 ? 46 : 58;
  const depart = 300 - ((l.length - 1) * taille * 1.1) / 2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" role="img" aria-label="${esc(titre)}">
  <defs>
    <linearGradient id="f" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${teinte} 62% 22%)"/>
      <stop offset="1" stop-color="hsl(${(teinte + 40) % 360} 55% 9%)"/>
    </linearGradient>
  </defs>
  <rect width="400" height="600" fill="url(#f)"/>
  <g fill="none" stroke="hsl(${teinte} 70% 60%)" stroke-opacity=".16" stroke-width="2">
    <circle cx="330" cy="120" r="120"/>
    <circle cx="60" cy="500" r="90"/>
  </g>
  <text x="200" y="${depart}" text-anchor="middle" fill="#fff"
        font-family="Bebas Neue, Impact, sans-serif" font-size="${taille}" letter-spacing="2">
    ${l.map((t, i) => `<tspan x="200" dy="${i ? taille * 1.1 : 0}">${esc(t)}</tspan>`).join('')}
  </text>
  <rect x="150" y="${depart + l.length * taille * 1.1 + 14}" width="100" height="3" fill="hsl(${teinte} 80% 58%)"/>
</svg>`;

  fs.writeFileSync(path.join(DIR, nom), svg);
  return `/img/posters/${nom}`;
}

module.exports = { generer, slug };

if (require.main === module) {
  const titre = process.argv.slice(2).join(' ');
  if (!titre) {
    console.error('Usage : node scripts/make-poster.js <titre>');
    process.exit(1);
  }
  console.log(generer(titre, 350));
}
