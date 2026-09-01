let me = null;

/* --------------------------------- modale --------------------------------- */

const modal = document.getElementById('modal');

function openModal(title, bodyHtml, actions) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  const bar = document.getElementById('modalActions');
  bar.innerHTML = '';
  for (const a of actions) {
    const b = document.createElement('button');
    b.className = `btn ${a.className || ''}`;
    b.textContent = a.label;
    b.addEventListener('click', () => a.onClick(b));
    bar.appendChild(b);
  }
  modal.classList.add('show');
}

function closeModal() {
  modal.classList.remove('show');
}

modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

function fail(err) {
  openModal('Erreur', `<p style="color:#ff8e93">${esc(err.message)}</p>`, [
    { label: 'Fermer', onClick: closeModal },
  ]);
}

/* ---------------------------------- stats --------------------------------- */

async function loadStats() {
  const s = await api('/api/admin/stats');
  document.getElementById('stats').innerHTML = [
    ['Utilisateurs', s.users],
    ['Admins', s.admins],
    ['Bannis', s.banned],
    ['Films', s.films],
    ['Séries', s.series],
    ['Jeux', s.jeux],
  ]
    .map(([l, n]) => `<div class="stat"><div class="n">${n}</div><div class="l">${l}</div></div>`)
    .join('');
}

/* ------------------------------ utilisateurs ------------------------------ */

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return isNaN(d) ? s : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

async function loadUsers() {
  const q = document.getElementById('userSearch').value.trim();
  const { users } = await api('/api/admin/users?q=' + encodeURIComponent(q));
  document.getElementById('usersBody').innerHTML = users
    .map((u) => {
      const self = u.id === me.id;
      return `<tr>
        <td>${u.id}</td>
        <td><b>${esc(u.username)}</b>${self ? ' <span class="badge">toi</span>' : ''}</td>
        <td>${esc(u.email)}</td>
        <td><span class="badge ${u.role === 'admin' ? 'admin' : ''}">${u.role}</span></td>
        <td>${u.banned
            ? `<span class="badge ban" title="${esc(u.ban_reason || '')}">banni</span>`
            : '<span class="badge ok">actif</span>'}</td>
        <td>${fmtDate(u.created_at)}</td>
        <td>${fmtDate(u.last_login_at)}</td>
        <td><div class="actions">
          <button class="btn btn-sm" data-act="pwd" data-id="${u.id}">Mot de passe</button>
          <button class="btn btn-sm" data-act="role" data-id="${u.id}" ${self ? 'disabled' : ''}>
            ${u.role === 'admin' ? 'Retirer admin' : 'Passer admin'}</button>
          <button class="btn btn-sm" data-act="ban" data-id="${u.id}" ${self ? 'disabled' : ''}>
            ${u.banned ? 'Débannir' : 'Bannir'}</button>
          <button class="btn btn-sm btn-danger" data-act="del" data-id="${u.id}" ${self ? 'disabled' : ''}>Supprimer</button>
        </div></td>
      </tr>`;
    })
    .join('');

  window.__users = Object.fromEntries(users.map((u) => [u.id, u]));
}

function showPassword(title, password, note) {
  openModal(
    title,
    `<p class="sub" style="color:var(--muted)">${esc(note)}</p>
     <div class="credential-box">${esc(password)}</div>
     <p style="color:var(--muted);font-size:12px">
       Ce mot de passe n'est affiché qu'une seule fois : il est stocké chiffré et ne peut plus être relu.
     </p>`,
    [{ label: 'Copier', className: 'btn-primary', onClick: (b) => {
        navigator.clipboard?.writeText(password).then(() => (b.textContent = 'Copié ✓'));
      } },
     { label: 'Fermer', onClick: closeModal }]
  );
}

function userAction(act, id) {
  const u = window.__users[id];
  if (!u) return;

  if (act === 'pwd') {
    openModal(
      `Mot de passe de ${u.username}`,
      `<div class="field">
         <label>Nouveau mot de passe (laisse vide pour en générer un)</label>
         <input id="newPwd" type="text" placeholder="Génération automatique">
       </div>`,
      [
        { label: 'Annuler', onClick: closeModal },
        {
          label: 'Réinitialiser',
          className: 'btn-primary',
          onClick: async (b) => {
            b.disabled = true;
            try {
              const r = await api(`/api/admin/users/${id}/reset-password`, {
                method: 'POST',
                body: { password: document.getElementById('newPwd').value },
              });
              showPassword(
                `Mot de passe de ${u.username}`,
                r.password,
                r.generated ? 'Mot de passe généré. Transmets-le à la personne.' : 'Mot de passe enregistré.'
              );
              loadUsers();
            } catch (e) { fail(e); }
          },
        },
      ]
    );
  }

  if (act === 'ban') {
    if (u.banned) {
      api(`/api/admin/users/${id}/ban`, { method: 'POST', body: { banned: false } })
        .then(() => { loadUsers(); loadStats(); })
        .catch(fail);
      return;
    }
    openModal(
      `Bannir ${u.username} ?`,
      `<div class="field">
         <label>Motif (visible par la personne à la connexion)</label>
         <input id="banReason" placeholder="Ex : partage de compte">
       </div>
       <p style="color:var(--muted);font-size:13px">Sa session est coupée immédiatement.</p>`,
      [
        { label: 'Annuler', onClick: closeModal },
        {
          label: 'Bannir',
          className: 'btn-danger',
          onClick: async (b) => {
            b.disabled = true;
            try {
              await api(`/api/admin/users/${id}/ban`, {
                method: 'POST',
                body: { banned: true, reason: document.getElementById('banReason').value },
              });
              closeModal(); loadUsers(); loadStats();
            } catch (e) { fail(e); }
          },
        },
      ]
    );
  }

  if (act === 'role') {
    const next = u.role === 'admin' ? 'user' : 'admin';
    openModal(
      'Changer le rôle',
      `<p>Passer <b>${esc(u.username)}</b> en <b>${next === 'admin' ? 'administrateur' : 'utilisateur'}</b> ?</p>
       ${next === 'admin' ? '<p style="color:var(--warn);font-size:13px">Un administrateur peut gérer tous les comptes et tout le contenu.</p>' : ''}`,
      [
        { label: 'Annuler', onClick: closeModal },
        {
          label: 'Confirmer',
          className: 'btn-primary',
          onClick: async (b) => {
            b.disabled = true;
            try {
              await api(`/api/admin/users/${id}/role`, { method: 'POST', body: { role: next } });
              closeModal(); loadUsers(); loadStats();
            } catch (e) { fail(e); }
          },
        },
      ]
    );
  }

  if (act === 'del') {
    openModal(
      'Supprimer le compte',
      `<p>Supprimer définitivement <b>${esc(u.username)}</b> (${esc(u.email)}) ?</p>
       <p style="color:var(--warn);font-size:13px">Cette action est irréversible.</p>`,
      [
        { label: 'Annuler', onClick: closeModal },
        {
          label: 'Supprimer',
          className: 'btn-danger',
          onClick: async (b) => {
            b.disabled = true;
            try {
              await api(`/api/admin/users/${id}`, { method: 'DELETE' });
              closeModal(); loadUsers(); loadStats();
            } catch (e) { fail(e); }
          },
        },
      ]
    );
  }
}

function newUser() {
  openModal(
    'Nouvel utilisateur',
    `<div class="field"><label>Pseudo</label><input id="nuUser"></div>
     <div class="field"><label>E-mail</label><input id="nuMail" type="email"></div>
     <div class="field"><label>Mot de passe (vide = généré)</label><input id="nuPwd" type="text"></div>
     <div class="field"><label>Rôle</label>
       <select id="nuRole"><option value="user">Utilisateur</option><option value="admin">Administrateur</option></select>
     </div>`,
    [
      { label: 'Annuler', onClick: closeModal },
      {
        label: 'Créer',
        className: 'btn-primary',
        onClick: async (b) => {
          b.disabled = true;
          try {
            const r = await api('/api/admin/users', {
              method: 'POST',
              body: {
                username: document.getElementById('nuUser').value,
                email: document.getElementById('nuMail').value,
                password: document.getElementById('nuPwd').value,
                role: document.getElementById('nuRole').value,
              },
            });
            showPassword('Compte créé', r.password, `Identifiant : ${r.user.username}`);
            loadUsers(); loadStats();
          } catch (e) { fail(e); }
        },
      },
    ]
  );
}

/* --------------------------------- contenu -------------------------------- */

async function loadContent() {
  const { content } = await api('/api/admin/content');
  document.getElementById('contentBody').innerHTML = content
    .map(
      (c) => `<tr>
        <td>${c.id}</td>
        <td><span class="badge">${esc(c.type)}</span></td>
        <td><b>${esc(c.title)}</b></td>
        <td>${c.year || '—'}</td>
        <td>${esc(c.genre || '—')}</td>
        <td>${c.featured ? '★' : ''}</td>
        <td><div class="actions">
          <button class="btn btn-sm" data-cact="edit" data-id="${c.id}">Modifier</button>
          <button class="btn btn-sm btn-danger" data-cact="del" data-id="${c.id}">Supprimer</button>
        </div></td>
      </tr>`
    )
    .join('');
  window.__content = Object.fromEntries(content.map((c) => [c.id, c]));
}

function contentForm(c = {}) {
  const v = (k) => esc(c[k] ?? '');
  return `
    <div class="field"><label>Type</label>
      <select id="cType">
        <option value="film" ${c.type === 'film' ? 'selected' : ''}>Film</option>
        <option value="serie" ${c.type === 'serie' ? 'selected' : ''}>Série</option>
        <option value="jeu" ${c.type === 'jeu' ? 'selected' : ''}>Jeu</option>
      </select>
    </div>
    <div class="field"><label>Titre</label><input id="cTitle" value="${v('title')}"></div>
    <div class="field"><label>Description</label><textarea id="cDesc">${v('description')}</textarea></div>
    <div class="field"><label>Affiche (URL d'image)</label><input id="cPoster" value="${v('poster_url')}"></div>
    <div class="field"><label>Lien vidéo — film/série (partage Google Drive ou URL directe)</label>
      <input id="cVideo" value="${v('video_url')}" placeholder="https://drive.google.com/file/d/…/view"></div>
    <div class="field"><label>Lien externe — jeu (dossier Drive)</label>
      <input id="cExt" value="${v('external_url')}" placeholder="https://drive.google.com/drive/folders/…"></div>
    <div class="field" style="display:flex;gap:10px">
      <div style="flex:1"><label>Année</label><input id="cYear" type="number" value="${v('year')}"></div>
      <div style="flex:2"><label>Genre</label><input id="cGenre" value="${v('genre')}"></div>
    </div>
    <div class="field">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="cFeat" ${c.featured ? 'checked' : ''} style="width:auto">
        Mettre à la une (grande bannière d'accueil)
      </label>
    </div>`;
}

function readContentForm() {
  return {
    type: document.getElementById('cType').value,
    title: document.getElementById('cTitle').value,
    description: document.getElementById('cDesc').value,
    poster_url: document.getElementById('cPoster').value,
    video_url: document.getElementById('cVideo').value,
    external_url: document.getElementById('cExt').value,
    year: document.getElementById('cYear').value,
    genre: document.getElementById('cGenre').value,
    featured: document.getElementById('cFeat').checked ? 1 : 0,
  };
}

function newContent() {
  openModal('Ajouter un titre', contentForm(), [
    { label: 'Annuler', onClick: closeModal },
    {
      label: 'Ajouter',
      className: 'btn-primary',
      onClick: async (b) => {
        b.disabled = true;
        try {
          await api('/api/admin/content', { method: 'POST', body: readContentForm() });
          closeModal(); loadContent(); loadStats();
        } catch (e) { fail(e); }
      },
    },
  ]);
}

function contentAction(act, id) {
  const c = window.__content[id];
  if (!c) return;

  if (act === 'edit') {
    openModal('Modifier « ' + c.title + ' »', contentForm(c), [
      { label: 'Annuler', onClick: closeModal },
      {
        label: 'Enregistrer',
        className: 'btn-primary',
        onClick: async (b) => {
          b.disabled = true;
          try {
            await api('/api/admin/content/' + id, { method: 'PUT', body: readContentForm() });
            closeModal(); loadContent();
          } catch (e) { fail(e); }
        },
      },
    ]);
  }

  if (act === 'del') {
    openModal('Supprimer', `<p>Supprimer « <b>${esc(c.title)}</b> » du catalogue ?</p>`, [
      { label: 'Annuler', onClick: closeModal },
      {
        label: 'Supprimer',
        className: 'btn-danger',
        onClick: async (b) => {
          b.disabled = true;
          try {
            await api('/api/admin/content/' + id, { method: 'DELETE' });
            closeModal(); loadContent(); loadStats();
          } catch (e) { fail(e); }
        },
      },
    ]);
  }
}

/* --------------------------------- journal -------------------------------- */

async function loadLogs() {
  const { logs } = await api('/api/admin/logs');
  document.getElementById('logsBody').innerHTML = logs
    .map(
      (l) =>
        `<li><b>${esc(l.actor_name)}</b> — ${esc(l.action)} ${esc(l.target || '')}
         ${l.details ? '· ' + esc(l.details) : ''}
         <span style="float:right">${esc(l.created_at)}</span></li>`
    )
    .join('');
}

/* ---------------------------------- init ---------------------------------- */

document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    for (const name of ['users', 'content', 'logs'])
      document.getElementById('tab-' + name).hidden = name !== t.dataset.tab;
    if (t.dataset.tab === 'content') loadContent();
    if (t.dataset.tab === 'logs') loadLogs();
  });
});

document.getElementById('usersBody').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (b) userAction(b.dataset.act, Number(b.dataset.id));
});

document.getElementById('contentBody').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-cact]');
  if (b) contentAction(b.dataset.cact, Number(b.dataset.id));
});

document.getElementById('newUserBtn').addEventListener('click', newUser);
document.getElementById('newContentBtn').addEventListener('click', newContent);

let searchTimer;
document.getElementById('userSearch').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadUsers, 250);
});

(async function init() {
  me = await currentUser();
  if (!requireLogin(me)) return;
  if (me.role !== 'admin') return void (location.href = '/');
  document.getElementById('nav').innerHTML = renderNav(me, '');
  wireLogout();
  await Promise.all([loadStats(), loadUsers()]);
})();
