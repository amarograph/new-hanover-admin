const INV_TABS = [
  { key: '', label: 'Toutes' },
  { key: 'documents', label: 'Documents' },
  { key: 'materiel_administratif', label: 'Matériel administratif' },
  { key: 'armes', label: 'Armes' },
  { key: 'munitions', label: 'Munitions' },
  { key: 'fournitures', label: 'Fournitures' },
  { key: 'objets_saisis', label: 'Objets saisis' },
  { key: 'objets_valeur', label: 'Objets de valeur' },
  { key: 'materiel_evenementiel', label: 'Matériel événementiel' },
];

const invState = { category: '', q: '' };
let currentUser = null;

async function loadItems() {
  const params = new URLSearchParams();
  if (invState.category) params.set('category', invState.category);
  if (invState.q) params.set('q', invState.q);
  try {
    const data = await NH.get(`/api/inventaire?${params.toString()}`);
    const tbody = document.getElementById('table-body');
    document.getElementById('table-empty').style.display = data.inventaire.length ? 'none' : '';
    tbody.innerHTML = data.inventaire.map((i) => {
      const low = i.threshold > 0 && i.quantity <= i.threshold;
      return `<tr class="row ${low ? 'low-stock' : ''}" data-id="${i.id}" style="cursor:pointer;">
        <td>${NH.escapeHtml(i.number || '—')}</td>
        <td>${NH.escapeHtml(i.name)}</td>
        <td class="muted">${NH.INV_CATEGORY_LABELS[i.category] || i.category}</td>
        <td class="text-right">${i.quantity}</td>
        <td class="text-right muted">${i.threshold}${low ? ' <span class="stamp stamp-red" style="margin-left:0.3rem;">Sous le seuil</span>' : ''}</td>
      </tr>`;
    }).join('');
    tbody.querySelectorAll('.row').forEach((row) => row.addEventListener('click', () => openModal(row.dataset.id)));
  } catch (e) { NH.toast(e.message, 'error'); }
}

function renderTabs() {
  const tabs = document.getElementById('category-tabs');
  tabs.innerHTML = INV_TABS.map((t) => `<div class="tab ${invState.category === t.key ? 'active' : ''}" data-key="${t.key}">${t.label}</div>`).join('');
  tabs.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
    invState.category = tab.dataset.key; renderTabs(); loadItems();
  }));
}

function fillForm(item) {
  document.getElementById('f-id').value = item.id || '';
  document.getElementById('f-name').value = item.name || '';
  document.getElementById('f-category').value = item.category || 'documents';
  document.getElementById('f-quantity').value = item.quantity || 0;
  document.getElementById('f-threshold').value = item.threshold || 0;
  document.getElementById('f-notes').value = item.notes || '';

  document.getElementById('item-meta').textContent = item.id
    ? `${item.number || ''} — Ajouté par ${item.author_name || '—'}`
    : '';
  document.getElementById('modal-title').textContent = item.id ? 'Fiche objet' : 'Nouvel objet';

  const canEdit = item.id ? NH.hasPermission(currentUser, 'inventaire', 'edit') : NH.hasPermission(currentUser, 'inventaire', 'add');
  document.getElementById('save-btn').style.display = canEdit ? '' : 'none';
  document.querySelectorAll('#item-form input, #item-form select, #item-form textarea').forEach((el) => { el.disabled = !canEdit; });

  const canDelete = !!item.id && NH.hasPermission(currentUser, 'inventaire', 'delete');
  document.getElementById('btn-delete').style.display = canDelete ? '' : 'none';
}

async function openModal(id) {
  if (id) {
    try { const data = await NH.get(`/api/inventaire/${id}`); fillForm(data.item); }
    catch (e) { NH.toast(e.message, 'error'); return; }
  } else { fillForm({}); }
  NH.openModal('item-modal');
}

document.addEventListener('nh:ready', (evt) => {
  currentUser = evt.detail;
  renderTabs();
  loadItems();

  document.getElementById('btn-new').addEventListener('click', () => {
    if (!NH.hasPermission(currentUser, 'inventaire', 'add')) { NH.toast('Permission refusée.', 'error'); return; }
    openModal(null);
  });
  document.getElementById('modal-close').addEventListener('click', () => NH.closeModal('item-modal'));
  document.getElementById('modal-cancel').addEventListener('click', () => NH.closeModal('item-modal'));

  document.getElementById('btn-delete').addEventListener('click', async () => {
    const id = document.getElementById('f-id').value;
    if (!id || !NH.confirmAction('Supprimer cet objet de l\'inventaire ? Cette action est irréversible.')) return;
    try {
      await NH.del(`/api/inventaire/${id}`);
      NH.toast('Objet supprimé.');
      NH.closeModal('item-modal');
      loadItems();
    } catch (e) { NH.toast(e.message, 'error'); }
  });

  let searchTimer;
  document.getElementById('filter-q').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { invState.q = e.target.value.trim(); loadItems(); }, 300);
  });

  document.getElementById('item-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('f-id').value;
    const payload = {
      name: document.getElementById('f-name').value,
      category: document.getElementById('f-category').value,
      quantity: document.getElementById('f-quantity').value,
      threshold: document.getElementById('f-threshold').value,
      notes: document.getElementById('f-notes').value,
    };
    try {
      if (id) { await NH.put(`/api/inventaire/${id}`, payload); NH.toast('Objet mis à jour.'); }
      else { await NH.post('/api/inventaire', payload); NH.toast('Objet ajouté.'); }
      NH.closeModal('item-modal');
      loadItems();
    } catch (e2) { NH.toast(e2.message, 'error'); }
  });

  const preselect = NH.qs('id');
  if (preselect) openModal(preselect);
  if (NH.qs('new') === '1' && NH.hasPermission(currentUser, 'inventaire', 'add')) openModal(null);
});
