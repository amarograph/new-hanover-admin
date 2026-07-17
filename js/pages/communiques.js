const COM_CATEGORIES = [
  { key: '', label: 'Tous' },
  { key: 'a_faire', label: 'À faire' },
  { key: 'en_redaction', label: 'En rédaction' },
  { key: 'en_attente_validation', label: 'En attente de validation' },
  { key: 'a_publier', label: 'À publier' },
  { key: 'publie', label: 'Publiés' },
  { key: 'archive', label: 'Archives' },
];

const comState = { status: '', q: '' };
let currentUser = null;

function comStatusActions(item) {
  const actions = [];
  if (!item.id) return actions;
  const canEdit = NH.hasPermission(currentUser, 'communiques', 'edit');
  const canValidate = NH.hasPermission(currentUser, 'communiques', 'validate');
  const canArchive = NH.hasPermission(currentUser, 'communiques', 'archive');

  if (['a_faire', 'en_redaction'].includes(item.status) && canEdit) actions.push(['Envoyer en validation', 'en_attente_validation']);
  if (item.status === 'en_attente_validation') {
    if (canValidate) actions.push(['Valider (à publier)', 'a_publier']);
    if (canEdit) actions.push(['Refuser (retour en rédaction)', 'en_redaction']);
  }
  if (item.status === 'a_publier' && canValidate) actions.push(['Publier', 'publie']);
  if (item.status === 'publie' && canArchive) actions.push(['Archiver', 'archive']);
  return actions;
}

async function loadItems() {
  const params = new URLSearchParams();
  if (comState.status) params.set('status', comState.status);
  if (comState.q) params.set('q', comState.q);
  try {
    const data = await NH.get(`/api/communiques?${params.toString()}`);
    const tbody = document.getElementById('table-body');
    document.getElementById('table-empty').style.display = data.communiques.length ? 'none' : '';
    tbody.innerHTML = data.communiques.map((c) => `
      <tr class="row" data-id="${c.id}" style="cursor:pointer;">
        <td>${NH.escapeHtml(c.number || '—')}</td>
        <td>${NH.escapeHtml(c.title)}</td>
        <td class="muted">${NH.AUDIENCE_LABELS[c.target_audience] || c.target_audience}</td>
        <td class="muted">${NH.escapeHtml(c.author_name || '—')}</td>
        <td class="muted">${NH.formatDate(c.created_at)}</td>
        <td><span class="stamp ${NH.STATUS_STAMP_CLASS[c.status] || 'stamp-neutral'}">${NH.STATUS_LABELS[c.status] || c.status}</span></td>
      </tr>`).join('');
    tbody.querySelectorAll('.row').forEach((row) => row.addEventListener('click', () => openModal(row.dataset.id)));
  } catch (e) { NH.toast(e.message, 'error'); }
}

function renderTabs() {
  const tabs = document.getElementById('category-tabs');
  tabs.innerHTML = COM_CATEGORIES.map((c) => `<div class="tab ${comState.status === c.key ? 'active' : ''}" data-key="${c.key}">${c.label}</div>`).join('');
  tabs.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
    comState.status = tab.dataset.key; renderTabs(); loadItems();
  }));
}

function fillForm(item) {
  document.getElementById('item-id').value = item.id || '';
  document.getElementById('f-title').value = item.title || '';
  document.getElementById('f-subject').value = item.subject || '';
  document.getElementById('f-audience').value = item.target_audience || 'tous';
  document.getElementById('f-content').value = item.content || '';
  document.getElementById('f-notes').value = item.internal_notes || '';
  const attachments = item.attachments ? JSON.parse(item.attachments) : [];
  document.getElementById('f-attachments').value = attachments.join('\n');

  const meta = document.getElementById('item-meta');
  meta.textContent = item.id
    ? `${item.number || ''} — Auteur : ${item.author_name || '—'} — Statut : ${NH.STATUS_LABELS[item.status] || item.status}${item.published_at ? ' — Publié le ' + NH.formatDate(item.published_at) : ''}`
    : '';

  const statusActions = document.getElementById('status-actions');
  statusActions.innerHTML = '';
  comStatusActions(item).forEach(([label, target]) => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn btn-outline btn-sm'; btn.textContent = label;
    btn.addEventListener('click', async () => {
      try {
        await NH.patch(`/api/communiques/${item.id}`, { status: target });
        NH.toast('Statut mis à jour.');
        NH.closeModal('item-modal');
        loadItems();
      } catch (e) { NH.toast(e.message, 'error'); }
    });
    statusActions.appendChild(btn);
  });

  const canEdit = item.id ? NH.hasPermission(currentUser, 'communiques', 'edit') : NH.hasPermission(currentUser, 'communiques', 'add');
  document.getElementById('save-btn').style.display = canEdit ? '' : 'none';
  document.querySelectorAll('#item-form input, #item-form textarea, #item-form select').forEach((el) => { el.disabled = !canEdit; });
}

async function openModal(id) {
  document.getElementById('modal-title').textContent = id ? 'Communiqué' : 'Nouveau communiqué';
  if (id) {
    try { const data = await NH.get(`/api/communiques/${id}`); fillForm(data.communique); }
    catch (e) { NH.toast(e.message, 'error'); return; }
  } else { fillForm({}); }
  NH.openModal('item-modal');
}

document.addEventListener('nh:ready', (evt) => {
  currentUser = evt.detail;
  renderTabs();
  loadItems();

  document.getElementById('btn-new').addEventListener('click', () => {
    if (!NH.hasPermission(currentUser, 'communiques', 'add')) { NH.toast('Permission refusée.', 'error'); return; }
    openModal(null);
  });
  document.getElementById('modal-close').addEventListener('click', () => NH.closeModal('item-modal'));
  document.getElementById('modal-cancel').addEventListener('click', () => NH.closeModal('item-modal'));

  let searchTimer;
  document.getElementById('filter-q').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { comState.q = e.target.value.trim(); loadItems(); }, 300);
  });

  document.getElementById('item-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('item-id').value;
    const payload = {
      title: document.getElementById('f-title').value,
      subject: document.getElementById('f-subject').value,
      target_audience: document.getElementById('f-audience').value,
      content: document.getElementById('f-content').value,
      internal_notes: document.getElementById('f-notes').value,
      attachments: document.getElementById('f-attachments').value.split('\n').map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (id) { await NH.put(`/api/communiques/${id}`, payload); NH.toast('Communiqué mis à jour.'); }
      else { payload.status = 'a_faire'; await NH.post('/api/communiques', payload); NH.toast('Communiqué créé.'); }
      NH.closeModal('item-modal');
      loadItems();
    } catch (e2) { NH.toast(e2.message, 'error'); }
  });

  if (NH.qs('new') === '1' && NH.hasPermission(currentUser, 'communiques', 'add')) openModal(null);
});
