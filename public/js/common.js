/* Utilitaires partagés par toutes les pages. */

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
  if (!res.ok) throw Object.assign(new Error(data.error || `Erreur ${res.status}`), { status: res.status, data });
  return data;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Transforme un lien de partage Google Drive en URL de lecteur intégrable.
function driveEmbed(url) {
  if (!url) return null;
  const m = url.match(/\/file\/d\/([\w-]+)/) || url.match(/[?&]id=([\w-]+)/);
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  return url;
}

function isDrive(url) {
  return /(^|\.)drive\.google\.com/.test((() => {
    try { return new URL(url).hostname; } catch { return ''; }
  })());
}

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} Mo`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} Go`;
}

// Ligne de téléchargement d'une pièce jointe. Le serveur renvoie le fichier
// avec son nom d'origine ; l'attribut download n'est là que par confort.
function fileRow(f) {
  return `
    <a class="file-row" href="/api/files/${f.id}" download>
      <span class="file-icon">⬇</span>
      <span class="file-name">${esc(f.original_name)}</span>
      <span class="file-size">${formatSize(f.size)}</span>
    </a>`;
}

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

function renderNav(user, active) {
  const links = [
    ['/', 'Accueil'],
    ['/?f=film', 'Films'],
    ['/?f=serie', 'Séries'],
    ['/?f=jeu', 'Jeux'],
  ];
  return `
    <nav class="nav">
      <a href="/" class="logo">KUROI</a>
      <div class="nav-links">
        ${links.map(([h, t]) => `<a href="${h}" class="${active === t ? 'active' : ''}">${t}</a>`).join('')}
      </div>
      <div class="nav-spacer"></div>
      <div class="nav-right">
        ${user.role === 'admin' ? '<a href="/admin" class="btn btn-sm btn-ghost">Admin</a>' : ''}
        <button class="btn btn-sm btn-ghost" id="logoutBtn">Déconnexion</button>
        <div class="avatar" title="${esc(user.username)}">${esc(user.username[0].toUpperCase())}</div>
      </div>
    </nav>`;
}

function wireLogout() {
  const btn = document.getElementById('logoutBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    location.href = '/login.html';
  });
}
