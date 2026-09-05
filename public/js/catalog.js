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
//
// Format paysage, contrairement aux autres cartes : c'est l'image de l'episode
// qu'on montre ici, pas l'affiche de la serie. A defaut d'image d'episode on
// retombe sur l'image large du titre, puis sur son affiche.
function resumeCard(item) {
  const ep = item.resume;
  const image = ep.thumbnail_url || item.backdrop_url || item.poster_url;
  const fond = image ? ` style="background-image:url('${esc(image)}')"` : '';
  const progression = item.episodeCount
    ? Math.round((item.watchedCount / item.episodeCount) * 100)
    : 0;
  return `
    <a class="card resume" href="/watch.html?id=${item.id}&ep=${ep.id}"
       aria-label="Reprendre ${esc(item.title)} à la saison ${ep.season} épisode ${ep.number}">
      <div class="resume-img"${fond}>
        ${image ? '' : icon('tv', { cls: 'icon-lg' })}
        <span class="card-play">${icon('play')}</span>
        <span class="resume-bar"><span style="width:${progression}%"></span></span>
      </div>
      <div class="card-body">
        <div class="resume-serie">${esc(item.title)}${
          item.seasonCount > 1 ? ' : Saison ' + ep.season : ''
        }</div>
        <div class="resume-ep">S${ep.season} E${ep.number}${
          ep.title ? ' - ' + esc(ep.title) : ''
        }</div>
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

function row(title, items, options = {}) {
  if (!items.length) return '';
  const titre = options.href
    ? `<a href="${esc(options.href)}">${esc(title)}</a>`
    : esc(title);
  return `
    <section class="row">
      <div class="row-head">
        <h2>${titre}</h2>
        <span class="row-count">${items.length}</span>
      </div>
      ${options.sub ? `<p class="row-sub">${esc(options.sub)}</p>` : ''}
      <div class="row-scroll stagger">${items.map(card).join('')}</div>
    </section>`;
}

// Bandeau de vignettes du carrousel : il sert de navigation, et il est rendu
// dans chaque diapositive. Une seule est visible a la fois, donc dupliquer le
// bandeau evite d'avoir a le repositionner par-dessus les diapositives.
function heroVignettes(tous, courant) {
  return `
    <div class="hero-vignettes">
      ${tous
        .map((it, i) => {
          const img = it.poster_url || it.backdrop_url;
          return `<button class="hero-vignette ${i === courant ? 'on' : ''}"
                          data-goto-slide="${i}" type="button"
                          aria-label="Voir ${esc(it.title)}"
                          ${img ? `style="background-image:url('${esc(img)}')"` : ''}></button>`;
        })
        .join('')}
    </div>`;
}

// Une diapositive du carrousel. L'image large sert de fond : une affiche est en
// portrait, etiree en banniere elle devient illisible. L'affiche, elle, garde
// ses proportions dans la carte de gauche.
function heroSlide(item, index, tous) {
  const fond = item.backdrop_url || item.poster_url;
  const bg = fond ? `background-image:url('${esc(fond)}')` : '';
  const affiche = item.poster_url || item.backdrop_url;
  const total = String(tous.length).padStart(2, '0');
  return `
    <article class="hero-slide ${fond ? '' : 'no-poster'} ${index === 0 ? 'on' : ''}"
             style="${bg}" data-slide="${index}" ${index === 0 ? '' : 'aria-hidden="true"'}>
      <div class="hero-body">
        ${
          affiche
            ? `<div class="hero-affiche" style="background-image:url('${esc(affiche)}')"></div>`
            : ''
        }
        <div class="hero-inner">
          ${
            tous.length > 1
              ? `<div class="hero-compteur">${String(index + 1).padStart(2, '0')} / ${total}</div>`
              : ''
          }
          <h1>${esc(item.title)}</h1>
          <div>
            <span class="hero-badge">${esc(SINGULAR[item.type])}${
              item.genre ? ' · ' + esc(item.genre) : ''
            }</span>
          </div>
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
          ${tous.length > 1 ? heroVignettes(tous, index) : ''}
        </div>
      </div>
    </article>`;
}

function hero(items) {
  const liste = (items || []).filter(Boolean);
  if (!liste.length) return '';
  if (liste.length === 1) return `<div class="hero">${heroSlide(liste[0], 0, liste)}</div>`;

  return `
    <div class="hero" id="heroCarrousel">
      ${liste.map((it, i) => heroSlide(it, i, liste)).join('')}
      <button class="hero-arrow prev" data-slide-move="-1" type="button"
              aria-label="Titre précédent">${icon('back')}</button>
      <button class="hero-arrow next" data-slide-move="1" type="button"
              aria-label="Titre suivant">${icon('back')}</button>
    </div>`;
}

// Defilement du carrousel. L'avance automatique s'arrete des qu'on survole ou
// qu'on prend le clavier, et ne demarre pas du tout si le systeme demande a
// limiter les animations.
let minuterieHero = null;

function wireHero() {
  const box = document.getElementById('heroCarrousel');
  if (!box) return;

  const slides = [...box.querySelectorAll('.hero-slide')];
  let actuel = 0;

  const montrer = (i) => {
    actuel = (i + slides.length) % slides.length;
    slides.forEach((el, n) => {
      el.classList.toggle('on', n === actuel);
      if (n === actuel) el.removeAttribute('aria-hidden');
      else el.setAttribute('aria-hidden', 'true');
    });
  };

  const sobre = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const relancer = () => {
    clearInterval(minuterieHero);
    if (!sobre) minuterieHero = setInterval(() => montrer(actuel + 1), 7000);
  };

  box.addEventListener('click', (e) => {
    const fleche = e.target.closest('[data-slide-move]');
    if (fleche) {
      montrer(actuel + Number(fleche.dataset.slideMove));
      relancer();
      return;
    }
    const pastille = e.target.closest('[data-goto-slide]');
    if (pastille) {
      montrer(Number(pastille.dataset.gotoSlide));
      relancer();
    }
  });

  box.addEventListener('mouseenter', () => clearInterval(minuterieHero));
  box.addEventListener('mouseleave', relancer);
  box.addEventListener('focusin', () => clearInterval(minuterieHero));
  box.addEventListener('focusout', relancer);

  relancer();
}

// Une rangee par genre, empilees les unes sous les autres : on descend dans la
// page et on tombe sur Action, Romance, et le reste. Le titre de la rangee mene
// au genre complet.
function genreRows(genres, tous) {
  return (genres || [])
    .map((g) =>
      row(
        g.nom,
        tous.filter((i) => i.genre === g.nom),
        { href: '/?g=' + encodeURIComponent(g.nom) }
      )
    )
    .join('');
}

// Genre demande dans l'adresse, s'il y en a un.
const genreActif = () => new URLSearchParams(location.search).get('g');

function matches(item) {
  const g = genreActif();
  if (g && item.genre !== g) return false;
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

  const genre = genreActif();

  const accueilComplet = !filter && !query && !genre;
  const tous = [...data.films, ...data.series, ...data.jeux];

  let body;
  if (total) {
    body =
      (accueilComplet ? resumeRow(data.reprendre || []) : '') +
      (accueilComplet ? row('Ma liste', favoris) : '') +
      groups.map(([type, items]) => row(LABELS[type], items)).join('') +
      (accueilComplet ? genreRows(data.genres, tous) : '');
  } else if (genre) {
    body =
      `<div class="empty">
        ${icon('inbox', { cls: 'icon-lg' })}
        <h2>Rien en « ${esc(genre)} » pour l’instant</h2>
        <a class="btn btn-primary" href="/">Voir tout le catalogue</a>
      </div>`;
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
  const montrerHero = !filter && !query && !genre;
  document.getElementById('hero').innerHTML = montrerHero
    ? hero(data.carrousel && data.carrousel.length ? data.carrousel : [data.featured])
    : '';
  document.getElementById('view').innerHTML = body;

  wireHero();
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
  for (const it of data.carrousel || []) if (it.id === id) it.favorite = r.favorite;
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
