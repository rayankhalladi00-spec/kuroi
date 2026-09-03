const app = document.getElementById('app');

(async function init() {
  const user = await currentUser();
  if (!requireLogin(user)) return;

  const id = new URLSearchParams(location.search).get('id');
  let item;
  try {
    ({ item } = await api('/api/content/' + encodeURIComponent(id)));
  } catch {
    app.innerHTML =
      renderNav(user, '') + '<div class="empty">Jeu introuvable. <a href="/">Retour</a></div>';
    wireLogout();
    return;
  }

  document.title = `${item.title} — Kuroi`;

  const cover = item.poster_url
    ? `<div class="game-cover" style="background-image:url('${esc(item.poster_url)}')"></div>`
    : '<div class="game-cover placeholder">🎮</div>';

  const downloads = item.files.length
    ? `<h2>Téléchargements</h2>${item.files.map(fileRow).join('')}`
    : '';

  const external = item.external_url
    ? `<a class="btn btn-primary" href="${esc(item.external_url)}" target="_blank" rel="noopener noreferrer">
         Ouvrir le lien externe
       </a>`
    : '';

  const nothing =
    !item.files.length && !item.external_url
      ? '<p style="color:var(--muted)">Aucun fichier n’est encore disponible pour ce jeu.</p>'
      : '';

  app.innerHTML =
    renderNav(user, 'Jeux') +
    `<div class="game-wrap">
       ${cover}
       <div class="game-info">
         <div class="card-sub">Jeu${item.year ? ' · ' + esc(item.year) : ''}${item.genre ? ' · ' + esc(item.genre) : ''}</div>
         <h1>${esc(item.title)}</h1>
         <p class="game-desc">${esc(item.description || '')}</p>
         <div class="files">
           ${downloads}
           ${nothing}
         </div>
         ${external}
         <a class="btn btn-ghost" href="/?f=jeu">← Retour aux jeux</a>
       </div>
     </div>`;

  wireLogout();
})();
