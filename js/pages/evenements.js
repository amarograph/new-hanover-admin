const EVT_TABS = [
  { key: '', label: 'Toutes' },
  { key: 'idee', label: 'Idées' },
  { key: 'a_preparer', label: 'À préparer' },
  { key: 'en_organisation', label: 'En organisation' },
  { key: 'en_attente_validation', label: 'En attente de validation' },
  { key: 'confirme', label: 'Confirmés' },
  { key: 'termine', label: 'Terminés' },
  { key: 'annule', label: 'Annulés' },
  { key: 'archive', label: 'Archives' },
];

const evtState = { status: '', q: '' };
let currentUser = null;

async function loadItems() {
  const params = new URLSearchParams();
  if (evtState.status) params.set('status', evtState.status);
  if (evtState.q) params.set('q', evtState.q);
  try {
    const data = await NH.get(`/api/evenements?${params.toString()}`);
    const tbody = document.getElementById('table-body');
    document.getElementById('table-empty').style.display = data.evenements.length ? 'none' : '';
    tbody.innerHTML = data.evenements.map((e) => `
      <tr class="row" data-id="${e.id}" style="cursor:pointer;">
        <td>${NH.escapeHtml(e.number || '—')}</td>
        <td>${NH.escapeHtml(e.title)}</td>
        <td class="muted">${e.date ? NH.formatDate(e.date) : '—'}</td>
        <td class="text-right">${NH.formatMoney(e.budget_prevu)}</td>
        <td class="text-right">${NH.formatMoney(e.depenses_reelles)}</td>
        <td><span class="stamp ${NH.EVT_STATUS_STAMP_CLASS[e.status] || 'stamp-neutral'}">${NH.EVT_STATUS_LABELS[e.status] || e.status}</span></td>
      </tr>`).join('');
    tbody.querySelectorAll('.row').forEach((row) => row.addEventListener('click', () => openModal(row.dataset.id)));
  } catch (e) { NH.toast(e.message, 'error'); }
}

function renderTabs() {
  const tabs = document.getElementById('status-tabs');
  tabs.innerHTML = EVT_TABS.map((t) => `<div class="tab ${evtState.status === t.key ? 'active' : ''}" data-key="${t.key}">${t.label}</div>`).join('');
  tabs.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
    evtState.status = tab.dataset.key; renderTabs(); loadItems();
  }));
}

function fillForm(item) {
  document.getElementById('f-id').value = item.id || '';
  document.getElementById('f-title').value = item.title || '';
  document.getElementById('f-date').value = item.date || '';
  document.getElementById('f-description').value = item.description || '';
  document.getElementById('f-budget').value = item.budget_prevu || 0;
  document.getElementById('f-depenses').value = item.depenses_reelles || 0;
  document.getElementById('f-notes').value = item.notes || '';

  document.getElementById('item-meta').textContent = item.id
    ? `${item.number || ''} — Créé par ${item.author_name || '—'}`
    : '';
  document.getElementById('modal-title').textContent = item.id ? 'Événement' : 'Nouvel événement';

  const canEdit = item.id ? NH.hasPermission(currentUser, 'evenements', 'edit') : NH.hasPermission(currentUser, 'evenements', 'add');
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

  const canDelete = !!item.id && NH.hasPermission(currentUser, 'evenements', 'delete');
  document.getElementById('btn-delete').style.display = canDelete ? '' : 'none';
}

async function openModal(id) {
  if (id) {
    try { const data = await NH.get(`/api/evenements/${id}`); fillForm(data.evenement); }
    catch (e) { NH.toast(e.message, 'error'); return; }
  } else { fillForm({}); }
  NH.openModal('item-modal');
}

document.addEventListener('nh:ready', (evt) => {
  currentUser = evt.detail;
  renderTabs();
  loadItems();

  document.getElementById('btn-new').addEventListener('click', () => {
    if (!NH.hasPermission(currentUser, 'evenements', 'add')) { NH.toast('Permission refusée.', 'error'); return; }
    openModal(null);
  });
  document.getElementById('modal-close').addEventListener('click', () => NH.closeModal('item-modal'));
  document.getElementById('modal-cancel').addEventListener('click', () => NH.closeModal('item-modal'));

  document.getElementById('f-status').addEventListener('change', async (e) => {
    const id = document.getElementById('f-id').value;
    if (!id) return;
    try {
      await NH.patch(`/api/evenements/${id}`, { status: e.target.value });
      NH.toast('Statut mis à jour.');
      loadItems();
    } catch (err) { NH.toast(err.message, 'error'); }
  });

  document.getElementById('btn-delete').addEventListener('click', async () => {
    const id = document.getElementById('f-id').value;
    if (!id || !NH.confirmAction('Supprimer cet événement ? Cette action est irréversible.')) return;
    try {
      await NH.del(`/api/evenements/${id}`);
      NH.toast('Événement supprimé.');
      NH.closeModal('item-modal');
      loadItems();
    } catch (e) { NH.toast(e.message, 'error'); }
  });

  let searchTimer;
  document.getElementById('filter-q').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { evtState.q = e.target.value.trim(); loadItems(); }, 300);
  });

  document.getElementById('item-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('f-id').value;
    const payload = {
      title: document.getElementById('f-title').value,
      date: document.getElementById('f-date').value || null,
      description: document.getElementById('f-description').value,
      budget_prevu: document.getElementById('f-budget').value,
      depenses_reelles: document.getElementById('f-depenses').value,
      notes: document.getElementById('f-notes').value,
    };
    try {
      if (id) { await NH.put(`/api/evenements/${id}`, payload); NH.toast('Événement mis à jour.'); }
      else { await NH.post('/api/evenements', payload); NH.toast('Événement créé.'); }
      NH.closeModal('item-modal');
      loadItems();
    } catch (e2) { NH.toast(e2.message, 'error'); }
  });

  const preselect = NH.qs('id');
  if (preselect) openModal(preselect);
  if (NH.qs('new') === '1' && NH.hasPermission(currentUser, 'evenements', 'add')) openModal(null);
});
