const app = document.getElementById('app');

const SINGULAR = { film: 'Film', serie: 'Série', jeu: 'Jeu' };
const TYPE_ICON = { film: 'film', serie: 'tv', jeu: 'game' };

let item = null;
let similar = [];
let current = null; // épisode en cours, null pour un film

/* --------------------------------- lecteur --------------------------------- */

function playerHtml(url, kind) {
  if (!url) {
    return `<div class="player player-empty">
      ${icon('film', { cls: 'icon-lg' })}
      <p>Aucun lecteur n’est associé${current ? ' à cet épisode' : ' à ce titre'}.</p>
    </div>`;
  }

  if (kind === 'video') {
    return `<div class="player">
      <video src="${esc(url)}" controls autoplay playsinline preload="metadata"></video>
    </div>`;
  }

  // L'adresse a été extraite côté serveur du code d'intégration : on ne
  // réinjecte jamais le HTML fourni, on reconstruit une balise propre.
  const src = isDrive(url) ? driveEmbed(url) : url;
  return `<div class="player">
    <iframe src="${esc(src)}" allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowfullscreen referrerpolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"></iframe>
  </div>`;
}

function renderPlayer() {
  const url = current ? current.video_url : item.video_url;
  const kind = current ? current.player : item.player;
  document.getElementById('playerBox').innerHTML = playerHtml(url, kind);

  const now = document.getElementById('nowPlaying');
  if (now) {
    now.innerHTML = current
      ? `<span class="badge">S${current.season}&thinsp;·&thinsp;E${current.number}</span>
         <span>${esc(current.title || 'Épisode ' + current.number)}</span>`
      : '';
  }
  document.querySelectorAll('.ep').forEach((el) => {
    el.classList.toggle('on', current && Number(el.dataset.ep) === current.id);
  });
}

/* -------------------------------- épisodes --------------------------------- */

function seasons() {
  const map = new Map();
  for (const e of item.episodes || []) {
    if (!map.has(e.season)) map.set(e.season, []);
    map.get(e.season).push(e);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

function episodesHtml() {
  if (item.type !== 'serie') return '';
  const list = seasons();

  if (!list.length) {
    return `<section class="section">
      <h2>Épisodes</h2>
      <p class="hint">Aucun épisode n’a encore été ajouté à cette série.</p>
    </section>`;
  }

  const tabs =
    list.length > 1
      ? `<div class="filters" id="seasonTabs">
           ${list
             .map(
               ([s], i) =>
                 `<button class="chip ${i === 0 ? 'on' : ''}" data-season="${s}" type="button">Saison ${s}</button>`
             )
             .join('')}
         </div>`
      : '';

  const panels = list
    .map(
      ([s, eps], i) => `
      <div class="season" data-season="${s}" ${i === 0 ? '' : 'hidden'}>
        ${eps
          .map(
            (e) => `
          <button class="ep" data-ep="${e.id}" type="button">
            <span class="ep-num">${e.number}</span>
            <span class="ep-body">
              <span class="ep-title">${esc(e.title || 'Épisode ' + e.number)}</span>
              ${e.synopsis ? `<span class="ep-synopsis">${esc(e.synopsis)}</span>` : ''}
            </span>
            <span class="ep-play">${icon(e.video_url ? 'play' : 'inbox')}</span>
          </button>`
          )
          .join('')}
      </div>`
    )
    .join('');

  return `<section class="section">
    <h2>Épisodes <span class="row-count">${item.episodeCount}</span></h2>
    ${tabs}
    ${panels}
  </section>`;
}

/* ---------------------------------- fiche ---------------------------------- */

function infoHtml() {
  const rows = [
    ['Type', SINGULAR[item.type]],
    ['Année', item.year],
    ['Genre', item.genre],
    item.type === 'serie' ? ['Saisons', item.seasonCount || null] : null,
    item.type === 'serie' ? ['Épisodes', item.episodeCount || null] : null,
  ].filter((r) => r && r[1]);

  return `<dl class="info">
    ${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
  </dl>`;
}

function similarHtml() {
  if (!similar.length) return '';
  return `<section class="section">
    <h2>À voir aussi</h2>
    <div class="row-scroll stagger">
      ${similar
        .map(
          (s) => `
        <a class="card" href="/${s.type === 'jeu' ? 'game' : 'watch'}.html?id=${s.id}">
          <div class="card-img" ${s.poster_url ? `style="background-image:url('${esc(s.poster_url)}')"` : ''}>
            ${s.poster_url ? '' : icon(TYPE_ICON[s.type], { cls: 'icon-lg' })}
          </div>
          <div class="card-body">
            <div class="card-title">${esc(s.title)}</div>
            <div class="card-sub">${[s.year, s.genre].filter(Boolean).map(esc).join(' · ') || SINGULAR[s.type]}</div>
          </div>
        </a>`
        )
        .join('')}
    </div>
  </section>`;
}

/* ------------------------------- interactions ------------------------------ */

function wirePage() {
  document.getElementById('seasonTabs')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-season]');
    if (!b) return;
    document.querySelectorAll('#seasonTabs .chip').forEach((c) => c.classList.toggle('on', c === b));
    document.querySelectorAll('.season').forEach((p) => {
      p.hidden = p.dataset.season !== b.dataset.season;
    });
  });

  document.querySelectorAll('.ep').forEach((el) => {
    el.addEventListener('click', () => {
      const ep = item.episodes.find((x) => x.id === Number(el.dataset.ep));
      if (!ep) return;
      current = ep;
      renderPlayer();
      document.getElementById('playerBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const fav = document.getElementById('favBtn');
  fav?.addEventListener('click', async () => {
    fav.disabled = true;
    try {
      const r = await api(`/api/content/${item.id}/favorite`, { method: 'POST' });
      fav.classList.toggle('btn-primary', r.favorite);
      fav.setAttribute('aria-pressed', String(r.favorite));
      fav.innerHTML = `${icon('heart')} ${r.favorite ? 'Dans ma liste' : 'Ma liste'}`;
    } catch {
      /* réseau indisponible : l'état reste inchangé */
    } finally {
      fav.disabled = false;
    }
  });
}

/* ---------------------------------- départ --------------------------------- */

(async function init() {
  const user = await currentUser();
  if (!requireLogin(user)) return;

  const id = new URLSearchParams(location.search).get('id');
  try {
    ({ item, similar } = await api('/api/content/' + encodeURIComponent(id)));
  } catch {
    app.innerHTML =
      renderNav(user, '') +
      `<div class="empty">${icon('inbox', { cls: 'icon-lg' })}
        <h2>Contenu introuvable</h2>
        <a class="btn btn-primary" href="/">Retour au catalogue</a></div>`;
    wireNav();
    return;
  }

  document.title = `${item.title} — Kuroi`;

  // Une série démarre sur son premier épisode disponible.
  if (item.type === 'serie') current = (item.episodes || []).find((e) => e.video_url) || null;

  const hero = item.poster_url
    ? `<div class="watch-poster" style="background-image:url('${esc(item.poster_url)}')"></div>`
    : `<div class="watch-poster placeholder">${icon(TYPE_ICON[item.type], { cls: 'icon-lg' })}</div>`;

  app.innerHTML =
    renderNav(user, '') +
    `<div class="watch-wrap">
       <div id="playerBox"></div>

       <div class="watch-head">
         ${hero}
         <div class="watch-meta">
           <div class="hero-meta">
             ${icon(TYPE_ICON[item.type])}
             <span>${esc(SINGULAR[item.type])}${item.year ? ' · ' + esc(item.year) : ''}${
               item.genre ? ' · ' + esc(item.genre) : ''
             }</span>
           </div>
           <h1>${esc(item.title)}</h1>
           <div class="now-playing" id="nowPlaying"></div>
           <p class="player-desc">${esc(item.description || 'Aucune description pour ce titre.')}</p>
           <div class="player-actions">
             <button class="btn ${item.favorite ? 'btn-primary' : ''}" id="favBtn" type="button"
                     aria-pressed="${item.favorite}">
               ${icon('heart')} ${item.favorite ? 'Dans ma liste' : 'Ma liste'}
             </button>
             <a class="btn btn-ghost" href="/">${icon('back')} Catalogue</a>
           </div>
           ${infoHtml()}
         </div>
       </div>

       ${episodesHtml()}
       ${item.files.length ? `<section class="section"><h2>Téléchargements</h2>${item.files.map(fileRow).join('')}</section>` : ''}
       ${similarHtml()}
     </div>`;

  wireNav();
  renderPlayer();
  wirePage();
})();
