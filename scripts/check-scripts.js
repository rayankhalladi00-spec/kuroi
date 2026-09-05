// Cherche les fonctions appelees par un script de page mais definies nulle part.
//
// Raison d'etre : une suppression de code a emporte skeletons() alors que
// l'appel restait. La syntaxe demeurait valide, tous les tests passaient, et
// l'accueil s'affichait entierement vide — ReferenceError au chargement.
//
// La difficulte est que dans ce code presque tous les appels vivent dans des
// gabarits : `<div>${skeletons()}</div>`. Jeter les gabarits, c'est justement
// perdre les appels qu'on cherche. On ne garde donc, dans un gabarit, que le
// contenu des ${...}, et on jette le HTML autour.

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'public', 'js');

// Parcours caractere par caractere : les gabarits imbriques et les guillemets
// a l'interieur des ${...} mettent en defaut toute expression reguliere.
function code(src) {
  let out = '';
  let i = 0;
  const pile = []; // '`' dans un gabarit, '$' dans un ${...}

  while (i < src.length) {
    const c = src[i];
    const suivant = src[i + 1];
    const dansGabarit = pile[pile.length - 1] === '`';

    if (c === '\\') {
      i += 2;
      continue;
    }

    if (dansGabarit) {
      if (c === '`') {
        pile.pop();
        out += ' ';
      } else if (c === '$' && suivant === '{') {
        pile.push('$');
        out += ' ';
        i += 2;
        continue;
      }
      // Le HTML autour des ${...} est jete.
      i++;
      continue;
    }

    // Hors gabarit : commentaires et chaines sont du bruit.
    if (c === '/' && suivant === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && suivant === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      out += ' ';
      continue;
    }
    if (c === "'" || c === '"') {
      const fin = c;
      i++;
      while (i < src.length && src[i] !== fin) {
        if (src[i] === '\\') i++;
        i++;
      }
      i++;
      out += ' ';
      continue;
    }
    if (c === '`') {
      pile.push('`');
      out += ' ';
      i++;
      continue;
    }
    if (c === '}' && pile[pile.length - 1] === '$') {
      pile.pop();
      out += ' ';
      i++;
      continue;
    }

    out += c;
    i++;
  }
  return out;
}

// On est genereux sur ce qui compte comme « defini » : rater une definition ne
// fait que masquer un orphelin, tandis qu'en inventer une cree du bruit.
function definis(src) {
  const out = new Set();
  const ajoute = (re) => {
    for (const m of src.matchAll(re)) out.add(m[1]);
  };
  ajoute(/(?:function|class)\s+([A-Za-z_$][\w$]*)/g);
  ajoute(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g);
  ajoute(/([A-Za-z_$][\w$]*)\s*=>/g);
  for (const m of src.matchAll(/\(([^()]{0,300})\)\s*(?:=>|\{)/g)) {
    for (const p of m[1].split(',')) {
      const n = p.trim().replace(/^\.\.\./, '').split(/[\s=:.[\]]/)[0];
      if (/^[A-Za-z_$][\w$]*$/.test(n)) out.add(n);
    }
  }
  for (const m of src.matchAll(/[{[]([^{}[\]]{0,300})[}\]]\s*=/g)) {
    for (const p of m[1].split(',')) {
      const n = p.trim().split(/[\s=:]/)[0];
      if (/^[A-Za-z_$][\w$]*$/.test(n)) out.add(n);
    }
  }
  return out;
}

const GLOBAUX = new Set([
  'async', 'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'await',
  'function', 'new', 'of', 'do', 'else', 'try', 'delete', 'void', 'in', 'instanceof',
  'yield', 'super', 'this',
  'Number', 'String', 'Boolean', 'Array', 'Object', 'JSON', 'Math', 'Date', 'Set',
  'Map', 'WeakMap', 'Promise', 'RegExp', 'Error', 'Intl', 'Symbol', 'BigInt',
  'FormData', 'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader', 'Image',
  'CustomEvent', 'Event', 'AbortController', 'IntersectionObserver', 'MutationObserver',
  'fetch', 'alert', 'confirm', 'prompt', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'encodeURIComponent', 'decodeURIComponent', 'setTimeout', 'clearTimeout',
  'setInterval', 'clearInterval', 'requestAnimationFrame', 'matchMedia',
  'queueMicrotask', 'structuredClone',
]);

function verifier() {
  const communBrut = fs.readFileSync(path.join(DIR, 'common.js'), 'utf8');
  const nomsCommuns = definis(communBrut);
  const problemes = [];

  for (const f of fs.readdirSync(DIR).filter((n) => n.endsWith('.js'))) {
    const brut = fs.readFileSync(path.join(DIR, f), 'utf8');
    const src = code(brut);
    const connus = new Set([...definis(brut), ...nomsCommuns, ...GLOBAUX]);

    const orphelins = new Set();
    // Un appel : un identifiant suivi d'une parenthese, non precede d'un point
    // ni d'un « ? » (sinon c'est une methode) ni d'un mot.
    for (const m of src.matchAll(/(?:^|[^\w.?$])([A-Za-z_$][\w$]*)\s*\(/g)) {
      if (!connus.has(m[1])) orphelins.add(m[1]);
    }
    for (const n of orphelins) problemes.push(`${f} appelle ${n}(), definie nulle part`);
  }
  return problemes;
}

module.exports = { verifier };

if (require.main === module) {
  const p = verifier();
  for (const l of p) console.log('  ' + l);
  console.log(p.length ? `${p.length} appel(s) orphelin(s)` : 'aucun appel orphelin');
  process.exit(p.length ? 1 : 0);
}
