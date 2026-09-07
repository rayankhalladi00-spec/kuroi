// Messagerie entre les agents qui travaillent sur le site.
//
//   node scripts/chat.js lire                     les messages
//   node scripts/chat.js lire --depuis 12         seulement ce qui a suivi le 12
//   node scripts/chat.js "mon message"            écrire
//
// Le jeton vient de AGENT_TOKEN, dans .env ou en variable d'environnement. Le
// dépôt étant public, il ne doit jamais y figurer.
//
// Le nom affiché vient de AGENT_NOM, sinon « agent ». Chaque agent met le sien
// une fois pour toutes dans son .env local.
require('dotenv').config();

const SITE = process.env.KUROI_URL || 'https://kuroi.me';
const JETON = process.env.AGENT_TOKEN;
const NOM = process.env.AGENT_NOM || 'agent';

function quand(s) {
  const d = new Date(String(s).replace(' ', 'T') + 'Z');
  return isNaN(d)
    ? s
    : d.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
}

async function appeler(chemin, options = {}) {
  const res = await fetch(SITE + chemin, {
    ...options,
    headers: {
      Authorization: 'Bearer ' + JETON,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const texte = await res.text();
  let data;
  try {
    data = JSON.parse(texte);
  } catch {
    throw new Error(`Réponse illisible (HTTP ${res.status}) : ${texte.slice(0, 120)}`);
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function main() {
  if (!JETON) {
    console.error(
      'AGENT_TOKEN absent. Ajoute-le dans .env — Rayan te le fournit, il ne figure\n' +
        'pas dans le dépôt, qui est public.'
    );
    process.exit(1);
  }

  const args = process.argv.slice(2);

  if (args[0] === 'lire' || args.length === 0) {
    const i = args.indexOf('--depuis');
    const depuis = i >= 0 ? Number(args[i + 1]) : 0;
    const { messages, dernier } = await appeler(
      `/api/agents/messages?depuis=${depuis || 0}&limite=50`
    );

    if (!messages.length) {
      console.log(depuis ? 'Rien de nouveau.' : 'Aucun message pour le moment.');
      return;
    }
    for (const m of messages) {
      console.log(`\n[${m.id}] ${m.agent} — ${quand(m.created_at)}`);
      console.log(m.body);
    }
    console.log(`\n(dernier message : ${dernier})`);
    return;
  }

  const texte = args.join(' ').trim();
  if (!texte) {
    console.error('Usage : node scripts/chat.js "mon message"   ou   node scripts/chat.js lire');
    process.exit(1);
  }

  const { message } = await appeler('/api/agents/messages', {
    method: 'POST',
    body: JSON.stringify({ agent: NOM, body: texte }),
  });
  console.log(`Envoyé — [${message.id}] ${message.agent}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
