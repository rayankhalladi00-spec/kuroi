/* Utilitaires partagés par toutes les pages. */

/* ---------------------------------- réseau --------------------------------- */

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* réponse vide */
  }
  if (!res.ok)
    throw Object.assign(new Error(data.error || `Erreur ${res.status}`), { status: res.status, data });
  return data;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/* ---------------------------------- icônes ---------------------------------
   Traits SVG plutôt qu'emoji : un emoji change de dessin selon la plateforme,
   ne suit pas la couleur du texte et n'est pas lisible par un lecteur d'écran.
   -------------------------------------------------------------------------- */

const ICONS = {
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.7" y2="16.7"/>',
  chevron: '<polyline points="6 9 12 15 18 9"/>',
  close: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
  tri: '<line x1="4" y1="6" x2="13" y2="6"/><line x1="4" y1="12" x2="11" y2="12"/><line x1="4" y1="18" x2="9" y2="18"/><polyline points="17 9 20 6 17 3"/><line x1="20" y1="6" x2="20" y2="21"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  back: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  film: '<rect x="2.5" y="3" width="19" height="18" rx="2"/><line x1="7.5" y1="3" x2="7.5" y2="21"/><line x1="16.5" y1="3" x2="16.5" y2="21"/><line x1="2.5" y1="12" x2="21.5" y2="12"/>',
  tv: '<rect x="2" y="7" width="20" height="14" rx="2"/><polyline points="17 2 12 7 7 2"/>',
  game: '<line x1="6" y1="11" x2="10" y2="11"/><line x1="8" y1="9" x2="8" y2="13"/><line x1="15" y1="12" x2="15.01" y2="12"/><line x1="18" y1="10" x2="18.01" y2="10"/><rect x="2" y="6" width="20" height="12" rx="4"/>',
  idea: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.8V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.8"/>',
  up: '<polyline points="18 15 12 9 6 15"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
};

// `title` donne son nom accessible à l'icône ; sans titre elle est décorative
// et masquée aux lecteurs d'écran.
function icon(name, { cls = '', title = '' } = {}) {
  const body = ICONS[name];
  if (!body) return '';
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" ${
    title ? `role="img" aria-label="${esc(title)}"` : 'aria-hidden="true"'
  }>${body}</svg>`;
}

/* ---------------------------------- thème ---------------------------------- */

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem('kuroi-theme', theme);
  } catch {
    /* stockage indisponible : le choix ne survivra pas au rechargement */
  }
  const btn = document.getElementById('themeBtn');
  if (btn) {
    const next = theme === 'light' ? 'sombre' : 'clair';
    btn.innerHTML = icon(theme === 'light' ? 'moon' : 'sun');
    btn.setAttribute('aria-label', `Passer en thème ${next}`);
    btn.setAttribute('title', `Passer en thème ${next}`);
  }
}

/* --------------------------------- formats --------------------------------- */

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} Mo`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} Go`;
}

function formatDate(s) {
  if (!s) return '—';
  const d = new Date(String(s).replace(' ', 'T') + 'Z');
  return isNaN(d) ? s : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fileRow(f) {
  return `
    <a class="file-row" href="/api/files/${f.id}" download>
      ${icon('download')}
      <span class="file-name">${esc(f.original_name)}</span>
      <span class="file-size">${formatSize(f.size)}</span>
    </a>`;
}

/* ---------------------------- lecteurs et liens ---------------------------- */

function driveEmbed(url) {
  if (!url) return null;
  const m = url.match(/\/file\/d\/([\w-]+)/) || url.match(/[?&]id=([\w-]+)/);
  return m ? `https://drive.google.com/file/d/${m[1]}/preview` : url;
}

function isDrive(url) {
  try {
    return /(^|\.)drive\.google\.com$/.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

// L'etoile distingue les administrateurs. Le role est relu a chaque affichage
// plutot que fige dans le message : promouvoir quelqu'un doit se voir partout,
// y compris sur ce qu'il a ecrit avant.
function nomAvecRole(nom, role) {
  return role === 'admin'
    ? `${esc(nom)} <span class="admin-star" title="Administrateur">★</span>`
    : esc(nom);
}

/* -------------------------------- session ---------------------------------- */

async function currentUser() {
  try {
    const { user } = await api('/api/auth/me');
    return user;
  } catch {
    return null;
  }
}

function requireLogin(user) {
  if (!user) {
    location.href = '/login.html?next=' + encodeURIComponent(location.pathname + location.search);
    return false;
  }
  return true;
}

/* -------------------------------- navigation ------------------------------- */

// La photo si le membre en a choisi une, son initiale sinon.
function avatarHtml(user, cls = '') {
  return user.avatarUrl
    ? `<img class="avatar-img ${cls}" src="${esc(user.avatarUrl)}" alt="">`
    : `<span class="avatar-initial ${cls}">${esc(user.username[0].toUpperCase())}</span>`;
}

function renderNav(user, active) {
  const links = [
    ['/', 'Accueil', 'home'],
    ['/?f=film', 'Films', 'film'],
    ['/?f=serie', 'Séries', 'tv'],
    ['/?f=jeu', 'Jeux', 'game'],
    ['/idees.html', 'Boîte à idées', 'idea'],
    ['/historique.html', 'Historique', 'clock'],
  ];
  return `
    <nav class="nav">
      <a href="/" class="logo">KUROI</a>
      <div class="nav-links">
        ${links
          .map(([h, t]) => `<a href="${h}" class="${active === t ? 'active' : ''}">${t}</a>`)
          .join('')}
      </div>
      <div class="nav-spacer"></div>
      <div class="nav-right">
        <button class="nav-search" id="rechercheBtn" type="button">
          ${icon('search')}
          <span>Rechercher…</span>
          <kbd>Ctrl K</kbd>
        </button>
        <button class="icon-btn" id="themeBtn" type="button" aria-label="Changer de thème"></button>
        ${user.role === 'admin' ? '<a href="/admin" class="btn btn-sm btn-ghost">Admin</a>' : ''}
        <div class="profile">
          <button class="avatar" id="profileBtn" type="button"
                  aria-haspopup="menu" aria-expanded="false" aria-label="Mon profil">
            ${avatarHtml(user)}
          </button>
          <div class="menu" id="profileMenu" hidden role="menu">
            <div class="menu-head">
              ${avatarHtml(user, 'menu-avatar')}
              <div>
                <b>${nomAvecRole(user.username, user.role)}</b>
                <small>${esc(user.email)}</small>
              </div>
            </div>
            <a class="menu-item" role="menuitem" href="/historique.html">${icon('clock')} Historique</a>
            <button class="menu-item" role="menuitem" id="avatarBtn" type="button">
              ${icon('user')} Changer de photo
            </button>
            <button class="menu-item danger" role="menuitem" id="logoutBtn" type="button">
              ${icon('logout')} Se déconnecter
            </button>
          </div>
        </div>
      </div>
    </nav>`;
}

// Choix de la photo parmi le jeu propose. Aucun televersement : le serveur
// n'accepte qu'un identifiant deja present dans public/img/avatars/.
async function choisirAvatar() {
  const { avatars, current } = await api('/api/auth/avatars');

  const fond = document.createElement('div');
  fond.className = 'modal-backdrop show';
  fond.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="Choisir une photo">
      <h3>Choisir une photo</h3>
      ${
        avatars.length
          ? `<div class="avatar-grid">
               ${avatars
                 .map(
                   (a) => `<button class="avatar-choice ${a.id === current ? 'on' : ''}"
                                   data-avatar="${esc(a.id)}" type="button" aria-label="${esc(a.id)}">
                             <img src="${esc(a.url)}" alt="">
                           </button>`
                 )
                 .join('')}
             </div>
             <button class="btn btn-sm btn-ghost" data-avatar="" type="button"
                     style="margin-top:14px">Aucune photo</button>`
          : '<p class="hint">Aucune photo n’est disponible pour l’instant.</p>'
      }
      <div class="modal-actions"><button class="btn" data-fermer type="button">Fermer</button></div>
    </div>`;
  document.body.appendChild(fond);

  const fermer = () => fond.remove();
  fond.addEventListener('click', async (e) => {
    if (e.target === fond || e.target.closest('[data-fermer]')) return fermer();

    const choix = e.target.closest('[data-avatar]');
    if (!choix) return;
    try {
      await api('/api/auth/avatar', { method: 'POST', body: { avatar: choix.dataset.avatar || null } });
      location.reload(); // la photo apparaît partout où la barre est rendue
    } catch (err) {
      alert(err.message);
    }
  });
}

// À appeler après avoir injecté la barre de navigation.
function wireNav() {
  brancherRecherche();
  applyTheme(currentTheme());

  document.getElementById('themeBtn')?.addEventListener('click', () => {
    applyTheme(currentTheme() === 'light' ? 'dark' : 'light');
  });

  // Menu de profil : ouverture, fermeture au clic extérieur et à Échap.
  const btn = document.getElementById('profileBtn');
  const menu = document.getElementById('profileMenu');
  if (btn && menu) {
    const fermer = () => {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      btn.setAttribute('aria-expanded', String(!menu.hidden));
    });
    document.addEventListener('click', (e) => {
      if (!menu.hidden && !menu.contains(e.target)) fermer();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') fermer();
    });
  }

  document.getElementById('avatarBtn')?.addEventListener('click', choisirAvatar);

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    location.href = '/login.html';
  });

  // Une bordure n'apparaît sous la barre qu'une fois la page défilée.
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
}


/* -------------------------- recherche en surimpression --------------------- */

// Le catalogue n'est charge qu'a la premiere ouverture, puis garde en memoire :
// on ne le redemande pas a chaque frappe.
let catalogueRecherche = null;
let rechercheOuverte = false;
let choixRecherche = 0;

const PAGE_DE = (item) => (item.type === 'jeu' ? 'game.html' : 'watch.html');

async function chargerCatalogue() {
  if (catalogueRecherche) return catalogueRecherche;
  const d = await api('/api/content');
  catalogueRecherche = [...d.films, ...d.series, ...d.jeux];
  return catalogueRecherche;
}

function resultatHtml(item, actif) {
  const vignette = item.poster_url
    ? `<img src="${esc(item.poster_url)}" alt="" loading="lazy">`
    : `<span class="sans-affiche">${icon(item.type === 'jeu' ? 'game' : 'tv')}</span>`;
  const dessous = [item.genre, item.year].filter(Boolean).map(esc).join(' • ');
  return `<a class="resultat ${actif ? 'on' : ''}" href="/${PAGE_DE(item)}?id=${item.id}">
    <span class="resultat-img">${vignette}</span>
    <span class="resultat-texte">
      <b>${esc(item.title)}</b>
      <small>${dessous || esc(SINGULAIRE_TYPE[item.type] || item.type)}</small>
    </span>
    ${icon('chevron', { cls: 'resultat-fleche' })}
  </a>`;
}

const SINGULAIRE_TYPE = { film: 'Film', serie: 'Série', jeu: 'Jeu' };

function trouver(liste, q) {
  const terme = q.trim().toLowerCase();
  if (!terme) return [];
  return liste
    .filter((i) =>
      [i.title, i.genre, i.description].filter(Boolean).some((v) =>
        String(v).toLowerCase().includes(terme)
      )
    )
    // Un titre qui commence par le terme passe devant : c'est presque toujours
    // celui qu'on cherche.
    .sort((a, b) => {
      const pa = a.title.toLowerCase().startsWith(terme) ? 0 : 1;
      const pb = b.title.toLowerCase().startsWith(terme) ? 0 : 1;
      return pa - pb || a.title.localeCompare(b.title, 'fr');
    })
    .slice(0, 20);
}

function boiteRecherche() {
  let boite = document.getElementById('rechercheBoite');
  if (boite) return boite;

  boite = document.createElement('div');
  boite.id = 'rechercheBoite';
  boite.hidden = true;
  boite.innerHTML = `
    <div class="recherche-fond" data-fermer></div>
    <div class="recherche-panneau" role="dialog" aria-modal="true" aria-label="Rechercher">
      <div class="recherche-champ">
        ${icon('search')}
        <input id="rechercheInput" type="search" placeholder="Rechercher…"
               autocomplete="off" aria-label="Rechercher un titre">
        <button class="icon-btn" data-fermer type="button" aria-label="Fermer">${icon('close')}</button>
      </div>
      <div class="recherche-liste" id="rechercheListe"></div>
      <div class="recherche-pied">
        <span>Vous ne trouvez pas ce que vous cherchez ?</span>
        <a href="/idees.html">Suggérez une œuvre !</a>
      </div>
    </div>`;
  document.body.appendChild(boite);

  boite.addEventListener('click', (e) => {
    if (e.target.closest('[data-fermer]')) fermerRecherche();
  });

  const champ = boite.querySelector('#rechercheInput');
  champ.addEventListener('input', () => majResultats(champ.value));

  champ.addEventListener('keydown', (e) => {
    const liens = [...boite.querySelectorAll('.resultat')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!liens.length) return;
      choixRecherche = (choixRecherche + (e.key === 'ArrowDown' ? 1 : -1) + liens.length) % liens.length;
      liens.forEach((l, i) => l.classList.toggle('on', i === choixRecherche));
      liens[choixRecherche].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      if (liens[choixRecherche]) {
        e.preventDefault();
        liens[choixRecherche].click();
      }
    }
  });

  return boite;
}

async function majResultats(q) {
  const liste = document.getElementById('rechercheListe');
  const terme = q.trim();
  choixRecherche = 0;

  if (!terme) {
    liste.innerHTML = '<p class="recherche-vide">Tape le nom d’un titre, ou un genre.</p>';
    return;
  }

  let tous;
  try {
    tous = await chargerCatalogue();
  } catch {
    liste.innerHTML = '<p class="recherche-vide">Le catalogue n’a pas pu être chargé.</p>';
    return;
  }

  // La saisie a pu changer pendant le chargement : on ne remplace la liste que
  // si le terme affiche est toujours celui qu'on vient de traiter.
  const champ = document.getElementById('rechercheInput');
  if (champ && champ.value.trim() !== terme) return;

  const trouves = trouver(tous, terme);
  liste.innerHTML = trouves.length
    ? trouves.map((it, i) => resultatHtml(it, i === 0)).join('')
    : `<p class="recherche-vide">Rien pour « ${esc(terme)} ».</p>`;
}

function ouvrirRecherche() {
  const boite = boiteRecherche();
  boite.hidden = false;
  rechercheOuverte = true;
  document.body.classList.add('sans-defilement');
  const champ = document.getElementById('rechercheInput');
  champ.value = '';
  majResultats('');
  champ.focus();
}

function fermerRecherche() {
  const boite = document.getElementById('rechercheBoite');
  if (!boite) return;
  boite.hidden = true;
  rechercheOuverte = false;
  document.body.classList.remove('sans-defilement');
}

function brancherRecherche() {
  document.getElementById('rechercheBtn')?.addEventListener('click', ouvrirRecherche);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      rechercheOuverte ? fermerRecherche() : ouvrirRecherche();
    } else if (e.key === 'Escape' && rechercheOuverte) {
      fermerRecherche();
    }
  });
}
