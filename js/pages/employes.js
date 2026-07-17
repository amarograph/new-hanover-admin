let empState = { q: '' };
let currentUser = null;

async function loadItems() {
  const params = new URLSearchParams();
  if (empState.q) params.set('q', empState.q);
  try {
    const data = await NH.get(`/api/employes?${params.toString()}`);
    const tbody = document.getElementById('table-body');
    document.getElementById('table-empty').style.display = data.employes.length ? 'none' : '';
    tbody.innerHTML = data.employes.map((p) => `
      <tr class="row" data-id="${p.id}" style="cursor:pointer;">
        <td>${NH.escapeHtml(p.number || '—')}</td>
        <td>${NH.escapeHtml(p.last_name)}</td>
        <td>${NH.escapeHtml(p.first_name)}</td>
        <td class="muted">${NH.escapeHtml(p.job_title || '—')}</td>
        <td class="muted">${NH.escapeHtml(p.residence || '—')}</td>
      </tr>`).join('');
    tbody.querySelectorAll('.row').forEach((row) => row.addEventListener('click', () => openModal(row.dataset.id)));
  } catch (e) { NH.toast(e.message, 'error'); }
}

function fillForm(item) {
  document.getElementById('f-id').value = item.id || '';
  document.getElementById('f-first-name').value = item.first_name || '';
  document.getElementById('f-last-name').value = item.last_name || '';
  document.getElementById('f-birth-date').value = item.birth_date || '';
  document.getElementById('f-job-title').value = item.job_title || '';
  document.getElementById('f-residence').value = item.residence || '';
  document.getElementById('f-account-number').value = item.account_number || '';

  document.getElementById('item-meta').textContent = item.id
    ? `${item.number || ''} — Enregistré par ${item.author_name || '—'}`
    : '';
  document.getElementById('modal-title').textContent = item.id ? 'Fiche employé' : 'Nouvel employé';

  const canEdit = item.id ? NH.hasPermission(currentUser, 'employes', 'edit') : NH.hasPermission(currentUser, 'employes', 'add');
  document.getElementById('save-btn').style.display = canEdit ? '' : 'none';
  document.querySelectorAll('#item-form input').forEach((el) => { el.disabled = !canEdit; });

  const canDelete = !!item.id && NH.hasPermission(currentUser, 'employes', 'delete');
  document.getElementById('btn-delete').style.display = canDelete ? '' : 'none';
}

async function openModal(id) {
  if (id) {
    try { const data = await NH.get(`/api/employes/${id}`); fillForm(data.employe); }
    catch (e) { NH.toast(e.message, 'error'); return; }
  } else { fillForm({}); }
  NH.openModal('item-modal');
}

document.addEventListener('nh:ready', (evt) => {
  currentUser = evt.detail;
  loadItems();

  document.getElementById('btn-new').addEventListener('click', () => {
    if (!NH.hasPermission(currentUser, 'employes', 'add')) { NH.toast('Permission refusée.', 'error'); return; }
    openModal(null);
  });
  document.getElementById('modal-close').addEventListener('click', () => NH.closeModal('item-modal'));
  document.getElementById('modal-cancel').addEventListener('click', () => NH.closeModal('item-modal'));

  document.getElementById('btn-delete').addEventListener('click', async () => {
    const id = document.getElementById('f-id').value;
    if (!id || !NH.confirmAction('Supprimer cette fiche employé ? Cette action est irréversible.')) return;
    try {
      await NH.del(`/api/employes/${id}`);
      NH.toast('Fiche employé supprimée.');
      NH.closeModal('item-modal');
      loadItems();
    } catch (e) { NH.toast(e.message, 'error'); }
  });

  let searchTimer;
  document.getElementById('filter-q').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { empState.q = e.target.value.trim(); loadItems(); }, 300);
  });

  document.getElementById('item-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('f-id').value;
    const payload = {
      first_name: document.getElementById('f-first-name').value,
      last_name: document.getElementById('f-last-name').value,
      birth_date: document.getElementById('f-birth-date').value || null,
      job_title: document.getElementById('f-job-title').value,
      residence: document.getElementById('f-residence').value,
      account_number: document.getElementById('f-account-number').value,
    };
    try {
      if (id) { await NH.put(`/api/employes/${id}`, payload); NH.toast('Fiche employé mise à jour.'); }
      else { await NH.post('/api/employes', payload); NH.toast('Fiche employé créée.'); }
      NH.closeModal('item-modal');
      loadItems();
    } catch (e2) { NH.toast(e2.message, 'error'); }
  });

  const preselect = NH.qs('id');
  if (preselect) openModal(preselect);
  if (NH.qs('new') === '1' && NH.hasPermission(currentUser, 'employes', 'add')) openModal(null);
});
