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

// Episodes a plat, dans l'ordre saison puis numero : sert a la navigation.
function ordered() {
  return [...(item.episodes || [])].sort((a, b) => a.season - b.season || a.number - b.number);
}

function neighbours() {
  const all = ordered();
  const i = current ? all.findIndex((e) => e.id === current.id) : -1;
  return { prev: i > 0 ? all[i - 1] : null, next: i >= 0 && i < all.length - 1 ? all[i + 1] : null };
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

  const nav = document.getElementById('epNav');
  if (nav) {
    const { prev, next } = neighbours();
    const label = (e) => `S${e.season}E${e.number}`;
    nav.innerHTML = [
      prev ? `<button class="btn btn-sm" data-goto="${prev.id}" type="button">${icon('back')} ${label(prev)}</button>` : '',
      next ? `<button class="btn btn-sm btn-primary" data-goto="${next.id}" type="button">${label(next)} ${icon('play')}</button>` : '',
    ].join('');
  }
}

// Ouvrir un episode le marque comme vu : c'est le geste attendu, et cela
// alimente la reprise de lecture sans rien demander au membre.
async function play(ep) {
  current = ep;
  renderPlayer();
  document.getElementById('playerBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (!ep.watched) {
    try {
      await api(`/api/content/${item.id}/watched`, { method: 'POST', body: { episodeId: ep.id, watched: true } });
      ep.watched = true;
      markSeen(ep.id, true);
    } catch {
      /* le suivi n'est pas critique : la lecture continue */
    }
  }
}

// Met a jour l'affichage d'un episode et le compteur de sa saison.
function markSeen(episodeId, seen) {
  const row = document.querySelector(`.ep[data-ep="${episodeId}"]`);
  if (row) {
    row.classList.toggle('seen', seen);
    const b = row.querySelector('[data-seen]');
    if (b) {
      b.setAttribute('aria-pressed', String(seen));
      b.setAttribute('aria-label', seen ? 'Marquer comme non vu' : 'Marquer comme vu');
      b.title = seen ? 'Vu' : 'Marquer comme vu';
    }
  }
  for (const [saison, eps] of seasons()) {
    const chip = document.querySelector(`#seasonTabs [data-season="${saison}"] .chip-count`);
    if (chip) chip.textContent = `${eps.filter((e) => e.watched).length}/${eps.length}`;
  }
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

  // Les onglets s'affichent meme pour une seule saison : la structure du
  // catalogue doit etre lisible d'emblee, sans dependre du nombre de saisons.
  const tabs = `<div class="filters" id="seasonTabs">
    ${list
      .map(([s, eps], i) => {
        const vus = eps.filter((e) => e.watched).length;
        return `<button class="chip ${i === 0 ? 'on' : ''}" data-season="${s}" type="button">
                  Saison ${s}
                  <span class="chip-count">${vus}/${eps.length}</span>
                </button>`;
      })
      .join('')}
  </div>`;

  const panels = list
    .map(
      ([s, eps], i) => `
      <div class="season" data-season="${s}" ${i === 0 ? '' : 'hidden'}>
        ${eps
          .map(
            (e) => `
          <div class="ep ${e.watched ? 'seen' : ''}" data-ep="${e.id}">
            <button class="ep-open" data-ep="${e.id}" type="button">
              <span class="ep-num">${e.number}</span>
              <span class="ep-body">
                <span class="ep-title">${esc(e.title || 'Épisode ' + e.number)}</span>
                ${e.synopsis ? `<span class="ep-synopsis">${esc(e.synopsis)}</span>` : ''}
              </span>
              <span class="ep-play">${icon(e.video_url ? 'play' : 'inbox')}</span>
            </button>
            <button class="ep-seen" data-seen="${e.id}" type="button"
                    aria-pressed="${e.watched ? 'true' : 'false'}"
                    aria-label="${e.watched ? 'Marquer comme non vu' : 'Marquer comme vu'}"
                    title="${e.watched ? 'Vu' : 'Marquer comme vu'}">${icon('check')}</button>
          </div>`
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

  const findEp = (id) => (item.episodes || []).find((x) => x.id === Number(id));

  document.querySelectorAll('.ep-open').forEach((el) => {
    el.addEventListener('click', () => {
      const ep = findEp(el.dataset.ep);
      if (ep) play(ep);
    });
  });

  document.querySelectorAll('[data-seen]').forEach((el) => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ep = findEp(el.dataset.seen);
      if (!ep) return;
      el.disabled = true;
      try {
        const r = await api(`/api/content/${item.id}/watched`, {
          method: 'POST',
          body: { episodeId: ep.id },
        });
        ep.watched = r.watched;
        markSeen(ep.id, r.watched);
      } catch {
        /* reseau indisponible : l'etat reste inchange */
      } finally {
        el.disabled = false;
      }
    });
  });

  document.getElementById('epNav')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-goto]');
    if (!b) return;
    const ep = findEp(b.dataset.goto);
    if (ep) {
      play(ep);
      // La saison affichee doit suivre l'episode lance.
      const tab = document.querySelector(`#seasonTabs [data-season="${ep.season}"]`);
      if (tab && !tab.classList.contains('on')) tab.click();
    }
  });

  const seen = document.getElementById('seenBtn');
  seen?.addEventListener('click', async () => {
    seen.disabled = true;
    try {
      const r = await api(`/api/content/${item.id}/watched`, { method: 'POST' });
      item.watched = r.watched;
      seen.classList.toggle('btn-primary', r.watched);
      seen.setAttribute('aria-pressed', String(r.watched));
      seen.innerHTML = `${icon('check')} ${r.watched ? 'Vu' : 'Marquer comme vu'}`;
    } catch {
      /* reseau indisponible : l'etat reste inchange */
    } finally {
      seen.disabled = false;
    }
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

  // Point de depart d'une serie : l'episode demande par l'adresse (lien
  // « Reprendre »), sinon le premier non vu, sinon le premier disponible.
  if (item.type === 'serie') {
    const demande = Number(new URLSearchParams(location.search).get('ep'));
    const dispo = (item.episodes || []).filter((e) => e.video_url);
    current =
      dispo.find((e) => e.id === demande) || dispo.find((e) => !e.watched) || dispo[0] || null;
  }

  const hero = item.poster_url
    ? `<div class="watch-poster" style="background-image:url('${esc(item.poster_url)}')"></div>`
    : `<div class="watch-poster placeholder">${icon(TYPE_ICON[item.type], { cls: 'icon-lg' })}</div>`;

  app.innerHTML =
    renderNav(user, '') +
    `<div class="watch-wrap">
       <div id="playerBox"></div>
       <div class="ep-nav" id="epNav"></div>

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
             ${
               item.type === 'serie'
                 ? ''
                 : `<button class="btn ${item.watched ? 'btn-primary' : ''}" id="seenBtn" type="button"
                            aria-pressed="${item.watched}">
                      ${icon('check')} ${item.watched ? 'Vu' : 'Marquer comme vu'}
                    </button>`
             }
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
