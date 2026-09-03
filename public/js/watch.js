const app = document.getElementById('app');

function playerHtml(item) {
  const url = item.video_url;
  if (!url) return '<div class="empty">Aucun lecteur n’est associé à ce titre.</div>';

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

function filesHtml(item) {
  if (!item.files?.length) return '';
  return `
    <div class="files">
      <h2>Téléchargements</h2>
      ${item.files.map(fileRow).join('')}
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
      renderNav(user, '') + '<div class="empty">Contenu introuvable. <a href="/">Retour</a></div>';
    wireLogout();
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
         <p style="color:#d5d5dd;line-height:1.6;margin-top:14px">${esc(item.description || '')}</p>
         ${filesHtml(item)}
         <a class="btn btn-ghost" href="/">← Retour au catalogue</a>
       </div>
     </div>`;

  wireLogout();
})();
