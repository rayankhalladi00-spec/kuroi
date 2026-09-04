const app = document.getElementById('app');

const TYPE_ICON = { film: 'film', serie: 'tv', jeu: 'game' };
let entries = [];

// Horodatage complet : l'interet d'un historique est de savoir quand.
function quand(s) {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T') + 'Z');
  if (isNaN(d)) return s;
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function ligne(e) {
  const affiche = e.poster_url
    ? `<span class="hist-poster" style="background-image:url('${esc(e.poster_url)}')"></span>`
    : `<span class="hist-poster placeholder">${icon(TYPE_ICON[e.type] || 'film')}</span>`;

  const sousTitre = e.episode_id
    ? `S${e.season} E${e.number}${e.episode_title ? ' · ' + esc(e.episode_title) : ''}`
    : { film: 'Film', serie: 'Série', jeu: 'Jeu' }[e.type] || '';

  const lien = e.type === 'jeu'
    ? `/game.html?id=${e.content_id}`
    : `/watch.html?id=${e.content_id}${e.episode_id ? '&ep=' + e.episode_id : ''}`;

  return `
    <article class="hist" data-content="${e.content_id}" data-episode="${e.episode_id || ''}">
      <a class="hist-main" href="${lien}">
        ${affiche}
        <span class="hist-body">
          <span class="hist-title">${esc(e.title)}</span>
          <span class="hist-sub">${sousTitre}</span>
        </span>
      </a>
      <time class="hist-when">${quand(e.watched_at)}</time>
      <button class="icon-btn" data-oublier type="button"
              aria-label="Retirer ${esc(e.title)} de l’historique">${icon('trash')}</button>
    </article>`;
}

function render() {
  const liste = document.getElementById('histList');
  if (!entries.length) {
    liste.innerHTML = `<div class="empty">
      ${icon('inbox', { cls: 'icon-lg' })}
      <h2>Historique vide</h2>
      <p>Ce que tu regardes apparaîtra ici, avec la date et l’heure.</p>
      <a class="btn btn-primary" href="/">Parcourir le catalogue</a>
    </div>`;
  } else {
    liste.innerHTML = entries.map(ligne).join('');
  }
  document.getElementById('histCount').textContent = entries.length || '';
  document.getElementById('clearBtn').hidden = !entries.length;
}

async function load() {
  const r = await api('/api/history');
  entries = r.history;
  render();
}

(async function init() {
  const user = await currentUser();
  if (!requireLogin(user)) return;

  app.innerHTML =
    renderNav(user, 'Historique') +
    `<div class="page">
       <div class="page-head">
         <h1>Historique <span class="row-count" id="histCount"></span></h1>
         <p>Tout ce que tu as marqué comme vu, du plus récent au plus ancien.
            Retirer une ligne la remet en « non vu ».</p>
       </div>
       <div class="toolbar">
         <button class="btn btn-danger" id="clearBtn" type="button" hidden>
           ${icon('trash')} Tout effacer
         </button>
       </div>
       <div id="histList"></div>
     </div>`;

  wireNav();

  document.getElementById('histList').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-oublier]');
    if (!b) return;
    e.preventDefault();
    const ligneEl = b.closest('.hist');
    const contentId = ligneEl.dataset.content;
    const episodeId = ligneEl.dataset.episode;
    b.disabled = true;
    try {
      const q = `contentId=${contentId}` + (episodeId ? `&episodeId=${episodeId}` : '');
      await api('/api/history?' + q, { method: 'DELETE' });
      entries = entries.filter(
        (x) => !(String(x.content_id) === contentId && String(x.episode_id || '') === episodeId)
      );
      render();
    } catch {
      b.disabled = false;
    }
  });

  document.getElementById('clearBtn').addEventListener('click', async (e) => {
    if (!confirm('Effacer tout l’historique ? Les titres repasseront en « non vu ».')) return;
    e.target.disabled = true;
    try {
      await api('/api/history/all', { method: 'DELETE' });
      entries = [];
      render();
    } finally {
      e.target.disabled = false;
    }
  });

  await load();
})();
