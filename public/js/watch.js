const app = document.getElementById('app');

const SINGULAR = { film: 'Film', serie: 'Série', jeu: 'Jeu' };
const TYPE_ICON = { film: 'film', serie: 'tv', jeu: 'game' };

// Un lecteur externe vit dans une iframe d'un autre domaine : le navigateur
// interdit d'y lire l'avancement. Impossible donc de savoir quand l'épisode est
// réellement terminé. On compte à la place le temps passé sur la page, onglet
// au premier plan, avant de marquer « vu ».
const SEUIL_IFRAME_MS = 5 * 60 * 1000;
// Pour un fichier vidéo servi par le site, on connaît vraiment la position de
// lecture : on marque à 90 %, comme le font les plateformes.
const SEUIL_VIDEO = 0.9;

let item = null;
let similar = [];
let current = null; // épisode en cours, null pour un film
let chrono = null;
let indexSource = 0; // lecteur choisi pour l'episode en cours

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
      <video id="filePlayer" src="${esc(url)}" controls autoplay playsinline preload="metadata"></video>
    </div>`;
  }

  // L'adresse a été extraite côté serveur du code d'intégration : on ne
  // réinjecte jamais le HTML fourni, on reconstruit une balise propre.
  const src = isDrive(url) ? driveEmbed(url) : url;

  // Cette balise reste volontairement aussi nue qu'un code d'intégration collé
  // tel quel, car c'est ainsi que ces lecteurs fonctionnent sur téléphone.
  //
  // Ni « sandbox », ni « allow ». Les deux ont été ajoutés puis retirés après
  // avoir cassé la lecture sur iPhone :
  //
  //  * sandbox : Safari iOS l'applique bien plus sévèrement que Chrome et
  //    coupe l'accès au stockage du cadre ;
  //  * allow : le préciser REMPLACE les permissions par défaut, donc tout ce
  //    qui n'y est pas listé devient interdit. Un code collé n'en porte pas et
  //    conserve les permissions par défaut.
  //
  // La protection de fond est ailleurs : la CSP n'autorise en cadre que les
  // domaines réellement présents dans le catalogue, et seule l'adresse extraite
  // est conservée — jamais le HTML fourni.
  return `<div class="player">
    <iframe src="${esc(src)}" width="640" height="384" frameborder="0" scrolling="no" allowfullscreen></iframe>
  </div>
  <p class="player-fallback">
    Le lecteur reste noir ?
    <a href="${esc(src)}" target="_blank" rel="noopener noreferrer">Ouvrir dans un nouvel onglet</a>
  </p>`;
}

/* ------------------------ marquage « vu » automatique ---------------------- */

function stopChrono() {
  if (!chrono) return;
  clearInterval(chrono.tick);
  chrono = null;
}

// Cible du suivi : l'épisode en cours, ou le titre lui-même pour un film.
function cibleCourante() {
  return current || (item.type !== 'serie' ? item : null);
}

function startChrono() {
  stopChrono();

  const cible = cibleCourante();
  if (!cible) return;
  if (cible.watched) return majAstuce('');

  const video = document.getElementById('filePlayer');
  if (video) {
    video.addEventListener('timeupdate', function surAvancement() {
      if (video.duration && video.currentTime / video.duration >= SEUIL_VIDEO) {
        video.removeEventListener('timeupdate', surAvancement);
        marquer(cible, true);
      }
    });
    majAstuce('Sera marqué comme vu à 90 % de la lecture.');
    return;
  }

  if (!sourceCourante()) return majAstuce('');

  let ecoule = 0;
  const tick = setInterval(() => {
    if (document.visibilityState !== 'visible') return; // onglet en arrière-plan
    ecoule += 1000;
    if (ecoule >= SEUIL_IFRAME_MS) {
      stopChrono();
      marquer(cible, true);
    }
  }, 1000);
  chrono = { tick };

  majAstuce(
    'Le lecteur vient d’un autre site : son avancement n’est pas lisible d’ici. Marqué comme vu après 5 minutes de lecture, ou à la main.'
  );
}

function majAstuce(texte) {
  const el = document.getElementById('seenHint');
  if (el) el.textContent = texte;
}

async function marquer(cible, valeur) {
  if (!cible) return;
  const body = { watched: valeur };
  if (cible !== item) body.episodeId = cible.id;
  try {
    const r = await api(`/api/content/${item.id}/watched`, { method: 'POST', body });
    cible.watched = r.watched;
    if (cible === item) majBouton(item);
    else markSeen(cible.id, r.watched);
    if (r.watched) {
      stopChrono();
      majAstuce('');
    }
  } catch {
    /* le suivi n'est pas critique : la lecture continue */
  }
}

/* --------------------------------- rendu ----------------------------------- */

// Le lecteur principal vit dans video_url, les autres dans sources. On les
// presente comme une seule liste numerotee.
function sourcesDe(cible) {
  if (!cible) return [];
  const principal = cible.video_url
    ? [{ label: 'Lecteur 1', url: cible.video_url, player: cible.player }]
    : [];
  const autres = (cible.sources || []).map((s, i) => ({
    label: s.label || `Lecteur ${i + 2}`,
    url: s.url,
    player: s.player,
  }));
  return [...principal, ...autres];
}

function sourceCourante() {
  const liste = sourcesDe(cibleCourante());
  return liste[indexSource] || liste[0] || null;
}

function ordered() {
  return [...(item.episodes || [])].sort((a, b) => a.season - b.season || a.number - b.number);
}

function neighbours() {
  const all = ordered();
  const i = current ? all.findIndex((e) => e.id === current.id) : -1;
  return { prev: i > 0 ? all[i - 1] : null, next: i >= 0 && i < all.length - 1 ? all[i + 1] : null };
}

function boutonMarquer(cible) {
  return `<button class="btn btn-sm ${cible.watched ? 'btn-primary' : ''}" id="markBtn" type="button"
                  aria-pressed="${cible.watched ? 'true' : 'false'}">
            ${icon('check')} ${cible.watched ? 'Vu — retirer' : 'Marquer comme vu'}
          </button>`;
}

// Rafraîchit le bouton sans reconstruire le lecteur : sinon la lecture
// repartirait de zéro à chaque changement d'état.
function majBouton(cible) {
  const b = document.getElementById('markBtn');
  if (!b || !cible) return;
  b.classList.toggle('btn-primary', cible.watched);
  b.setAttribute('aria-pressed', String(cible.watched));
  b.innerHTML = `${icon('check')} ${cible.watched ? 'Vu — retirer' : 'Marquer comme vu'}`;
}

function renderEpNav() {
  const nav = document.getElementById('epNav');
  if (!nav) return;
  const cible = cibleCourante();

  if (item.type !== 'serie') {
    nav.innerHTML = cible ? boutonMarquer(cible) : '';
    return;
  }

  const { prev, next } = neighbours();
  const label = (e) => `S${e.season}E${e.number}`;
  nav.innerHTML = [
    prev ? `<button class="btn btn-sm" data-goto="${prev.id}" type="button">${icon('back')} ${label(prev)}</button>` : '',
    cible ? boutonMarquer(cible) : '',
    next ? `<button class="btn btn-sm btn-primary" data-goto="${next.id}" type="button">${label(next)} ${icon('play')}</button>` : '',
  ].join('');
}

function renderSelecteur() {
  const box = document.getElementById('sourceTabs');
  if (!box) return;
  const liste = sourcesDe(cibleCourante());

  // Un seul lecteur : pas de selecteur, il n'y aurait rien a choisir.
  box.innerHTML =
    liste.length > 1
      ? liste
          .map(
            (s, i) =>
              `<button class="chip ${i === indexSource ? 'on' : ''}" data-source="${i}" type="button">
                 ${esc(s.label)}
               </button>`
          )
          .join('')
      : '';
}

function renderPlayer() {
  const source = sourceCourante();
  const url = source?.url || null;
  const kind = source?.player || null;
  document.getElementById('playerBox').innerHTML = playerHtml(url, kind);
  renderSelecteur();

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

  renderEpNav();
  startChrono();
}

function seasons() {
  const map = new Map();
  for (const e of item.episodes || []) {
    if (!map.has(e.season)) map.set(e.season, []);
    map.get(e.season).push(e);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

// Le bouton bascule : il propose de retirer la saison une fois qu'elle est
// entièrement vue, plutôt que de rester sur « marquer » sans effet visible.
function boutonSaison(saison, eps) {
  const toutVu = eps.every((e) => e.watched);
  return `<button class="btn btn-sm ${toutVu ? '' : 'btn-primary'}" data-season-mark="${saison}"
                  data-watched="${toutVu ? 'true' : 'false'}" type="button">
            ${icon('check')} ${toutVu ? 'Retirer la saison' : 'Marquer la saison comme vue'}
          </button>`;
}

function majBoutonSaison(saison) {
  const eps = seasons().find(([s]) => s === saison)?.[1] || [];
  const barre = document.querySelector(`.season[data-season="${saison}"] .season-bar`);
  if (!barre) return;
  barre.innerHTML =
    `<span class="hint">${eps.filter((e) => e.watched).length} épisode(s) vu(s) sur ${eps.length}</span>` +
    boutonSaison(saison, eps);
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

  const tabs = `<div class="filters" id="seasonTabs">
    ${list
      .map(([s, eps], i) => {
        const vus = eps.filter((e) => e.watched).length;
        return `<button class="chip ${i === 0 ? 'on' : ''}" data-season="${s}" type="button">
                  Saison ${s}<span class="chip-count">${vus}/${eps.length}</span>
                </button>`;
      })
      .join('')}
  </div>`;

  const panels = list
    .map(
      ([s, eps], i) => `
      <div class="season" data-season="${s}" ${i === 0 ? '' : 'hidden'}>
        <div class="season-bar">
          <span class="hint">${eps.filter((e) => e.watched).length} épisode(s) vu(s) sur ${eps.length}</span>
          ${boutonSaison(s, eps)}
        </div>
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
                    aria-label="${e.watched ? 'Marquer comme non vu' : 'Marquer comme vu'}">
              ${icon('check')}<span class="ep-seen-label">${e.watched ? 'Vu' : 'Non vu'}</span>
            </button>
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

// majBarre est mis à faux par le marquage d'une saison entière, qui reconstruit
// la barre une seule fois à la fin plutôt qu'à chaque épisode.
function markSeen(episodeId, seen, majBarre = true) {
  const row = document.querySelector(`.ep[data-ep="${episodeId}"]`);
  if (row) {
    row.classList.toggle('seen', seen);
    const b = row.querySelector('[data-seen]');
    if (b) {
      b.setAttribute('aria-pressed', String(seen));
      b.setAttribute('aria-label', seen ? 'Marquer comme non vu' : 'Marquer comme vu');
      const l = b.querySelector('.ep-seen-label');
      if (l) l.textContent = seen ? 'Vu' : 'Non vu';
    }
  }
  for (const [saison, eps] of seasons()) {
    const chip = document.querySelector(`#seasonTabs [data-season="${saison}"] .chip-count`);
    if (chip) chip.textContent = `${eps.filter((e) => e.watched).length}/${eps.length}`;
  }
  if (current && current.id === episodeId) majBouton(current);

  if (majBarre) {
    const ep = (item.episodes || []).find((x) => x.id === episodeId);
    if (ep) majBoutonSaison(ep.season);
  }
}

function play(ep) {
  current = ep;
  indexSource = 0; // chaque episode repart sur son premier lecteur
  renderPlayer();
  document.getElementById('playerBox').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function wirePage() {
  const findEp = (id) => (item.episodes || []).find((x) => x.id === Number(id));

  document.getElementById('seasonTabs')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-season]');
    if (!b) return;
    document.querySelectorAll('#seasonTabs .chip').forEach((c) => c.classList.toggle('on', c === b));
    document.querySelectorAll('.season').forEach((p) => {
      p.hidden = p.dataset.season !== b.dataset.season;
    });
  });

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
      await marquer(ep, !ep.watched);
      el.disabled = false;
    });
  });

  // Délégation : la barre de saison est reconstruite à chaque changement, un
  // écouteur posé sur le bouton lui-même disparaîtrait avec lui.
  app.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-season-mark]');
    if (!b) return;

    const saison = Number(b.dataset.seasonMark);
    const versVu = b.dataset.watched !== 'true';
    b.disabled = true;
    try {
      const r = await api(`/api/content/${item.id}/watched-season`, {
        method: 'POST',
        body: { season: saison, watched: versVu },
      });
      const touches = new Set(r.episodes);
      for (const ep of item.episodes || []) {
        if (touches.has(ep.id)) {
          ep.watched = r.watched;
          markSeen(ep.id, r.watched, false); // la barre est refaite une fois, après
        }
      }
      majBoutonSaison(saison);
    } catch (err) {
      b.disabled = false;
    }
  });

  document.getElementById('sourceTabs')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-source]');
    if (!b) return;
    indexSource = Number(b.dataset.source);
    renderPlayer();
  });

  document.getElementById('epNav')?.addEventListener('click', async (e) => {
    const aller = e.target.closest('[data-goto]');
    if (aller) {
      const ep = findEp(aller.dataset.goto);
      if (!ep) return;
      play(ep);
      const tab = document.querySelector(`#seasonTabs [data-season="${ep.season}"]`);
      if (tab && !tab.classList.contains('on')) tab.click();
      return;
    }

    const marque = e.target.closest('#markBtn');
    if (marque) {
      const cible = cibleCourante();
      if (!cible) return;
      marque.disabled = true;
      await marquer(cible, !cible.watched);
      marque.disabled = false;
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

  // Point de départ d'une série : l'épisode demandé par l'adresse (lien
  // « Reprendre »), sinon le premier non vu, sinon le premier disponible.
  if (item.type === 'serie') {
    const demande = Number(new URLSearchParams(location.search).get('ep'));
    const dispo = (item.episodes || []).filter((e) => e.video_url);
    current = dispo.find((e) => e.id === demande) || dispo.find((e) => !e.watched) || dispo[0] || null;
  }

  const affiche = item.poster_url
    ? `<div class="watch-poster" style="background-image:url('${esc(item.poster_url)}')"></div>`
    : `<div class="watch-poster placeholder">${icon(TYPE_ICON[item.type], { cls: 'icon-lg' })}</div>`;

  // Ordre voulu : la fiche (titre et affiche), puis le lecteur, puis les épisodes.
  app.innerHTML =
    renderNav(user, '') +
    `<div class="watch-wrap">
       <div class="watch-head">
         ${affiche}
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

       <div class="filters" id="sourceTabs"></div>
       <div id="playerBox"></div>
       <div class="ep-nav" id="epNav"></div>
       <p class="hint" id="seenHint"></p>

       ${episodesHtml()}
       ${item.files.length ? `<section class="section"><h2>Téléchargements</h2>${item.files.map(fileRow).join('')}</section>` : ''}
       ${similarHtml()}
     </div>`;

  wireNav();
  renderPlayer();
  wirePage();
})();
