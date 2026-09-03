const app = document.getElementById('app');

function playerHtml(item) {
  const url = item.video_url;
  if (!url)
    return `<div class="empty">${icon('film', { cls: 'icon-lg' })}
      <h2>Aucun lecteur</h2><p>Ce titre n’a pas encore de source vidéo.</p></div>`;

  // Fichier vidéo direct : lecteur natif du navigateur.
  if (item.player === 'video') {
    return `<div class="player">
      <video src="${esc(url)}" controls autoplay playsinline preload="metadata"></video>
    </div>`;
  }

  // Lecteur externe. L'adresse a été extraite côté serveur du code
  // d'intégration : on ne réinjecte jamais le HTML fourni, on reconstruit
  // une balise propre.
  const src = isDrive(url) ? driveEmbed(url) : url;
  return `<div class="player">
    <iframe src="${esc(src)}" allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowfullscreen referrerpolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"></iframe>
  </div>`;
}

(async function init() {
  const user = await currentUser();
  if (!requireLogin(user)) return;

  const id = new URLSearchParams(location.search).get('id');
  let item;
  try {
    ({ item } = await api('/api/content/' + encodeURIComponent(id)));
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

  app.innerHTML =
    renderNav(user, '') +
    `<div class="player-wrap">
       ${playerHtml(item)}
       <div class="player-meta">
         <h1>${esc(item.title)}</h1>
         <div class="card-sub">${[item.year, item.genre].filter(Boolean).map(esc).join(' · ')}</div>
         <p class="player-desc">${esc(item.description || '')}</p>
         ${item.files.length ? `<div class="files"><h2>Téléchargements</h2>${item.files.map(fileRow).join('')}</div>` : ''}
         <div class="player-actions">
           <button class="btn ${item.favorite ? 'btn-primary' : ''}" id="favBtn" type="button"
                   aria-pressed="${item.favorite}">
             ${icon('heart')} ${item.favorite ? 'Dans ma liste' : 'Ma liste'}
           </button>
           <a class="btn btn-ghost" href="/">${icon('back')} Retour au catalogue</a>
         </div>
       </div>
     </div>`;

  wireNav();

  const fav = document.getElementById('favBtn');
  fav.addEventListener('click', async () => {
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
})();
