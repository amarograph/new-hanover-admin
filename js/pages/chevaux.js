const CHEVAL_TABS = [
  { key: '', label: 'Tous' },
  { key: 'actif', label: 'Actifs' },
  { key: 'vendu', label: 'Vendus' },
  { key: 'perdu', label: 'Perdus' },
  { key: 'vole', label: 'Volés' },
  { key: 'retrouve', label: 'Retrouvés' },
  { key: 'decede', label: 'Décédés' },
  { key: 'saisi', label: 'Saisis' },
  { key: 'archive', label: 'Archivés' },
];

const chevalState = { status: '', q: '' };
let currentUser = null;

function ownerName(first, last) {
  const name = `${first || ''} ${last || ''}`.trim();
  return name || '—';
}

async function loadItems() {
  const params = new URLSearchParams();
  if (chevalState.status) params.set('status', chevalState.status);
  if (chevalState.q) params.set('q', chevalState.q);
  try {
    const data = await NH.get(`/api/chevaux?${params.toString()}`);
    const tbody = document.getElementById('table-body');
    document.getElementById('table-empty').style.display = data.chevaux.length ? 'none' : '';
    tbody.innerHTML = data.chevaux.map((c) => `
      <tr class="row ${c.status === 'vole' ? 'stolen' : ''}" data-id="${c.id}" style="cursor:pointer;">
        <td>${NH.escapeHtml(c.number || '—')}</td>
        <td>${NH.escapeHtml(c.name || '—')}</td>
        <td class="muted">${NH.escapeHtml(c.race || '—')}</td>
        <td class="muted">${NH.escapeHtml(c.robe || '—')}</td>
        <td class="muted">${NH.escapeHtml(ownerName(c.owner_first_name, c.owner_last_name))}</td>
        <td><span class="stamp ${NH.CHEVAL_STATUS_STAMP_CLASS[c.status] || 'stamp-neutral'}">${NH.CHEVAL_STATUS_LABELS[c.status] || c.status}</span></td>
      </tr>`).join('');
    tbody.querySelectorAll('.row').forEach((row) => row.addEventListener('click', () => openModal(row.dataset.id)));
  } catch (e) { NH.toast(e.message, 'error'); }
}

function renderTabs() {
  const tabs = document.getElementById('status-tabs');
  tabs.innerHTML = CHEVAL_TABS.map((t) => `<div class="tab ${chevalState.status === t.key ? 'active' : ''}" data-key="${t.key}">${t.label}</div>`).join('');
  tabs.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
    chevalState.status = tab.dataset.key; renderTabs(); loadItems();
  }));
}

function fillForm(item) {
  document.getElementById('f-id').value = item.id || '';
  document.getElementById('f-name').value = item.name || '';
  document.getElementById('f-race').value = item.race || '';
  document.getElementById('f-robe').value = item.robe || '';
  document.getElementById('f-sexe').value = item.sexe || '';
  document.getElementById('f-age').value = item.age || '';
  document.getElementById('f-ecurie').value = item.ecurie || '';
  document.getElementById('f-signes').value = item.signes_distinctifs || '';
  document.getElementById('f-owner-first').value = item.owner_first_name || '';
  document.getElementById('f-owner-last').value = item.owner_last_name || '';
  document.getElementById('f-status').value = item.status || 'actif';
  document.getElementById('f-notes').value = item.notes || '';

  document.getElementById('item-meta').textContent = item.id
    ? `${item.number || ''} — Enregistré par ${item.author_name || '—'}`
    : '';
  document.getElementById('modal-title').textContent = item.id ? 'Fiche cheval' : 'Nouveau cheval';

  const canEdit = item.id ? NH.hasPermission(currentUser, 'chevaux', 'edit') : NH.hasPermission(currentUser, 'chevaux', 'add');
  document.getElementById('save-btn').style.display = canEdit ? '' : 'none';
  document.querySelectorAll('#item-form input, #item-form select, #item-form textarea').forEach((el) => { el.disabled = !canEdit; });

  const canDelete = !!item.id && NH.hasPermission(currentUser, 'chevaux', 'delete');
  document.getElementById('btn-delete').style.display = canDelete ? '' : 'none';
}

async function openModal(id) {
  if (id) {
    try { const data = await NH.get(`/api/chevaux/${id}`); fillForm(data.cheval); }
    catch (e) { NH.toast(e.message, 'error'); return; }
  } else { fillForm({}); }
  NH.openModal('item-modal');
}

document.addEventListener('nh:ready', (evt) => {
  currentUser = evt.detail;
  renderTabs();
  loadItems();

  document.getElementById('btn-new').addEventListener('click', () => {
    if (!NH.hasPermission(currentUser, 'chevaux', 'add')) { NH.toast('Permission refusée.', 'error'); return; }
    openModal(null);
  });
  document.getElementById('modal-close').addEventListener('click', () => NH.closeModal('item-modal'));
  document.getElementById('modal-cancel').addEventListener('click', () => NH.closeModal('item-modal'));

  document.getElementById('btn-delete').addEventListener('click', async () => {
    const id = document.getElementById('f-id').value;
    if (!id || !NH.confirmAction('Supprimer cette fiche cheval ? Cette action est irréversible.')) return;
    try {
      await NH.del(`/api/chevaux/${id}`);
      NH.toast('Fiche cheval supprimée.');
      NH.closeModal('item-modal');
      loadItems();
    } catch (e) { NH.toast(e.message, 'error'); }
  });

  let searchTimer;
  document.getElementById('filter-q').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { chevalState.q = e.target.value.trim(); loadItems(); }, 300);
  });

  document.getElementById('item-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('f-id').value;
    const payload = {
      name: document.getElementById('f-name').value,
      race: document.getElementById('f-race').value,
      robe: document.getElementById('f-robe').value,
      sexe: document.getElementById('f-sexe').value,
      age: document.getElementById('f-age').value,
      ecurie: document.getElementById('f-ecurie').value,
      signes_distinctifs: document.getElementById('f-signes').value,
      owner_first_name: document.getElementById('f-owner-first').value,
      owner_last_name: document.getElementById('f-owner-last').value,
      status: document.getElementById('f-status').value,
      notes: document.getElementById('f-notes').value,
    };
    try {
      if (id) { await NH.put(`/api/chevaux/${id}`, payload); NH.toast('Fiche cheval mise à jour.'); }
      else { await NH.post('/api/chevaux', payload); NH.toast('Cheval enregistré.'); }
      NH.closeModal('item-modal');
      loadItems();
    } catch (e2) { NH.toast(e2.message, 'error'); }
  });

  const preselect = NH.qs('id');
  if (preselect) openModal(preselect);
  if (NH.qs('new') === '1' && NH.hasPermission(currentUser, 'chevaux', 'add')) openModal(null);
});
