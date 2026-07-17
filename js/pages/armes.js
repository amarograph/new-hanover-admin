const ARME_TABS = [
  { key: '', label: 'Toutes' },
  { key: 'legale', label: 'Légales' },
  { key: 'illegale', label: 'Illégales' },
  { key: 'non_connu', label: 'Non connu' },
];

const armeState = { category: '', q: '' };
let currentUser = null;

function ownerName(first, last) {
  const name = `${first || ''} ${last || ''}`.trim();
  return name || '—';
}

async function loadItems() {
  const params = new URLSearchParams();
  if (armeState.category) params.set('category', armeState.category);
  if (armeState.q) params.set('q', armeState.q);
  try {
    const data = await NH.get(`/api/armes?${params.toString()}`);
    const tbody = document.getElementById('table-body');
    document.getElementById('table-empty').style.display = data.armes.length ? 'none' : '';
    tbody.innerHTML = data.armes.map((a) => `
      <tr class="row ${a.stolen ? 'stolen' : ''}" data-id="${a.id}" style="cursor:pointer;">
        <td>${NH.escapeHtml(a.number || '—')}</td>
        <td>${NH.escapeHtml(a.type || '—')}</td>
        <td class="muted">${NH.escapeHtml(a.model || '—')}</td>
        <td class="muted">${NH.escapeHtml(a.serial_number || '—')}</td>
        <td class="muted">${NH.escapeHtml(ownerName(a.owner_first_name, a.owner_last_name))}</td>
        <td>
          <span class="stamp ${NH.ARME_CATEGORY_STAMP_CLASS[a.category] || 'stamp-neutral'}">${NH.ARME_CATEGORY_LABELS[a.category] || a.category}</span>
          ${a.stolen ? '<span class="stamp stamp-red" style="margin-left:0.3rem;">Volée</span>' : ''}
        </td>
      </tr>`).join('');
    tbody.querySelectorAll('.row').forEach((row) => row.addEventListener('click', () => openModal(row.dataset.id)));
  } catch (e) { NH.toast(e.message, 'error'); }
}

function renderTabs() {
  const tabs = document.getElementById('category-tabs');
  tabs.innerHTML = ARME_TABS.map((t) => `<div class="tab ${armeState.category === t.key ? 'active' : ''}" data-key="${t.key}">${t.label}</div>`).join('');
  tabs.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
    armeState.category = tab.dataset.key; renderTabs(); loadItems();
  }));
}

function fillForm(item) {
  document.getElementById('f-id').value = item.id || '';
  document.getElementById('f-type').value = item.type || '';
  document.getElementById('f-model').value = item.model || '';
  document.getElementById('f-serial').value = item.serial_number || '';
  document.getElementById('f-owner-first').value = item.owner_first_name || '';
  document.getElementById('f-owner-last').value = item.owner_last_name || '';
  document.getElementById('f-category').value = item.category || 'non_connu';
  document.getElementById('f-stolen').checked = !!item.stolen;
  document.getElementById('f-notes').value = item.notes || '';

  document.getElementById('item-meta').textContent = item.id
    ? `${item.number || ''} — Enregistrée par ${item.author_name || '—'}`
    : '';
  document.getElementById('modal-title').textContent = item.id ? 'Fiche arme' : 'Nouvelle arme';

  const canEdit = item.id ? NH.hasPermission(currentUser, 'armes', 'edit') : NH.hasPermission(currentUser, 'armes', 'add');
  document.getElementById('save-btn').style.display = canEdit ? '' : 'none';
  document.querySelectorAll('#item-form input, #item-form select, #item-form textarea').forEach((el) => { el.disabled = !canEdit; });

  const canDelete = !!item.id && NH.hasPermission(currentUser, 'armes', 'delete');
  document.getElementById('btn-delete').style.display = canDelete ? '' : 'none';
}

async function openModal(id) {
  if (id) {
    try { const data = await NH.get(`/api/armes/${id}`); fillForm(data.arme); }
    catch (e) { NH.toast(e.message, 'error'); return; }
  } else { fillForm({}); }
  NH.openModal('item-modal');
}

document.addEventListener('nh:ready', (evt) => {
  currentUser = evt.detail;
  renderTabs();
  loadItems();

  document.getElementById('btn-new').addEventListener('click', () => {
    if (!NH.hasPermission(currentUser, 'armes', 'add')) { NH.toast('Permission refusée.', 'error'); return; }
    openModal(null);
  });
  document.getElementById('modal-close').addEventListener('click', () => NH.closeModal('item-modal'));
  document.getElementById('modal-cancel').addEventListener('click', () => NH.closeModal('item-modal'));

  document.getElementById('btn-delete').addEventListener('click', async () => {
    const id = document.getElementById('f-id').value;
    if (!id || !NH.confirmAction('Supprimer cette fiche arme ? Cette action est irréversible.')) return;
    try {
      await NH.del(`/api/armes/${id}`);
      NH.toast('Fiche arme supprimée.');
      NH.closeModal('item-modal');
      loadItems();
    } catch (e) { NH.toast(e.message, 'error'); }
  });

  let searchTimer;
  document.getElementById('filter-q').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { armeState.q = e.target.value.trim(); loadItems(); }, 300);
  });

  document.getElementById('item-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('f-id').value;
    const payload = {
      type: document.getElementById('f-type').value,
      model: document.getElementById('f-model').value,
      serial_number: document.getElementById('f-serial').value,
      owner_first_name: document.getElementById('f-owner-first').value,
      owner_last_name: document.getElementById('f-owner-last').value,
      category: document.getElementById('f-category').value,
      stolen: document.getElementById('f-stolen').checked,
      notes: document.getElementById('f-notes').value,
    };
    try {
      if (id) { await NH.put(`/api/armes/${id}`, payload); NH.toast('Fiche arme mise à jour.'); }
      else { await NH.post('/api/armes', payload); NH.toast('Arme enregistrée.'); }
      NH.closeModal('item-modal');
      loadItems();
    } catch (e2) { NH.toast(e2.message, 'error'); }
  });

  const preselect = NH.qs('id');
  if (preselect) openModal(preselect);
  if (NH.qs('new') === '1' && NH.hasPermission(currentUser, 'armes', 'add')) openModal(null);
});
