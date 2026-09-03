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

function renderNav(user, active) {
  const links = [
    ['/', 'Accueil', 'home'],
    ['/?f=film', 'Films', 'film'],
    ['/?f=serie', 'Séries', 'tv'],
    ['/?f=jeu', 'Jeux', 'game'],
    ['/idees.html', 'Boîte à idées', 'idea'],
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
        <button class="icon-btn" id="themeBtn" type="button" aria-label="Changer de thème"></button>
        ${user.role === 'admin' ? '<a href="/admin" class="btn btn-sm btn-ghost">Admin</a>' : ''}
        <button class="icon-btn" id="logoutBtn" type="button" aria-label="Se déconnecter" title="Se déconnecter">
          ${icon('logout')}
        </button>
        <div class="avatar" title="${esc(user.username)}">${esc(user.username[0].toUpperCase())}</div>
      </div>
    </nav>`;
}

// À appeler après avoir injecté la barre de navigation.
function wireNav() {
  applyTheme(currentTheme());

  document.getElementById('themeBtn')?.addEventListener('click', () => {
    applyTheme(currentTheme() === 'light' ? 'dark' : 'light');
  });

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
