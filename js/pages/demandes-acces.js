let rolesCache = [];

async function loadRoles() {
  try {
    const data = await NH.get('/api/roles');
    rolesCache = data.roles;
    document.getElementById('f-role').innerHTML = rolesCache.map((r) => `<option value="${r.id}">${NH.escapeHtml(r.name)}</option>`).join('');
  } catch (e) { NH.toast(e.message, 'error'); }
}

async function loadRequests() {
  try {
    const data = await NH.get('/api/users?status=pending');
    const tbody = document.getElementById('table-body');
    document.getElementById('table-empty').style.display = data.users.length ? 'none' : '';
    tbody.innerHTML = data.users.map((u) => `
      <tr>
        <td>${NH.escapeHtml(u.discord_username)}</td>
        <td class="muted">${NH.escapeHtml(u.discord_id)}</td>
        <td class="muted">${NH.formatDateTime(u.created_at)}</td>
        <td class="text-right">
          <button class="btn btn-outline btn-sm approve-btn" data-id="${u.id}" data-username="${NH.escapeHtml(u.discord_username)}">Accepter</button>
          <button class="btn btn-danger btn-sm refuse-btn" data-id="${u.id}">Refuser</button>
        </td>
      </tr>`).join('');
    tbody.querySelectorAll('.approve-btn').forEach((btn) => btn.addEventListener('click', () => openApproveModal(btn.dataset.id)));
    tbody.querySelectorAll('.refuse-btn').forEach((btn) => btn.addEventListener('click', () => refuseRequest(btn.dataset.id)));
  } catch (e) { NH.toast(e.message, 'error'); }
}

function openApproveModal(id) {
  document.getElementById('f-id').value = id;
  document.getElementById('f-first-name').value = '';
  document.getElementById('f-last-name').value = '';
  document.getElementById('f-job-title').value = '';
  document.getElementById('f-grade').value = '';
  NH.openModal('approve-modal');
}

async function refuseRequest(id) {
  if (!NH.confirmAction("Refuser définitivement cette demande d'accès ?")) return;
  try {
    await NH.patch(`/api/users/${id}`, { status: 'refused' });
    NH.toast('Demande refusée.');
    loadRequests();
  } catch (e) { NH.toast(e.message, 'error'); }
}

document.addEventListener('nh:ready', async () => {
  await loadRoles();
  loadRequests();

  document.getElementById('modal-close').addEventListener('click', () => NH.closeModal('approve-modal'));
  document.getElementById('modal-cancel').addEventListener('click', () => NH.closeModal('approve-modal'));

  document.getElementById('approve-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('f-id').value;
    try {
      await NH.patch(`/api/users/${id}`, {
        status: 'accepted',
        role_id: Number(document.getElementById('f-role').value),
        character_first_name: document.getElementById('f-first-name').value,
        character_last_name: document.getElementById('f-last-name').value,
        job_title: document.getElementById('f-job-title').value,
        grade: document.getElementById('f-grade').value,
      });
      NH.toast('Compte accepté.');
      NH.closeModal('approve-modal');
      loadRequests();
    } catch (e2) { NH.toast(e2.message, 'error'); }
  });
});
