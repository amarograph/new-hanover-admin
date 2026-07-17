const BL_TABS = [
  { key: '', label: 'Tous' },
  { key: 'a_repondre', label: 'À répondre' },
  { key: 'doit_repondre', label: 'Doit répondre' },
  { key: 'repondu', label: 'Répondu' },
];

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
let pendingImage;
let blState = { status: '' };
let currentUser = null;
let assignableUsers = [];

function renderImagePreview(imageDataUrl) {
  const preview = document.getElementById('image-preview');
  if (!imageDataUrl) { preview.innerHTML = ''; return; }
  preview.innerHTML = `
    <img src="${imageDataUrl}" style="max-width:260px; max-height:260px; border-radius:4px; display:block; margin-bottom:0.4rem;">
    <button type="button" class="btn btn-outline btn-sm no-print" id="image-remove">Retirer l'image</button>`;
  document.getElementById('image-remove').addEventListener('click', () => {
    pendingImage = null;
    renderImagePreview(null);
  });
}

function userLabel(u) {
  const name = (u.character_first_name || u.character_last_name) ? `${u.character_first_name || ''} ${u.character_last_name || ''}`.trim() : u.discord_username;
  return name;
}

async function loadAssignableUsers() {
  try {
    const data = await NH.get('/api/boite-lettres?assignable_users=1');
    assignableUsers = data.users;
    document.getElementById('f-assigned').innerHTML = assignableUsers.map((u) => `<option value="${u.id}">${NH.escapeHtml(userLabel(u))}</option>`).join('');
  } catch (e) { /* pas grave si on ne peut pas assigner */ }
}

async function loadItems() {
  const params = new URLSearchParams();
  if (blState.status) params.set('status', blState.status);
  try {
    const data = await NH.get(`/api/boite-lettres?${params.toString()}`);
    const tbody = document.getElementById('table-body');
    document.getElementById('table-empty').style.display = data.boite_lettres.length ? 'none' : '';
    tbody.innerHTML = data.boite_lettres.map((b) => {
      const assigned = (b.assigned_first_name || b.assigned_last_name) ? `${b.assigned_first_name || ''} ${b.assigned_last_name || ''}`.trim() : '—';
      return `<tr class="row" data-id="${b.id}" style="cursor:pointer;">
        <td>${NH.escapeHtml(b.description || '—')}</td>
        <td class="muted">${NH.formatDate(b.created_at)}</td>
        <td><span class="stamp ${NH.BL_STATUS_STAMP_CLASS[b.status] || 'stamp-neutral'}">${NH.BL_STATUS_LABELS[b.status] || b.status}</span></td>
        <td class="muted">${b.status === 'doit_repondre' ? NH.escapeHtml(assigned) : '—'}</td>
      </tr>`;
    }).join('');
    tbody.querySelectorAll('.row').forEach((row) => row.addEventListener('click', () => openModal(row.dataset.id)));
  } catch (e) { NH.toast(e.message, 'error'); }
}

function renderTabs() {
  const tabs = document.getElementById('status-tabs');
  tabs.innerHTML = BL_TABS.map((t) => `<div class="tab ${blState.status === t.key ? 'active' : ''}" data-key="${t.key}">${t.label}</div>`).join('');
  tabs.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
    blState.status = tab.dataset.key; renderTabs(); loadItems();
  }));
}

function toggleAssignedField() {
  const show = document.getElementById('f-status').value === 'doit_repondre';
  document.getElementById('assigned-field').style.display = show ? '' : 'none';
}

function fillForm(item) {
  document.getElementById('f-id').value = item.id || '';
  document.getElementById('f-description').value = item.description || '';
  document.getElementById('f-status').value = item.status || 'a_repondre';
  if (item.assigned_user_id) document.getElementById('f-assigned').value = item.assigned_user_id;
  toggleAssignedField();

  pendingImage = undefined;
  document.getElementById('image-input').value = '';
  renderImagePreview(item.image || null);

  const assigned = (item.assigned_first_name || item.assigned_last_name) ? `${item.assigned_first_name || ''} ${item.assigned_last_name || ''}`.trim() : null;
  document.getElementById('item-meta').textContent = item.id
    ? `Déposé par ${item.author_name || '—'} le ${NH.formatDateTime(item.created_at)}${assigned ? ' — Assigné à ' + assigned : ''}`
    : '';
  document.getElementById('modal-title').textContent = item.id ? 'Courrier' : 'Nouveau courrier';

  const canEdit = item.id ? NH.hasPermission(currentUser, 'boite_lettres', 'edit') : NH.hasPermission(currentUser, 'boite_lettres', 'add');
  document.getElementById('save-btn').style.display = canEdit ? '' : 'none';
  document.querySelectorAll('#item-form input, #item-form select').forEach((el) => { el.disabled = !canEdit; });
  const removeBtn = document.getElementById('image-remove');
  if (removeBtn && !canEdit) removeBtn.style.display = 'none';

  const canDelete = !!item.id && NH.hasPermission(currentUser, 'boite_lettres', 'delete');
  document.getElementById('btn-delete').style.display = canDelete ? '' : 'none';
}

async function openModal(id) {
  if (id) {
    try { const data = await NH.get(`/api/boite-lettres/${id}`); fillForm(data.boite_lettre); }
    catch (e) { NH.toast(e.message, 'error'); return; }
  } else { fillForm({}); }
  NH.openModal('item-modal');
}

document.addEventListener('nh:ready', (evt) => {
  currentUser = evt.detail;
  renderTabs();
  loadItems();
  if (NH.hasPermission(currentUser, 'boite_lettres', 'edit')) loadAssignableUsers();

  document.getElementById('btn-new').addEventListener('click', () => {
    if (!NH.hasPermission(currentUser, 'boite_lettres', 'add')) { NH.toast('Permission refusée.', 'error'); return; }
    openModal(null);
  });
  document.getElementById('modal-close').addEventListener('click', () => NH.closeModal('item-modal'));
  document.getElementById('modal-cancel').addEventListener('click', () => NH.closeModal('item-modal'));
  document.getElementById('f-status').addEventListener('change', toggleAssignedField);

  document.getElementById('image-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      NH.toast('Image trop volumineuse (2 Mo maximum).', 'error');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      pendingImage = reader.result;
      renderImagePreview(pendingImage);
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('btn-delete').addEventListener('click', async () => {
    const id = document.getElementById('f-id').value;
    if (!id || !NH.confirmAction('Supprimer ce courrier de la boîte aux lettres ? Cette action est irréversible.')) return;
    try {
      await NH.del(`/api/boite-lettres/${id}`);
      NH.toast('Courrier supprimé.');
      NH.closeModal('item-modal');
      loadItems();
    } catch (e) { NH.toast(e.message, 'error'); }
  });

  document.getElementById('item-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('f-id').value;
    const status = document.getElementById('f-status').value;
    const assignedUserId = document.getElementById('f-assigned').value;

    try {
      if (id) {
        const payload = { description: document.getElementById('f-description').value };
        if (pendingImage !== undefined) payload.image = pendingImage;
        await NH.put(`/api/boite-lettres/${id}`, payload);
        await NH.patch(`/api/boite-lettres/${id}`, {
          status,
          assigned_user_id: status === 'doit_repondre' ? Number(assignedUserId) : null,
        });
        NH.toast('Courrier mis à jour.');
      } else {
        const payload = {
          description: document.getElementById('f-description').value,
          image: pendingImage,
        };
        const created = await NH.post('/api/boite-lettres', payload);
        if (status !== 'a_repondre') {
          await NH.patch(`/api/boite-lettres/${created.id}`, {
            status,
            assigned_user_id: status === 'doit_repondre' ? Number(assignedUserId) : null,
          });
        }
        NH.toast('Courrier déposé.');
      }
      NH.closeModal('item-modal');
      loadItems();
    } catch (e2) { NH.toast(e2.message, 'error'); }
  });

  const preselect = NH.qs('id');
  if (preselect) openModal(preselect);
  if (NH.qs('new') === '1' && NH.hasPermission(currentUser, 'boite_lettres', 'add')) openModal(null);
});
