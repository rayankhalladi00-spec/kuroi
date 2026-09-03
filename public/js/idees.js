const app = document.getElementById('app');

const TYPE_ICON = { film: 'film', serie: 'tv', jeu: 'game' };
const TYPE_LABEL = { film: 'Film', serie: 'Série', jeu: 'Jeu' };
const STATUS = {
  nouveau: { label: 'Proposé', cls: '' },
  prevu: { label: 'Prévu', cls: 'ok' },
  ajoute: { label: 'Ajouté', cls: 'ok' },
  refuse: { label: 'Refusé', cls: 'danger' },
};

let me = null;
let all = [];
let filter = 'tous';

/* ---------------------------------- rendu ---------------------------------- */

function ideaRow(s) {
  const st = STATUS[s.status] || STATUS.nouveau;
  const mine = s.user_id === me.id;
  const canDelete = mine || me.role === 'admin';

  return `
    <article class="idea ${s.status === 'refuse' ? 'refuse' : ''}" data-id="${s.id}">
      <button class="vote ${s.voted ? 'on' : ''}" data-vote="${s.id}" type="button"
              aria-pressed="${s.voted ? 'true' : 'false'}"
              aria-label="${s.voted ? 'Retirer mon vote' : 'Voter pour'} ${esc(s.title)}">
        ${icon('up')}
        <b>${s.votes}</b>
        <small>${s.votes > 1 ? 'votes' : 'vote'}</small>
      </button>

      <div class="idea-body">
        <div class="idea-title">
          ${icon(TYPE_ICON[s.type])}
          <span>${esc(s.title)}</span>
          <span class="badge ${st.cls}">${st.label}</span>
        </div>
        ${s.note ? `<div class="idea-note">${esc(s.note)}</div>` : ''}
        <div class="idea-meta">${esc(TYPE_LABEL[s.type])} · proposé par ${esc(s.author)} le ${formatDate(s.created_at)}</div>
        ${s.admin_note ? `<div class="idea-admin-note"><b>Réponse :</b> ${esc(s.admin_note)}</div>` : ''}
      </div>

      <div class="idea-actions">
        ${
          me.role === 'admin'
            ? `<select data-status="${s.id}" aria-label="Statut de la proposition">
                 ${Object.entries(STATUS)
                   .map(([k, v]) => `<option value="${k}" ${s.status === k ? 'selected' : ''}>${v.label}</option>`)
                   .join('')}
               </select>`
            : ''
        }
        ${
          canDelete
            ? `<button class="icon-btn" data-del="${s.id}" type="button"
                 aria-label="Supprimer la proposition ${esc(s.title)}">${icon('trash')}</button>`
            : ''
        }
      </div>
    </article>`;
}

function render() {
  const list = filter === 'tous' ? all : all.filter((s) => s.type === filter || s.status === filter);

  document.getElementById('list').innerHTML = list.length
    ? list.map(ideaRow).join('')
    : `<div class="empty">
         ${icon('inbox', { cls: 'icon-lg' })}
         <h2>Rien ici pour l’instant</h2>
         <p>Sois le premier à proposer un titre.</p>
       </div>`;

  document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.filter === filter));
}

/* ------------------------------- interactions ------------------------------ */

function replace(updated) {
  const i = all.findIndex((s) => s.id === updated.id);
  if (i >= 0) all[i] = updated;
  render();
}

async function load() {
  const { suggestions } = await api('/api/suggestions');
  all = suggestions;
  render();
}

function wireList() {
  document.getElementById('list').addEventListener('click', async (e) => {
    const vote = e.target.closest('[data-vote]');
    if (vote) {
      vote.disabled = true;
      try {
        const r = await api(`/api/suggestions/${vote.dataset.vote}/vote`, { method: 'POST' });
        replace(r.suggestion);
      } catch {
        vote.disabled = false;
      }
      return;
    }

    const del = e.target.closest('[data-del]');
    if (del) {
      const id = Number(del.dataset.del);
      const s = all.find((x) => x.id === id);
      if (!confirm(`Supprimer la proposition « ${s?.title ?? ''} » ?`)) return;
      del.disabled = true;
      try {
        await api('/api/suggestions/' + id, { method: 'DELETE' });
        all = all.filter((x) => x.id !== id);
        render();
      } catch {
        del.disabled = false;
      }
    }
  });

  document.getElementById('list').addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-status]');
    if (!sel) return;
    const note = prompt('Message à afficher sous la proposition (facultatif) :', '');
    if (note === null) return void render(); // annulé : on remet la valeur d'origine
    try {
      const r = await api(`/api/suggestions/${sel.dataset.status}/status`, {
        method: 'POST',
        body: { status: sel.value, admin_note: note },
      });
      replace(r.suggestion);
    } catch (err) {
      alert(err.message);
      render();
    }
  });
}

/* ---------------------------------- départ --------------------------------- */

(async function init() {
  me = await currentUser();
  if (!requireLogin(me)) return;

  const chips = [
    ['tous', 'Tout'],
    ['film', 'Films'],
    ['serie', 'Séries'],
    ['jeu', 'Jeux'],
    ['nouveau', 'À traiter'],
    ['ajoute', 'Ajoutés'],
  ];

  app.innerHTML =
    renderNav(me, 'Boîte à idées') +
    `<div class="page">
       <div class="page-head">
         <h1>Boîte à idées</h1>
         <p>Propose un film, une série ou un jeu à ajouter au catalogue. Vote pour les
            propositions des autres : les plus demandées remontent en haut.</p>
       </div>

       <form class="idea-form" id="ideaForm">
         <div class="msg" id="msg"></div>
         <div class="row-inline">
           <div class="field" style="flex:0 0 130px">
             <label for="iType">Type</label>
             <select id="iType">
               <option value="film">Film</option>
               <option value="serie">Série</option>
               <option value="jeu">Jeu</option>
             </select>
           </div>
           <div class="field" style="flex:2">
             <label for="iTitle">Titre</label>
             <input id="iTitle" maxlength="120" required placeholder="Le titre que tu veux voir arriver">
           </div>
         </div>
         <div class="field" style="margin-top:14px">
           <label for="iNote">Précision (facultatif)</label>
           <textarea id="iNote" maxlength="500" rows="2"
                     placeholder="Une année, une version, une raison…"></textarea>
         </div>
         <button class="btn btn-primary" type="submit">${icon('plus')} Proposer</button>
       </form>

       <div class="filters">
         ${chips.map(([k, l]) => `<button class="chip" data-filter="${k}" type="button">${l}</button>`).join('')}
       </div>

       <div id="list"></div>
     </div>`;

  wireNav();
  wireList();

  document.querySelectorAll('.chip').forEach((c) =>
    c.addEventListener('click', () => {
      filter = c.dataset.filter;
      render();
    })
  );

  const msg = document.getElementById('msg');
  document.getElementById('ideaForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.className = 'msg';
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const r = await api('/api/suggestions', {
        method: 'POST',
        body: {
          type: document.getElementById('iType').value,
          title: document.getElementById('iTitle').value,
          note: document.getElementById('iNote').value,
        },
      });
      all.unshift(r.suggestion);
      document.getElementById('iTitle').value = '';
      document.getElementById('iNote').value = '';
      msg.textContent = 'Proposition enregistrée. Elle démarre avec ton vote.';
      msg.className = 'msg show success';
      render();
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'msg show error';
    } finally {
      btn.disabled = false;
    }
  });

  await load();
})();
