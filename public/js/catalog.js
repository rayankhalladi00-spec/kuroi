const app = document.getElementById('app');

const LABELS = { film: 'Films', serie: 'Séries', jeu: 'Jeux' };
const SINGULAR = { film: 'Film', serie: 'Série', jeu: 'Jeu' };
const TYPE_ICON = { film: 'film', serie: 'tv', jeu: 'game' };

let data = null;
let query = '';

const pageFor = (item) => (item.type === 'jeu' ? 'game.html' : 'watch.html');

/* --------------------------------- rendu ---------------------------------- */

function card(item) {
  const poster = item.poster_url
    ? ` style="background-image:url('${esc(item.poster_url)}')"`
    : '';
  return `
    <article class="card" data-id="${item.id}" data-page="${pageFor(item)}" tabindex="0" role="link"
             aria-label="${esc(item.title)}">
      <div class="card-img"${poster}>
        ${item.poster_url ? '' : icon(TYPE_ICON[item.type], { cls: 'icon-lg' })}
        <button class="card-fav ${item.favorite ? 'on' : ''}" data-fav="${item.id}" type="button"
                aria-label="${item.favorite ? 'Retirer de ma liste' : 'Ajouter à ma liste'}"
                aria-pressed="${item.favorite ? 'true' : 'false'}">${icon('heart')}</button>
        <span class="card-play">${icon(item.type === 'jeu' ? 'download' : 'play')}</span>
        ${
          item.watched
            ? `<span class="card-seen" title="Déjà vu">${icon('check')}</span>`
            : item.type === 'serie' && item.watchedCount
              ? `<span class="card-seen partial" title="${item.watchedCount} épisode(s) vu(s)">${item.watchedCount}/${item.episodeCount}</span>`
              : ''
        }
      </div>
      <div class="card-body">
        <div class="card-title">${esc(item.title)}</div>
        <div class="card-sub">${
          [item.year, item.genre].filter(Boolean).map(esc).join(' · ') || SINGULAR[item.type]
        }</div>
      </div>
    </article>`;
}

// Carte « Reprendre » : elle porte l'episode a lancer et y mene directement.
function resumeCard(item) {
  const poster = item.poster_url ? ` style="background-image:url('${esc(item.poster_url)}')"` : '';
  const ep = item.resume;
  const progression = item.episodeCount
    ? Math.round((item.watchedCount / item.episodeCount) * 100)
    : 0;
  return `
    <a class="card resume" href="/watch.html?id=${item.id}&ep=${ep.id}"
       aria-label="Reprendre ${esc(item.title)} à la saison ${ep.season} épisode ${ep.number}">
      <div class="card-img"${poster}>
        ${item.poster_url ? '' : icon('tv', { cls: 'icon-lg' })}
        <span class="card-play">${icon('play')}</span>
        <span class="resume-bar"><span style="width:${progression}%"></span></span>
      </div>
      <div class="card-body">
        <div class="card-title">${esc(item.title)}</div>
        <div class="card-sub">S${ep.season} E${ep.number}${ep.title ? ' · ' + esc(ep.title) : ''}</div>
      </div>
    </a>`;
}

function resumeRow(items) {
  if (!items.length) return '';
  return `
    <section class="row">
      <div class="row-head">
        <h2>Reprendre</h2>
        <span class="row-count">${items.length}</span>
      </div>
      <div class="row-scroll stagger">${items.map(resumeCard).join('')}</div>
    </section>`;
}

function row(title, items) {
  if (!items.length) return '';
  return `
    <section class="row">
      <div class="row-head">
        <h2>${esc(title)}</h2>
        <span class="row-count">${items.length}</span>
      </div>
      <div class="row-scroll stagger">${items.map(card).join('')}</div>
    </section>`;
}

function hero(item) {
  if (!item) return '';
  const bg = item.poster_url ? `background-image:url('${esc(item.poster_url)}')` : '';
  return `
    <header class="hero ${item.poster_url ? '' : 'no-poster'}" style="${bg}">
      <div class="hero-inner anim-fade-up">
        <div class="hero-meta">
          ${icon(TYPE_ICON[item.type])}
          <span>${esc(SINGULAR[item.type])}${item.year ? ' · ' + esc(item.year) : ''}${
            item.genre ? ' · ' + esc(item.genre) : ''
          }</span>
        </div>
        <h1>${esc(item.title)}</h1>
        <p>${esc(item.description || '')}</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="/${pageFor(item)}?id=${item.id}">
            ${icon(item.type === 'jeu' ? 'download' : 'play')}
            ${item.type === 'jeu' ? 'Télécharger' : 'Regarder'}
          </a>
          <button class="btn" data-fav="${item.id}" type="button" aria-pressed="${item.favorite}">
            ${icon('heart')} ${item.favorite ? 'Dans ma liste' : 'Ma liste'}
          </button>
        </div>
      </div>
    </header>`;
}

function skeletons(n = 7) {
  return `<div class="row"><div class="row-scroll">${'<div class="skeleton skeleton-card"></div>'.repeat(n)}</div></div>`;
}

/* -------------------------------- assemblage ------------------------------- */

function matches(item) {
  if (!query) return true;
  const q = query.toLowerCase();
  return [item.title, item.genre, item.description, item.year]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(q));
}

function render(user) {
  const filter = new URLSearchParams(location.search).get('f');

  const groups = [
    ['film', data.films],
    ['serie', data.series],
    ['jeu', data.jeux],
  ]
    .filter(([type]) => !filter || filter === type)
    .map(([type, items]) => [type, items.filter(matches)]);

  const favoris = data.favoris.filter(matches);
  const total = groups.reduce((n, [, items]) => n + items.length, 0);

  let body;
  if (total) {
    body =
      (!filter && !query ? resumeRow(data.reprendre || []) : '') +
      (!filter && !query ? row('Ma liste', favoris) : '') +
      groups.map(([type, items]) => row(LABELS[type], items)).join('');
  } else if (query) {
    body = `<div class="empty">
      ${icon('search', { cls: 'icon-lg' })}
      <h2>Aucun résultat pour « ${esc(query)} »</h2>
      <p>Tu ne trouves pas ce que tu cherches ?</p>
      <a class="btn btn-primary" href="/idees.html">${icon('idea')} Propose-le</a>
    </div>`;
  } else {
    body = `<div class="empty">
      ${icon('inbox', { cls: 'icon-lg' })}
      <h2>Le catalogue est vide</h2>
      <p>${user.role === 'admin' ? 'Ajoute ton premier titre pour démarrer.' : 'Rien n’a encore été publié.'}</p>
      ${
        user.role === 'admin'
          ? '<a class="btn btn-primary" href="/admin">Ajouter du contenu</a>'
          : '<a class="btn btn-primary" href="/idees.html">Proposer un titre</a>'
      }
    </div>`;
  }

  // Le héros vit dans son propre conteneur : il doit rester collé sous la barre
  // de navigation, avant la barre de recherche.
  document.getElementById('hero').innerHTML = !filter && !query ? hero(data.featured) : '';
  document.getElementById('view').innerHTML = body;

  bindCards();
}

/* ------------------------------- interactions ------------------------------ */

async function toggleFavorite(id, sources) {
  const r = await api(`/api/content/${id}/favorite`, { method: 'POST' });

  // Mise à jour locale : évite de tout recharger juste pour un cœur.
  for (const list of [data.films, data.series, data.jeux]) {
    const it = list.find((x) => x.id === id);
    if (it) it.favorite = r.favorite;
  }
  if (data.featured?.id === id) data.featured.favorite = r.favorite;
  const item = [...data.films, ...data.series, ...data.jeux].find((x) => x.id === id);
  data.favoris = data.favoris.filter((x) => x.id !== id);
  if (r.favorite && item) data.favoris.unshift(item);

  for (const el of sources) {
    el.classList.toggle('on', r.favorite);
    el.setAttribute('aria-pressed', String(r.favorite));
    if (el.classList.contains('card-fav'))
      el.setAttribute('aria-label', r.favorite ? 'Retirer de ma liste' : 'Ajouter à ma liste');
    else el.innerHTML = `${icon('heart')} ${r.favorite ? 'Dans ma liste' : 'Ma liste'}`;
  }
}

function bindCards() {
  const view = document.getElementById('main');

  view.querySelectorAll('.card').forEach((el) => {
    const go = () => (location.href = `/${el.dataset.page}?id=${el.dataset.id}`);
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-fav]')) return; // le cœur ne doit pas ouvrir la fiche
      go();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      }
    });
  });

  view.querySelectorAll('[data-fav]').forEach((el) => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = Number(el.dataset.fav);
      const all = [...view.querySelectorAll(`[data-fav="${id}"]`)];
      try {
        await toggleFavorite(id, all);
      } catch {
        /* réseau indisponible : l'état reste inchangé */
      }
    });
  });
}

/* ---------------------------------- départ --------------------------------- */

(async function init() {
  const user = await currentUser();
  if (!requireLogin(user)) return;

  const filter = new URLSearchParams(location.search).get('f');
  app.innerHTML =
    renderNav(user, filter ? LABELS[filter] : 'Accueil') +
    `<div id="main">
       <div id="hero"></div>
       <div class="row">
         <div class="toolbar">
           <div class="search-wrap">
             ${icon('search')}
             <input id="search" type="search" placeholder="Rechercher un titre, un genre…"
                    aria-label="Rechercher dans le catalogue" autocomplete="off">
           </div>
         </div>
       </div>
       <div id="view">${skeletons()}</div>
     </div>`;

  wireNav();

  let timer;
  document.getElementById('search').addEventListener('input', (e) => {
    query = e.target.value.trim();
    clearTimeout(timer);
    timer = setTimeout(() => render(user), 160);
  });

  data = await api('/api/content');
  render(user);
})();
