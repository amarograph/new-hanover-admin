const ENT_TABS = [
  { key: '', label: 'Toutes' },
  { key: 'active', label: 'Actives' },
  { key: 'en_attente_autorisation', label: "En attente d'autorisation" },
  { key: 'suspendue', label: 'Suspendues' },
  { key: 'fermee', label: 'Fermées' },
  { key: 'archivee', label: 'Archivées' },
];

const entState = { status: '', q: '' };
let currentUser = null;

function ownerName(first, last, fallback) {
  const name = `${first || ''} ${last || ''}`.trim();
  return name || fallback;
}

async function loadItems() {
  const params = new URLSearchParams();
  if (entState.status) params.set('status', entState.status);
  if (entState.q) params.set('q', entState.q);
  try {
    const data = await NH.get(`/api/entreprises?${params.toString()}`);
    const tbody = document.getElementById('table-body');
    document.getElementById('table-empty').style.display = data.entreprises.length ? 'none' : '';
    tbody.innerHTML = data.entreprises.map((e) => `
      <tr class="row" data-id="${e.id}" style="cursor:pointer;">
        <td>${NH.escapeHtml(e.number || '—')}</td>
        <td>${NH.escapeHtml(e.name)}</td>
        <td class="muted">${NH.escapeHtml(e.activity || '—')}</td>
        <td class="muted">${NH.escapeHtml(ownerName(e.owner_first_name, e.owner_last_name, '—'))}</td>
        <td class="text-right">${NH.formatMoney(e.balance)}</td>
        <td><span class="stamp ${NH.ENTREPRISE_STATUS_STAMP_CLASS[e.status] || 'stamp-neutral'}">${NH.ENTREPRISE_STATUS_LABELS[e.status] || e.status}</span></td>
      </tr>`).join('');
    tbody.querySelectorAll('.row').forEach((row) => row.addEventListener('click', () => openModal(row.dataset.id)));
  } catch (e) { NH.toast(e.message, 'error'); }
}

function renderTabs() {
  const tabs = document.getElementById('status-tabs');
  tabs.innerHTML = ENT_TABS.map((t) => `<div class="tab ${entState.status === t.key ? 'active' : ''}" data-key="${t.key}">${t.label}</div>`).join('');
  tabs.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
    entState.status = tab.dataset.key; renderTabs(); loadItems();
  }));
}

function fillForm(item) {
  document.getElementById('f-id').value = item.id || '';
  document.getElementById('f-name').value = item.name || '';
  document.getElementById('f-activity').value = item.activity || '';
  document.getElementById('f-license').value = item.license || '';
  document.getElementById('f-address').value = item.address || '';
  document.getElementById('f-owner-first').value = item.owner_first_name || '';
  document.getElementById('f-owner-last').value = item.owner_last_name || '';
  document.getElementById('f-co-owner-first').value = item.co_owner_first_name || '';
  document.getElementById('f-co-owner-last').value = item.co_owner_last_name || '';
  document.getElementById('f-account-number').value = item.account_number || '';
  document.getElementById('f-balance').value = item.balance || 0;
  document.getElementById('f-notes').value = item.notes || '';

  document.getElementById('item-meta').textContent = item.id
    ? `${item.number || ''} — Enregistrée par ${item.author_name || '—'}`
    : '';
  document.getElementById('modal-title').textContent = item.id ? 'Fiche entreprise' : 'Nouvelle entreprise';

  const canEdit = item.id ? NH.hasPermission(currentUser, 'entreprises', 'edit') : NH.hasPermission(currentUser, 'entreprises', 'add');
  document.getElementById('save-btn').style.display = canEdit ? '' : 'none';
  document.querySelectorAll('#item-form input, #item-form textarea').forEach((el) => { el.disabled = !canEdit; });

  const statusField = document.getElementById('status-field');
  const statusSelect = document.getElementById('f-status');
  if (item.id && canEdit) {
    statusField.style.display = '';
    statusSelect.value = item.status;
  } else {
    statusField.style.display = 'none';
  }

  const canDelete = !!item.id && NH.hasPermission(currentUser, 'entreprises', 'delete');
  document.getElementById('btn-delete').style.display = canDelete ? '' : 'none';
}

async function openModal(id) {
  if (id) {
    try { const data = await NH.get(`/api/entreprises/${id}`); fillForm(data.entreprise); }
    catch (e) { NH.toast(e.message, 'error'); return; }
  } else { fillForm({}); }
  NH.openModal('item-modal');
}

document.addEventListener('nh:ready', (evt) => {
  currentUser = evt.detail;
  renderTabs();
  loadItems();

  document.getElementById('btn-new').addEventListener('click', () => {
    if (!NH.hasPermission(currentUser, 'entreprises', 'add')) { NH.toast('Permission refusée.', 'error'); return; }
    openModal(null);
  });
  document.getElementById('modal-close').addEventListener('click', () => NH.closeModal('item-modal'));
  document.getElementById('modal-cancel').addEventListener('click', () => NH.closeModal('item-modal'));

  document.getElementById('btn-delete').addEventListener('click', async () => {
    const id = document.getElementById('f-id').value;
    if (!id || !NH.confirmAction('Supprimer cette entreprise ? Cette action est irréversible.')) return;
    try {
      await NH.del(`/api/entreprises/${id}`);
      NH.toast('Entreprise supprimée.');
      NH.closeModal('item-modal');
      loadItems();
    } catch (e) { NH.toast(e.message, 'error'); }
  });

  let searchTimer;
  document.getElementById('filter-q').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { entState.q = e.target.value.trim(); loadItems(); }, 300);
  });

  document.getElementById('item-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('f-id').value;
    const payload = {
      name: document.getElementById('f-name').value,
      activity: document.getElementById('f-activity').value,
      license: document.getElementById('f-license').value,
      address: document.getElementById('f-address').value,
      owner_first_name: document.getElementById('f-owner-first').value,
      owner_last_name: document.getElementById('f-owner-last').value,
      co_owner_first_name: document.getElementById('f-co-owner-first').value,
      co_owner_last_name: document.getElementById('f-co-owner-last').value,
      account_number: document.getElementById('f-account-number').value,
      balance: document.getElementById('f-balance').value,
      notes: document.getElementById('f-notes').value,
    };
    try {
      if (id) { await NH.put(`/api/entreprises/${id}`, payload); NH.toast('Entreprise mise à jour.'); }
      else { await NH.post('/api/entreprises', payload); NH.toast('Entreprise créée.'); }
      NH.closeModal('item-modal');
      loadItems();
    } catch (e2) { NH.toast(e2.message, 'error'); }
  });

  document.getElementById('f-status').addEventListener('change', async (e) => {
    const id = document.getElementById('f-id').value;
    if (!id) return;
    try {
      await NH.patch(`/api/entreprises/${id}`, { status: e.target.value });
      NH.toast('Statut mis à jour.');
      loadItems();
    } catch (err) { NH.toast(err.message, 'error'); }
  });

  const preselect = NH.qs('id');
  if (preselect) openModal(preselect);
  if (NH.qs('new') === '1' && NH.hasPermission(currentUser, 'entreprises', 'add')) openModal(null);
});
