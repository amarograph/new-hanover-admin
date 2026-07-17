const USER_TABS = [
  { key: '', label: 'Tous' },
  { key: 'accepted', label: 'Acceptés' },
  { key: 'pending', label: 'En attente' },
  { key: 'suspended', label: 'Suspendus' },
  { key: 'refused', label: 'Refusés' },
  { key: 'disabled', label: 'Désactivés' },
];
let userState = { status: '' };
let rolesCache = [];
let currentUser = null;

async function loadRoles() {
  const data = await NH.get('/api/roles');
  rolesCache = data.roles;
  document.getElementById('f-role').innerHTML = '<option value="">Sans rôle</option>' + rolesCache.map((r) => `<option value="${r.id}">${NH.escapeHtml(r.name)}</option>`).join('');
}

function renderTabs() {
  const el = document.getElementById('status-tabs');
  el.innerHTML = USER_TABS.map((t) => `<div class="tab ${userState.status === t.key ? 'active' : ''}" data-key="${t.key}">${t.label}</div>`).join('');
  el.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => { userState.status = tab.dataset.key; renderTabs(); loadUsers(); }));
}

async function loadUsers() {
  const params = new URLSearchParams();
  if (userState.status) params.set('status', userState.status);
  try {
    const data = await NH.get(`/api/users?${params.toString()}`);
    const tbody = document.getElementById('table-body');
    document.getElementById('table-empty').style.display = data.users.length ? 'none' : '';
    tbody.innerHTML = data.users.map((u) => {
      const name = (u.character_first_name || u.character_last_name) ? `${u.character_first_name || ''} ${u.character_last_name || ''}`.trim() : '—';
      return `<tr class="row" data-id="${u.id}" style="cursor:pointer;">
        <td>${NH.escapeHtml(name)}</td>
        <td class="muted">${NH.escapeHtml(u.discord_username)}</td>
        <td class="muted">${NH.escapeHtml(u.job_title || '—')}</td>
        <td class="muted">${NH.escapeHtml(u.role_name || '—')}</td>
        <td><span class="stamp ${NH.USER_STATUS_STAMP_CLASS[u.status]}">${NH.USER_STATUS_LABELS[u.status]}</span></td>
        <td class="muted">${NH.formatDateTime(u.last_login)}</td>
      </tr>`;
    }).join('');
    tbody.querySelectorAll('.row').forEach((row) => row.addEventListener('click', () => openModal(row.dataset.id)));
  } catch (e) { NH.toast(e.message, 'error'); }
}

async function openModal(id) {
  try {
    const data = await NH.get(`/api/users/${id}`);
    const u = data.user;
    document.getElementById('f-id').value = u.id;
    document.getElementById('user-discord-info').textContent = `Pseudo Discord : ${u.discord_username} — ID Discord : ${u.discord_id} — Créé le ${NH.formatDateTime(u.created_at)}`;
    document.getElementById('f-first-name').value = u.character_first_name || '';
    document.getElementById('f-last-name').value = u.character_last_name || '';
    document.getElementById('f-job-title').value = u.job_title || '';
    document.getElementById('f-grade').value = u.grade || '';
    document.getElementById('f-arrival-date').value = u.arrival_date || '';
    document.getElementById('f-role').value = u.role_id || '';
    document.getElementById('f-status').value = u.status;
    document.getElementById('btn-delete').style.display = (currentUser && u.id !== currentUser.id) ? '' : 'none';
    NH.openModal('user-modal');
  } catch (e) { NH.toast(e.message, 'error'); }
}

document.addEventListener('nh:ready', async (evt) => {
  currentUser = evt.detail;
  await loadRoles();
  renderTabs();
  loadUsers();
  const preselect = NH.qs('id');
  if (preselect) openModal(preselect);

  document.getElementById('modal-close').addEventListener('click', () => NH.closeModal('user-modal'));
  document.getElementById('modal-cancel').addEventListener('click', () => NH.closeModal('user-modal'));

  document.getElementById('btn-delete').addEventListener('click', async () => {
    const id = document.getElementById('f-id').value;
    if (!id || !NH.confirmAction('Supprimer ce compte utilisateur ? Ses décrets, communiqués et transactions seront conservés mais détachés de son nom. Cette action est irréversible.')) return;
    try {
      await NH.del(`/api/users/${id}`);
      NH.toast('Compte supprimé.');
      NH.closeModal('user-modal');
      loadUsers();
    } catch (e) { NH.toast(e.message, 'error'); }
  });

  document.getElementById('user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('f-id').value;
    try {
      await NH.patch(`/api/users/${id}`, {
        status: document.getElementById('f-status').value,
        role_id: document.getElementById('f-role').value ? Number(document.getElementById('f-role').value) : null,
        character_first_name: document.getElementById('f-first-name').value,
        character_last_name: document.getElementById('f-last-name').value,
        job_title: document.getElementById('f-job-title').value,
        grade: document.getElementById('f-grade').value,
        arrival_date: document.getElementById('f-arrival-date').value || null,
      });
      NH.toast('Utilisateur mis à jour.');
      NH.closeModal('user-modal');
      loadUsers();
    } catch (e2) { NH.toast(e2.message, 'error'); }
  });
});
