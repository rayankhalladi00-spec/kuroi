const app = document.getElementById('app');

function playerHtml(item) {
  const url = item.video_url;
  if (!url) return '<div class="empty">Aucune source vidéo pour ce titre.</div>';

  if (isDrive(url)) {
    return `<div class="player">
      <iframe src="${esc(driveEmbed(url))}" allow="autoplay; encrypted-media; fullscreen"
              allowfullscreen referrerpolicy="no-referrer"></iframe>
    </div>`;
  }
  return `<div class="player">
    <video src="${esc(url)}" controls autoplay playsinline preload="metadata"></video>
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
    app.innerHTML = renderNav(user, '') + '<div class="empty">Contenu introuvable. <a href="/">Retour</a></div>';
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
         <a class="btn btn-ghost" href="/">← Retour au catalogue</a>
       </div>
     </div>`;

  wireLogout();
})();
