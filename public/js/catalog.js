const app = document.getElementById('app');

const LABELS = { film: 'Films', serie: 'Séries', jeu: 'Jeux' };
const SINGULAR = { film: 'Film', serie: 'Série', jeu: 'Jeu' };
const ICONS = { film: '🎬', serie: '📺', jeu: '🎮' };

function card(item) {
  const poster = item.poster_url
    ? ` style="background-image:url('${esc(item.poster_url)}')"`
    : '';
  const inner = item.poster_url ? '' : ICONS[item.type];
  return `
    <article class="card" data-id="${item.id}" data-type="${esc(item.type)}"
             data-url="${esc(item.external_url || '')}">
      <div class="card-img"${poster}>${inner}</div>
      <div class="card-body">
        <div class="card-title">${esc(item.title)}</div>
        <div class="card-sub">${[item.year, item.genre].filter(Boolean).map(esc).join(' · ') || SINGULAR[item.type]}</div>
      </div>
    </article>`;
}

function row(title, items) {
  if (!items.length) return '';
  return `
    <section class="row">
      <h2>${esc(title)}</h2>
      <div class="row-scroll">${items.map(card).join('')}</div>
    </section>`;
}

function hero(item) {
  if (!item) return '';
  const bg = item.poster_url ? `background-image:url('${esc(item.poster_url)}')` : '';
  const action =
    item.type === 'jeu'
      ? `<a class="btn btn-primary" href="${esc(item.external_url || '#')}" target="_blank" rel="noopener noreferrer">▶ Jouer</a>`
      : `<a class="btn btn-primary" href="/watch.html?id=${item.id}">▶ Regarder</a>`;
  return `
    <header class="hero" style="${bg}">
      <div class="hero-inner">
        <div class="hero-meta">${esc(SINGULAR[item.type])}${item.year ? ' · ' + esc(item.year) : ''}${item.genre ? ' · ' + esc(item.genre) : ''}</div>
        <h1>${esc(item.title)}</h1>
        <p>${esc(item.description || '')}</p>
        ${action}
      </div>
    </header>`;
}

function bindCards() {
  document.querySelectorAll('.card').forEach((el) => {
    el.addEventListener('click', () => {
      if (el.dataset.type === 'jeu') {
        const url = el.dataset.url;
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        location.href = `/watch.html?id=${el.dataset.id}`;
      }
    });
  });
}

(async function init() {
  const user = await currentUser();
  if (!requireLogin(user)) return;

  const filter = new URLSearchParams(location.search).get('f');
  const data = await api('/api/content');

  const groups = [
    ['film', data.films],
    ['serie', data.series],
    ['jeu', data.jeux],
  ].filter(([type]) => !filter || filter === type);

  const total = groups.reduce((n, [, items]) => n + items.length, 0);
  const activeLabel = filter ? LABELS[filter] : 'Accueil';

  app.innerHTML =
    renderNav(user, activeLabel) +
    (filter ? '' : hero(data.featured)) +
    (total
      ? groups.map(([type, items]) => row(LABELS[type], items)).join('')
      : `<div class="empty">
           <p>Rien à afficher pour le moment.</p>
           ${user.role === 'admin' ? '<a class="btn btn-primary" href="/admin">Ajouter du contenu</a>' : ''}
         </div>`);

  wireLogout();
  bindCards();
})();
