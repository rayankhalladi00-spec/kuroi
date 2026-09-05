const app = document.getElementById('app');

const SINGULAR = { film: 'Film', serie: 'Série', jeu: 'Jeu' };
const TYPE_ICON = { film: 'film', serie: 'tv', jeu: 'game' };

// Un lecteur externe vit dans une iframe d'un autre domaine : le navigateur
// interdit d'y lire l'avancement. Impossible donc de savoir quand l'épisode est
// réellement terminé. On compte à la place le temps passé sur la page, onglet
// au premier plan, avant de marquer « vu ».
// Pour un fichier vidéo servi par le site, on connaît vraiment la position de
// lecture : on marque à 90 %, comme le font les plateformes.
const SEUIL_VIDEO = 0.9;

let utilisateur = null; // membre connecte : decide qui peut effacer un commentaire
let item = null;
let similar = [];
let current = null; // épisode en cours, null pour un film
let chrono = null;
let indexSource = 0; // lecteur choisi pour l'episode en cours
let sensEpisodes = 1; // 1 : du premier au dernier ; -1 : l'inverse

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

  // Bac a sable retabli, mais « allow-top-navigation » reste ferme : c'est lui
  // qui empeche un lecteur douteux de rediriger le visiteur hors du site. Tout
  // le reste est ouvert, la version mobile de ces lecteurs ayant besoin des
  // formulaires, du verrouillage d'orientation et des fenetres surgissantes.
  //
  // Il avait ete retire en cherchant pourquoi les lecteurs echouaient sur
  // iPhone. Ce n'etait pas lui, et le raisonnement qui l'avait innocente etait
  // faux lui aussi : on avait conclu « ca echoue meme en onglet direct, donc
  // ce site n'y est pour rien », alors que le lien de secours portait
  // rel="noreferrer" et coupait le Referer de ce nouvel onglet. La vraie cause
  // etait la politique de referer, des deux cotes. Voir plus bas et server.js.
  //
  // Pas d'attribut « allow » en revanche. Le preciser REMPLACE les permissions
  // par defaut : tout ce qui n'y figure pas devient interdit. Il ne protegeait
  // de rien et ne pouvait que casser des lecteurs.
  const bacASable = [
    'allow-scripts',
    'allow-same-origin',
    'allow-forms',
    'allow-presentation',
    'allow-popups',
    'allow-popups-to-escape-sandbox',
    'allow-orientation-lock',
  ].join(' ');

  // referrerpolicy : sans lui, l'iframe herite de la politique de cette page.
  // Pose explicitement, le lecteur garde de quoi demander son propre flux meme
  // si l'en-tete du site change un jour. Voir la note dans server.js.
  //
  // rel : « noopener » seulement, surtout PAS « noreferrer ». noreferrer coupe
  // le Referer du nouvel onglet, et Safari sur iOS propage cette absence a la
  // page ouverte : l'hebergeur refusait alors son propre flux (403). C'etait la
  // cause du « meme en nouvel onglet, ca ne marche pas ». noopener suffit a la
  // protection : il empeche la page ouverte d'atteindre window.opener.
  return `<div class="player">
    <iframe src="${esc(src)}" width="640" height="384" frameborder="0" scrolling="no"
            allowfullscreen sandbox="${bacASable}"
            referrerpolicy="strict-origin-when-cross-origin"></iframe>
  </div>
  <p class="player-fallback">
    Le lecteur reste noir ?
    <a href="${esc(src)}" target="_blank" rel="noopener">Ouvrir dans un nouvel onglet</a>
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

  // Lecteur externe : son avancement n'est pas lisible depuis ici. On marque
  // donc a l'ouverture, sans attendre. Le delai de cinq minutes qui existait
  // avant obligeait a laisser l'onglet ouvert pour rien, et un episode ferme
  // plus tot restait « non vu ». Le bouton permet de revenir dessus.
  marquer(cible, true);
  majAstuce('Marqué comme vu à l’ouverture. Le bouton ci-dessus permet de l’enlever.');
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
  renderSocial();
  startChrono();
}

/* -------------------------- note et commentaires --------------------------- */

function noteHtml(cible) {
  const boutons = Array.from({ length: 10 }, (_, i) => i + 1)
    .map(
      (n) =>
        `<button class="note-btn ${cible.maNote === n ? 'on' : ''}" data-note="${n}"
                 type="button" aria-pressed="${cible.maNote === n}"
                 aria-label="Noter ${n} sur 10">${n}</button>`
    )
    .join('');

  const moyenne = cible.votants
    ? `<b>${cible.moyenne}</b>/10 <span class="hint">sur ${cible.votants} vote${cible.votants > 1 ? 's' : ''}</span>`
    : '<span class="hint">Aucune note pour l’instant</span>';

  return `<div class="note-bloc">
    <div class="note-tete">
      <h3>Ta note</h3>
      <div class="note-moyenne">${moyenne}</div>
    </div>
    <div class="note-echelle" id="noteEchelle">${boutons}</div>
    ${cible.maNote ? '<button class="btn btn-sm btn-ghost" id="noteRetirer" type="button">Retirer ma note</button>' : ''}
  </div>`;
}

function commentaireHtml(c, reponse = false) {
  const effacable = c.user_id === utilisateur?.id || utilisateur?.role === 'admin';
  // avatarHtml attend un membre : le commentaire en porte de quoi en faire un.
  const photo = avatarHtml({ avatarUrl: c.avatarUrl, username: c.author }, 'com-avatar');

  return `<article class="commentaire ${reponse ? 'reponse' : ''}" data-com="${c.id}">
    ${photo}
    <div class="commentaire-corps">
      <div class="commentaire-tete">
        <b>${nomAvecRole(c.author, c.author_role)}</b>
        <time>${esc(quandCourt(c.created_at))}</time>
        ${effacable ? `<button class="icon-btn" data-delcom="${c.id}" type="button"
                               aria-label="Supprimer ce commentaire">${icon('trash')}</button>` : ''}
      </div>
      <p>${esc(c.body)}</p>
      <div class="commentaire-actions">
        <button class="com-like ${c.liked ? 'on' : ''}" data-like="${c.id}" type="button"
                aria-pressed="${!!c.liked}"
                aria-label="${c.liked ? 'Retirer mon j’aime' : 'J’aime ce commentaire'}">
          ${icon('heart')}<span class="com-like-n">${c.likes || ''}</span>
        </button>
        <button class="com-lien" data-repondre="${c.id}" type="button">Répondre</button>
      </div>
      <div class="com-reponses" data-reponses="${c.id}">
        ${(c.replies || []).map((r) => commentaireHtml(r, true)).join('')}
      </div>
    </div>
  </article>`;
}

// Compte le fil entier : le compteur affiche le nombre de messages, réponses
// comprises, pas seulement le nombre de fils.
function totalCommentaires(fils) {
  return fils.reduce((n, c) => n + 1 + (c.replies?.length || 0), 0);
}

function quandCourt(s) {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T') + 'Z');
  if (isNaN(d)) return s;
  return d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Envoie ou retire la note, puis reflete la reponse du serveur : c'est lui qui
// recalcule la moyenne, l'interface ne la devine pas.
async function noter(cible, score) {
  const echelle = document.getElementById('noteEchelle');
  echelle?.classList.add('occupe');
  try {
    const r =
      score === null
        ? await api(`/api/episodes/${cible.id}/rating`, { method: 'DELETE' })
        : await api(`/api/episodes/${cible.id}/rating`, { method: 'PUT', body: { score } });

    cible.moyenne = r.moyenne;
    cible.votants = r.votants;
    cible.maNote = r.maNote;

    // Seul le bloc de note est refait : reconstruire tout le conteneur
    // effacerait un commentaire en cours de redaction.
    const bloc = document.querySelector('#episodeSocial .note-bloc');
    if (bloc) bloc.outerHTML = noteHtml(cible);
    majNoteListe(cible);
  } catch (err) {
    echelle?.classList.remove('occupe');
    alert(err.message || 'La note n’a pas pu être enregistrée.');
  }
}

// La liste des episodes affiche aussi la moyenne : elle doit suivre.
function majNoteListe(cible) {
  const el = document.querySelector(`.ep[data-ep="${cible.id}"] .ep-note`);
  if (el) el.innerHTML = badgeNote(cible);
}

function majCompteurCommentaires(cible, delta) {
  cible.commentaires = Math.max(0, (cible.commentaires || 0) + delta);
  const c = document.getElementById('comCount');
  if (c) c.textContent = cible.commentaires || '';
  majNoteListe(cible);
}

// Pastille compacte pour la liste des episodes : moyenne et nombre d'avis.
function badgeNote(e) {
  const bouts = [];
  if (e.votants) bouts.push(`<span class="ep-score">★ ${e.moyenne}</span>`);
  if (e.commentaires) bouts.push(`<span class="ep-coms">${icon('idea')} ${e.commentaires}</span>`);
  return bouts.join('');
}

// Un seul formulaire de reponse ouvert a la fois : deux champs vides sous deux
// messages differents ne servent qu'a se tromper de destinataire.
function ouvrirReponse(id) {
  const ancien = document.querySelector('.reponse-form');
  const memeCible = ancien?.dataset.parent === String(id);
  ancien?.remove();
  if (memeCible) return; // deuxieme clic sur « Répondre » : on referme

  const fil = document.querySelector(`[data-reponses="${id}"]`);
  if (!fil) return;
  fil.insertAdjacentHTML(
    'beforeend',
    `<form class="reponse-form" data-parent="${id}">
       <textarea rows="2" maxlength="1000" placeholder="Ta réponse…"></textarea>
       <div class="reponse-actions">
         <button class="btn btn-primary btn-sm" type="submit">Répondre</button>
         <button class="btn btn-sm btn-ghost" data-annule-reponse type="button">Annuler</button>
       </div>
     </form>`
  );
  fil.querySelector('.reponse-form textarea').focus();
}

async function renderSocial() {
  const box = document.getElementById('episodeSocial');
  if (!box) return;

  const cible = cibleCourante();
  if (!cible || cible === item) {
    // Notes et commentaires portent sur un episode : rien a montrer pour un
    // film ou une serie sans episode selectionne.
    box.innerHTML = '';
    return;
  }

  box.innerHTML = `
    ${noteHtml(cible)}
    <div class="commentaires">
      <h3>Commentaires <span class="row-count" id="comCount">${cible.commentaires || ''}</span></h3>
      <form id="comForm">
        <textarea id="comBody" rows="2" maxlength="1000"
                  placeholder="Ton avis sur cet épisode…"></textarea>
        <button class="btn btn-primary btn-sm" type="submit">Publier</button>
      </form>
      <div id="comList"><p class="hint">Chargement…</p></div>
    </div>`;

  try {
    const { comments } = await api(`/api/episodes/${cible.id}/comments`);
    // Passer la fonction directement donnerait l'index en second argument, que
    // commentaireHtml lirait comme « ceci est une reponse ».
    document.getElementById('comList').innerHTML = comments.length
      ? comments.map((c) => commentaireHtml(c)).join('')
      : '<p class="hint">Personne n’a encore réagi.</p>';
    cible.commentaires = totalCommentaires(comments);
    document.getElementById('comCount').textContent = cible.commentaires || '';
    majNoteListe(cible);
  } catch {
    document.getElementById('comList').innerHTML =
      '<p class="hint">Les commentaires n’ont pas pu être chargés.</p>';
  }
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

// Une carte par episode : l'image d'abord, le titre dessous. Les selecteurs
// « .ep[data-ep] », « [data-seen] » et « .ep-seen-label » sont conserves, c'est
// sur eux que s'appuie markSeen.
function episodeCarte(e) {
  // A defaut d'image propre a l'episode, celle du titre : mieux vaut l'image de
  // la serie qu'un rectangle noir. L'etat vide n'apparait que si le titre n'a
  // aucune image non plus.
  const image = e.thumbnail_url || item.backdrop_url || item.poster_url;
  const vignette = image ? `style="background-image:url('${esc(image)}')"` : '';
  return `
    <article class="ep ${e.watched ? 'seen' : ''}" data-ep="${e.id}">
      <button class="ep-open" data-ep="${e.id}" type="button"
              aria-label="Lire l’épisode ${e.number}${e.title ? ' — ' + esc(e.title) : ''}">
        <span class="ep-vignette ${image ? '' : 'vide'}" ${vignette}>
          ${image ? '' : `<span class="ep-vide">${icon(e.video_url ? 'play' : 'inbox')}</span>`}
          <span class="ep-play">${icon(e.video_url ? 'play' : 'inbox')}</span>
          ${e.watched ? `<span class="ep-vu">${icon('check')}</span>` : ''}
        </span>
        <span class="ep-legende">
          <span class="ep-texte">
            <span class="ep-title">E${e.number}${e.title ? ' · ' + esc(e.title) : ''}</span>
            <span class="langue">${esc(item.langue || 'VOSTFR')}</span>
          </span>
          <span class="ep-note">${badgeNote(e)}</span>
        </span>
      </button>
      <button class="ep-seen" data-seen="${e.id}" type="button"
              aria-pressed="${e.watched ? 'true' : 'false'}"
              aria-label="${e.watched ? 'Marquer comme non vu' : 'Marquer comme vu'}">
        ${icon('check')}<span class="ep-seen-label">${e.watched ? 'Vu' : 'Non vu'}</span>
      </button>
    </article>`;
}

// Une saison dans la liste deroulante : son numero, et ou en est le membre.
function optionSaison(s, eps, choisie) {
  const vus = eps.filter((e) => e.watched).length;
  return `<option value="${s}" ${s === choisie ? 'selected' : ''}>
            Saison ${s} — ${eps.length} épisode${eps.length > 1 ? 's' : ''} (${vus} vu${vus > 1 ? 's' : ''})
          </option>`;
}

// Les episodes d'une saison, dans l'ordre demande.
function episodesTries(eps) {
  return sensEpisodes === 1 ? eps : [...eps].reverse();
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

  const premiere = list[0][0];

  // Une liste deroulante plutot que des onglets : au-dela de quelques saisons,
  // les onglets debordent et on ne voit plus ou l'on en est.
  const outils = `
    <div class="ep-outils">
      <div class="ep-select-wrap">
        <select id="seasonSelect" aria-label="Choisir la saison">
          ${list.map(([s, eps]) => optionSaison(s, eps, premiere)).join('')}
        </select>
        ${icon('chevron')}
      </div>
      <button class="icon-btn" id="epSens" type="button"
              aria-label="Inverser l’ordre des épisodes"
              title="Du premier au dernier">${icon('tri')}</button>
    </div>`;

  const panels = list
    .map(
      ([s, eps], i) => `
      <div class="season" data-season="${s}" ${i === 0 ? '' : 'hidden'}>
        <div class="season-bar">
          <span class="hint">${eps.filter((e) => e.watched).length} épisode(s) vu(s) sur ${eps.length}</span>
          ${boutonSaison(s, eps)}
        </div>
        <div class="ep-grid">${episodesTries(eps).map(episodeCarte).join('')}</div>
      </div>`
    )
    .join('');

  return `<section class="section section-large">
    <div class="ep-tete">
      <h2>Épisodes <span class="row-count">${item.episodeCount}</span></h2>
      ${outils}
    </div>
    ${panels}
  </section>`;
}

// Reconstruit les grilles apres un changement de sens. On ne refait que les
// cartes : le lecteur et le formulaire de commentaire restent en place.
function redessinerEpisodes() {
  for (const [s, eps] of seasons()) {
    const grille = document.querySelector(`.season[data-season="${s}"] .ep-grid`);
    if (grille) grille.innerHTML = episodesTries(eps).map(episodeCarte).join('');
  }
  document.querySelectorAll('.ep').forEach((el) => {
    el.classList.toggle('on', current && Number(el.dataset.ep) === current.id);
  });
  brancherEpisodes();
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
  const choix = document.getElementById('seasonSelect');
  if (choix) {
    const courante = choix.value;
    choix.innerHTML = seasons()
      .map(([saison, eps]) => optionSaison(saison, eps, Number(courante)))
      .join('');
    choix.value = courante;
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

// Affiche une saison et masque les autres.
function montrerSaison(saison) {
  document.querySelectorAll('.season').forEach((p) => {
    p.hidden = p.dataset.season !== String(saison);
  });
  const choix = document.getElementById('seasonSelect');
  if (choix && choix.value !== String(saison)) choix.value = String(saison);
}

// Ecouteurs des cartes d'episode. Reposes apres chaque redessin, car les
// cartes sont recreees.
function brancherEpisodes() {
  const findEp = (id) => (item.episodes || []).find((x) => x.id === Number(id));

  document.querySelectorAll('.ep-open').forEach((el) => {
    if (el.dataset.branche) return;
    el.dataset.branche = '1';
    el.addEventListener('click', () => {
      const ep = findEp(el.dataset.ep);
      if (ep) play(ep);
    });
  });

  document.querySelectorAll('[data-seen]').forEach((el) => {
    if (el.dataset.branche) return;
    el.dataset.branche = '1';
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ep = findEp(el.dataset.seen);
      if (!ep) return;
      el.disabled = true;
      await marquer(ep, !ep.watched);
      el.disabled = false;
    });
  });
}

function wirePage() {
  const findEp = (id) => (item.episodes || []).find((x) => x.id === Number(id));

  document.getElementById('seasonSelect')?.addEventListener('change', (e) => {
    montrerSaison(e.target.value);
  });

  document.getElementById('epSens')?.addEventListener('click', (b) => {
    sensEpisodes = -sensEpisodes;
    const bouton = document.getElementById('epSens');
    bouton.classList.toggle('on', sensEpisodes === -1);
    bouton.title = sensEpisodes === 1 ? 'Du premier au dernier' : 'Du dernier au premier';
    redessinerEpisodes();
  });

  brancherEpisodes();

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
      montrerSaison(ep.season);
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

  const social = document.getElementById('episodeSocial');

  social?.addEventListener('click', async (e) => {
    const cible = cibleCourante();
    if (!cible) return;

    const note = e.target.closest('[data-note]');
    if (note) return void noter(cible, Number(note.dataset.note));

    if (e.target.closest('#noteRetirer')) return void noter(cible, null);

    const aime = e.target.closest('[data-like]');
    if (aime) {
      aime.disabled = true;
      try {
        const r = await api(`/api/episodes/comments/${aime.dataset.like}/like`, { method: 'POST' });
        aime.classList.toggle('on', r.liked);
        aime.setAttribute('aria-pressed', String(r.liked));
        aime.querySelector('.com-like-n').textContent = r.likes || '';
      } catch (err) {
        alert(err.message || 'Impossible pour le moment.');
      } finally {
        aime.disabled = false;
      }
      return;
    }

    const repondre = e.target.closest('[data-repondre]');
    if (repondre) return void ouvrirReponse(repondre.dataset.repondre);

    const annule = e.target.closest('[data-annule-reponse]');
    if (annule) return void annule.closest('.reponse-form').remove();

    const del = e.target.closest('[data-delcom]');
    if (del) {
      del.disabled = true;
      try {
        // Supprimer un message emporte ses reponses : le serveur dit combien
        // de lignes ont disparu, le compteur suit.
        const r = await api(`/api/episodes/comments/${del.dataset.delcom}`, { method: 'DELETE' });
        document.querySelector(`[data-com="${del.dataset.delcom}"]`)?.remove();
        majCompteurCommentaires(cible, -(r.supprimes || 1));
        const liste = document.getElementById('comList');
        if (liste && !liste.querySelector('.commentaire'))
          liste.innerHTML = '<p class="hint">Personne n’a encore réagi.</p>';
      } catch (err) {
        del.disabled = false;
        alert(err.message || 'Suppression impossible.');
      }
    }
  });

  social?.addEventListener('submit', async (e) => {
    const formulaire = e.target;
    const racine = formulaire.id === 'comForm';
    if (!racine && !formulaire.classList.contains('reponse-form')) return;
    e.preventDefault();

    const cible = cibleCourante();
    const champ = formulaire.querySelector('textarea');
    const texte = champ.value.trim();
    if (!cible || !texte) return;

    champ.disabled = true;
    try {
      const { comment } = await api(`/api/episodes/${cible.id}/comments`, {
        method: 'POST',
        body: { body: texte, parentId: racine ? null : Number(formulaire.dataset.parent) },
      });

      if (racine) {
        champ.value = '';
        const liste = document.getElementById('comList');
        // Le premier commentaire remplace le texte d'attente ; les suivants
        // s'ajoutent en tete, comme les renvoie le serveur.
        if (!liste.querySelector('.commentaire')) liste.innerHTML = '';
        liste.insertAdjacentHTML('afterbegin', commentaireHtml(comment));
      } else {
        // La reponse se range sous le message d'origine, en fin de fil.
        const fil = document.querySelector(`[data-reponses="${comment.parent_id}"]`);
        fil?.insertAdjacentHTML('beforeend', commentaireHtml(comment, true));
        formulaire.remove();
      }
      majCompteurCommentaires(cible, +1);
    } catch (err) {
      alert(err.message || 'Publication impossible.');
    } finally {
      champ.disabled = false;
      if (racine) champ.focus();
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
  utilisateur = user;

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
       <section id="episodeSocial"></section>

       ${episodesHtml()}
       ${item.files.length ? `<section class="section"><h2>Téléchargements</h2>${item.files.map(fileRow).join('')}</section>` : ''}
       ${similarHtml()}
     </div>`;

  wireNav();
  renderPlayer();
  wirePage();
})();
