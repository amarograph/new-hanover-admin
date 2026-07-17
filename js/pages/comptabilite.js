let currentUser = null;
let txCache = [];

const VALIDATION_LABELS = { en_attente: 'En attente', validee: 'Validée', annulee: 'Annulée' };
const VALIDATION_STAMP = { en_attente: 'stamp-gold', validee: 'stamp-green', annulee: 'stamp-red' };

function updateCategoryOptions() {
  const type = document.getElementById('f-type').value;
  const list = type === 'sortie' ? NH.TRANSACTION_CATEGORY_LABELS_OUT : NH.TRANSACTION_CATEGORY_LABELS_IN;
  document.getElementById('category-options').innerHTML = list.map((c) => `<option value="${c}">`).join('');
}

async function loadSummary() {
  try {
    const s = await NH.get('/api/accounting/summary');
    document.getElementById('stat-tiles').innerHTML = `
      <div class="stat-tile ${s.balance >= 0 ? 'positive' : 'negative'}"><div class="stat-label">Solde actuel</div><div class="stat-value">${NH.formatMoney(s.balance)}</div></div>
      <div class="stat-tile positive"><div class="stat-label">Total des entrées</div><div class="stat-value">${NH.formatMoney(s.total_in)}</div></div>
      <div class="stat-tile negative"><div class="stat-label">Total des sorties</div><div class="stat-value">${NH.formatMoney(s.total_out)}</div></div>
      <div class="stat-tile"><div class="stat-label">Revenus du mois</div><div class="stat-value">${NH.formatMoney(s.month_in)}</div></div>
      <div class="stat-tile"><div class="stat-label">Dépenses du mois</div><div class="stat-value">${NH.formatMoney(s.month_out)}</div></div>
      <div class="stat-tile"><div class="stat-label">Transactions en attente</div><div class="stat-value">${s.pending_count}</div></div>
    `;
  } catch (e) { NH.toast(e.message, 'error'); }
}

async function loadTransactions() {
  const params = new URLSearchParams();
  const type = document.getElementById('filter-type').value;
  const status = document.getElementById('filter-status').value;
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;
  if (type) params.set('type', type);
  if (status) params.set('validation_status', status);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  try {
    const data = await NH.get(`/api/accounting?${params.toString()}`);
    txCache = data.transactions;
    const tbody = document.getElementById('table-body');
    document.getElementById('table-empty').style.display = txCache.length ? 'none' : '';
    tbody.innerHTML = txCache.map((t) => `
      <tr class="row" data-id="${t.id}" style="cursor:pointer;">
        <td>${NH.escapeHtml(t.number || '—')}</td>
        <td>${t.type === 'entree' ? 'Entrée' : 'Sortie'}</td>
        <td class="muted">${NH.formatDate(t.date)}</td>
        <td class="muted">${NH.escapeHtml(t.category || '—')}</td>
        <td class="muted">${NH.escapeHtml(t.reason || '—')}</td>
        <td class="text-right" style="color:${t.type === 'entree' ? 'var(--green-dark)' : 'var(--bordeaux)'}">${t.type === 'entree' ? '+' : '-'}${NH.formatMoney(t.amount)}</td>
        <td><span class="stamp ${VALIDATION_STAMP[t.validation_status]}">${VALIDATION_LABELS[t.validation_status]}</span></td>
      </tr>`).join('');
    tbody.querySelectorAll('.row').forEach((row) => row.addEventListener('click', () => openModal(row.dataset.id)));
  } catch (e) { NH.toast(e.message, 'error'); }
}

function fillForm(t) {
  document.getElementById('f-id').value = t.id || '';
  document.getElementById('f-type').value = t.type || 'entree';
  updateCategoryOptions();
  document.getElementById('f-amount').value = t.amount || '';
  document.getElementById('f-date').value = t.date || new Date().toISOString().slice(0, 10);
  document.getElementById('f-time').value = t.time || '';
  document.getElementById('f-category').value = t.category || '';
  document.getElementById('f-reason').value = t.reason || '';
  document.getElementById('f-person').value = t.person_concerned || '';
  document.getElementById('f-business').value = t.business_concerned || '';
  document.getElementById('f-payment').value = t.payment_method || '';
  document.getElementById('f-receipt').value = t.receipt || '';
  document.getElementById('f-notes').value = t.notes || '';

  document.getElementById('tx-meta').textContent = t.id
    ? `${t.number || ''} — Enregistrée par ${t.author_name || '—'} — Statut : ${VALIDATION_LABELS[t.validation_status]}`
    : '';
  document.getElementById('modal-title').textContent = t.id ? 'Transaction' : 'Nouvelle transaction';

  const statusActions = document.getElementById('status-actions');
  statusActions.innerHTML = '';
  const canValidate = NH.hasPermission(currentUser, 'accounting', 'validate');
  if (t.id && canValidate) {
    if (t.validation_status !== 'validee') statusActions.innerHTML += `<button type="button" class="btn btn-outline btn-sm" data-target="validee">Valider</button>`;
    if (t.validation_status !== 'annulee') statusActions.innerHTML += `<button type="button" class="btn btn-outline btn-sm" data-target="annulee">Annuler</button>`;
    statusActions.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await NH.patch(`/api/accounting/${t.id}`, { validation_status: btn.dataset.target });
          NH.toast('Statut mis à jour.');
          NH.closeModal('tx-modal');
          loadTransactions(); loadSummary();
        } catch (e) { NH.toast(e.message, 'error'); }
      });
    });
  }

  const canEdit = t.id ? (NH.hasPermission(currentUser, 'accounting', 'edit') && t.validation_status !== 'validee') : NH.hasPermission(currentUser, 'accounting', 'add');
  document.getElementById('save-btn').style.display = canEdit ? '' : 'none';
  document.querySelectorAll('#tx-form input, #tx-form textarea, #tx-form select').forEach((el) => { el.disabled = !canEdit; });
}

async function openModal(id) {
  if (id) {
    try { const data = await NH.get(`/api/accounting/${id}`); fillForm(data.transaction); }
    catch (e) { NH.toast(e.message, 'error'); return; }
  } else { fillForm({}); }
  NH.openModal('tx-modal');
}

function exportCsv() {
  const header = ['Numero', 'Type', 'Date', 'Categorie', 'Motif', 'Montant', 'Statut'];
  const rows = txCache.map((t) => [t.number, t.type, t.date, t.category, t.reason, t.amount, t.validation_status]);
  const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'comptabilite-new-hanover.csv';
  a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener('nh:ready', (evt) => {
  currentUser = evt.detail;
  loadSummary();
  loadTransactions();

  document.getElementById('btn-new').addEventListener('click', () => {
    if (!NH.hasPermission(currentUser, 'accounting', 'add')) { NH.toast('Permission refusée.', 'error'); return; }
    openModal(null);
  });
  document.getElementById('modal-close').addEventListener('click', () => NH.closeModal('tx-modal'));
  document.getElementById('modal-cancel').addEventListener('click', () => NH.closeModal('tx-modal'));
  document.getElementById('f-type').addEventListener('change', updateCategoryOptions);
  document.getElementById('btn-export').addEventListener('click', exportCsv);

  ['filter-type', 'filter-status', 'filter-from', 'filter-to'].forEach((id) => {
    document.getElementById(id).addEventListener('change', loadTransactions);
  });

  document.getElementById('tx-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('f-id').value;
    const payload = {
      type: document.getElementById('f-type').value,
      amount: document.getElementById('f-amount').value,
      date: document.getElementById('f-date').value,
      time: document.getElementById('f-time').value || null,
      category: document.getElementById('f-category').value,
      reason: document.getElementById('f-reason').value,
      person_concerned: document.getElementById('f-person').value,
      business_concerned: document.getElementById('f-business').value,
      payment_method: document.getElementById('f-payment').value,
      receipt: document.getElementById('f-receipt').value,
      notes: document.getElementById('f-notes').value,
    };
    try {
      if (id) await NH.put(`/api/accounting/${id}`, payload);
      else await NH.post('/api/accounting', payload);
      NH.toast('Transaction enregistrée.');
      NH.closeModal('tx-modal');
      loadTransactions(); loadSummary();
    } catch (e2) { NH.toast(e2.message, 'error'); }
  });

  if (NH.qs('new') === '1' && NH.hasPermission(currentUser, 'accounting', 'add')) openModal(null);
});
