const app = document.getElementById('app');

// Page de diagnostic du lecteur.
//
// Trois correctifs successifs ont echoue sur iPhone sans que rien ne soit
// visible d'ici : impossible de lire la console de Safari a distance, et une
// iframe d'un autre domaine ne laisse rien inspecter. Cette page teste chaque
// couche separement, sur l'appareil concerne, et affiche ce qui casse.
//
// A supprimer une fois le probleme regle.

const ETAT = { attente: '…', ok: 'OK', echec: 'ÉCHEC' };

function ligne(id, titre, detail) {
  return `<div class="diag" id="${id}">
    <div class="diag-head">
      <span class="diag-etat">${ETAT.attente}</span>
      <b>${esc(titre)}</b>
    </div>
    <p class="diag-detail">${esc(detail)}</p>
  </div>`;
}

function resultat(id, ok, detail) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add(ok ? 'ok' : 'echec');
  el.querySelector('.diag-etat').textContent = ok ? ETAT.ok : ETAT.echec;
  if (detail) el.querySelector('.diag-detail').textContent = detail;
}

(async function init() {
  const user = await currentUser();
  if (!requireLogin(user)) return;

  // On prend un episode reellement configure plutot qu'une adresse en dur :
  // le diagnostic doit porter sur ce que le site sert vraiment.
  let source = null;
  let ou = '';
  try {
    const { series } = await api('/api/content');
    for (const s of series) {
      const { item } = await api('/api/content/' + s.id);
      const ep = (item.episodes || []).find((e) => e.video_url);
      if (ep) {
        source = ep.video_url;
        ou = `${item.title} — S${ep.season}E${ep.number}`;
        break;
      }
    }
  } catch {
    /* on affichera l'absence de source */
  }

  app.innerHTML =
    renderNav(user, '') +
    `<div class="page">
       <div class="page-head">
         <h1>Diagnostic du lecteur</h1>
         <p>Ouvre cette page sur l’appareil qui pose problème, attends dix secondes,
            puis envoie-moi une capture. Chaque ligne teste une couche différente.</p>
       </div>

       <div class="diag-info">
         <div><b>Appareil</b><span id="ua"></span></div>
         <div><b>Lecteur testé</b><span>${esc(ou || 'aucun épisode avec lecteur')}</span></div>
         <div><b>Adresse</b><span class="mono">${esc(source || '—')}</span></div>
       </div>

       ${ligne('t1', '1. HLS lu nativement par cet appareil', 'Le navigateur sait-il lire un flux .m3u8 sans aide ?')}
       ${ligne('t2', '2. La page du lecteur se charge', 'L’iframe atteint-elle le serveur du lecteur ?')}
       ${ligne('t3', '3. Le domaine du lecteur est joignable', 'Ton réseau laisse-t-il passer ce serveur ?')}

       <section class="section">
         <h2>Le lecteur, en direct</h2>
         <p class="hint">Si tu vois l’image et que la lecture démarre, c’est réglé.
            Si un message d’erreur apparaît, note lequel.</p>
         <div id="cadre"></div>
       </section>
     </div>`;

  wireNav();
  document.getElementById('ua').textContent = navigator.userAgent;

  /* 1. Support natif du HLS. Safari le lit, la plupart des autres non. */
  {
    const v = document.createElement('video');
    const natif = v.canPlayType('application/vnd.apple.mpegurl');
    resultat('t1', Boolean(natif),
      natif ? `Oui (${natif}) — un flux HLS peut être joué directement.`
            : 'Non — cet appareil a besoin du lecteur du site pour un flux HLS.');
  }

  /* 2. La page du lecteur répond-elle ? On ne peut pas lire dans une iframe
     d'un autre domaine, mais l'événement de chargement, lui, se déclenche. */
  if (source) {
    const test = document.createElement('iframe');
    test.style.cssText = 'width:1px;height:1px;opacity:0;position:absolute;left:-9999px';
    let repondu = false;
    test.addEventListener('load', () => {
      repondu = true;
      resultat('t2', true, 'La page du lecteur a été chargée par le navigateur.');
    });
    test.src = source;
    document.body.appendChild(test);
    setTimeout(() => {
      if (!repondu) resultat('t2', false, 'Aucune réponse : le cadre n’a jamais fini de charger.');
    }, 8000);
  } else {
    resultat('t2', false, 'Aucun épisode ne porte de lecteur : rien à tester.');
  }

  /* 3. Le serveur du lecteur est-il seulement joignable depuis cet appareil ?
     Un operateur mobile peut bloquer un domaine que la box laisse passer, et
     tout le reste s'expliquerait par la. On charge une image depuis ce
     domaine : la CSP autorise les images de n'importe quelle source. */
  if (source) {
    const hote = new URL(source).origin;
    const img = new Image();
    let repondu = false;
    const fini = (ok, texte) => {
      if (repondu) return;
      repondu = true;
      resultat('t3', ok, texte);
    };
    img.addEventListener('load', () => fini(true, `${hote} répond : le réseau laisse passer.`));
    // Une erreur de decodage prouve quand meme que la reponse est arrivee.
    img.addEventListener('error', () =>
      fini(false, `${hote} n'a rien renvoyé : ton réseau bloque peut-être ce domaine. Réessaie en wifi, ou en données mobiles.`)
    );
    img.src = hote + '/favicon.ico?' + Date.now();
    setTimeout(() => fini(false, `${hote} ne répond pas — blocage réseau probable.`), 8000);
  } else {
    resultat('t3', false, 'Aucun lecteur à joindre.');
  }

  /* Le lecteur en grand, pour voir le message d'erreur exact. */
  document.getElementById('cadre').innerHTML = source
    ? `<div class="player">
         <iframe src="${esc(source)}" frameborder="0" scrolling="no" allowfullscreen></iframe>
       </div>
       <p class="player-fallback">
         <a href="${esc(source)}" target="_blank" rel="noopener noreferrer">
           Ouvrir ce lecteur seul, dans un seul onglet
         </a>
       </p>`
    : '<p class="hint">Aucun lecteur configuré.</p>';
})();
