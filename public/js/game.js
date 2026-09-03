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
      renderNav(user, 'Jeux') +
      `<div class="empty">${icon('inbox', { cls: 'icon-lg' })}
        <h2>Jeu introuvable</h2>
        <a class="btn btn-primary" href="/?f=jeu">Retour aux jeux</a></div>`;
    wireNav();
    return;
  }

  document.title = `${item.title} — Kuroi`;

  const cover = item.poster_url
    ? `<div class="game-cover" style="background-image:url('${esc(item.poster_url)}')"></div>`
    : `<div class="game-cover placeholder">${icon('game')}</div>`;

  const downloads = item.files.length
    ? `<h2>Téléchargements</h2>${item.files.map(fileRow).join('')}`
    : '';

  const nothing =
    !item.files.length && !item.external_url
      ? `<p class="hint">Aucun fichier n’est encore disponible pour ce jeu.</p>`
      : '';

  app.innerHTML =
    renderNav(user, 'Jeux') +
    `<div class="game-wrap">
       ${cover}
       <div class="game-info">
         <div class="card-sub">Jeu${item.year ? ' · ' + esc(item.year) : ''}${
           item.genre ? ' · ' + esc(item.genre) : ''
         }</div>
         <h1>${esc(item.title)}</h1>
         <p class="game-desc">${esc(item.description || '')}</p>

         <div class="files">
           ${downloads}
           ${nothing}
         </div>

         <div class="player-actions">
           <button class="btn ${item.favorite ? 'btn-primary' : ''}" id="favBtn" type="button"
                   aria-pressed="${item.favorite}">
             ${icon('heart')} ${item.favorite ? 'Dans ma liste' : 'Ma liste'}
           </button>
           ${
             item.external_url
               ? `<a class="btn" href="${esc(item.external_url)}" target="_blank" rel="noopener noreferrer">
                    ${icon('link')} Lien externe</a>`
               : ''
           }
           <a class="btn btn-ghost" href="/?f=jeu">${icon('back')} Retour aux jeux</a>
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
