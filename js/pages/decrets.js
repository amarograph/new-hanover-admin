const DECREE_CATEGORIES = [
  { key: '', label: 'Toutes' },
  { key: 'a_faire', label: 'À faire' },
  { key: 'en_redaction', label: 'En rédaction' },
  { key: 'en_attente_validation', label: 'En attente de validation' },
  { key: 'a_publier', label: 'À publier' },
  { key: 'publie', label: 'Publiés' },
  { key: 'archive', label: 'Archives' },
];

const decreeState = { category: '', q: '' };
let currentUser = null;

function decreeStatusActions(decree) {
  const actions = [];
  const isNew = !decree.id;
  if (isNew) return actions;
  const canEdit = NH.hasPermission(currentUser, 'decrees', 'edit');
  const canValidate = NH.hasPermission(currentUser, 'decrees', 'validate');
  const canArchive = NH.hasPermission(currentUser, 'decrees', 'archive');

  if (['a_faire', 'en_redaction'].includes(decree.category) && canEdit) {
    actions.push(['Envoyer en validation', 'en_attente_validation']);
  }
  if (decree.category === 'en_attente_validation' && canValidate) {
    actions.push(['Valider (à publier)', 'a_publier']);
    if (canEdit) actions.push(['Refuser (retour en rédaction)', 'en_redaction']);
  }
  if (decree.category === 'a_publier' && canValidate) {
    actions.push(['Publier', 'publie']);
  }
  if (decree.category === 'publie' && canArchive) {
    actions.push(['Archiver', 'archive']);
  }
  return actions;
}

async function loadDecrees() {
  const params = new URLSearchParams();
  if (decreeState.category) params.set('category', decreeState.category);
  if (decreeState.q) params.set('q', decreeState.q);
  const tbody = document.getElementById('decrees-table-body');
  try {
    const data = await NH.get(`/api/decrees?${params.toString()}`);
    document.getElementById('decrees-empty').style.display = data.decrees.length ? 'none' : '';
    tbody.innerHTML = data.decrees.map((d) => `
      <tr class="decree-row" data-id="${d.id}" style="cursor:pointer;">
        <td>${NH.escapeHtml(d.number || '—')}</td>
        <td>${NH.escapeHtml(d.title)}</td>
        <td class="muted">${NH.escapeHtml(d.author_name || '—')}</td>
        <td class="muted">${NH.formatDate(d.created_at)}</td>
        <td><span class="stamp ${NH.STATUS_STAMP_CLASS[d.category] || 'stamp-neutral'}">${NH.STATUS_LABELS[d.category] || d.category}</span></td>
        <td class="text-right muted">${NH.CONFIDENTIALITY_LABELS[d.confidentiality] || ''}</td>
      </tr>`).join('');
    tbody.querySelectorAll('.decree-row').forEach((row) => {
      row.addEventListener('click', () => openDecreeModal(row.dataset.id));
    });
  } catch (e) {
    NH.toast(e.message, 'error');
  }
}

function renderTabs() {
  const tabs = document.getElementById('category-tabs');
  tabs.innerHTML = DECREE_CATEGORIES.map((c) =>
    `<div class="tab ${decreeState.category === c.key ? 'active' : ''}" data-key="${c.key}">${c.label}</div>`
  ).join('');
  tabs.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      decreeState.category = tab.dataset.key;
      renderTabs();
      loadDecrees();
    });
  });
}

function fillDecreeForm(decree) {
  document.getElementById('decree-id').value = decree.id || '';
  document.getElementById('decree-title').value = decree.title || '';
  document.getElementById('decree-effective-date').value = decree.effective_date || '';
  document.getElementById('decree-confidentiality').value = decree.confidentiality || 'interne';
  document.getElementById('decree-content').value = decree.content || '';
  document.getElementById('decree-notes').value = decree.internal_notes || '';
  const attachments = decree.attachments ? JSON.parse(decree.attachments) : [];
  document.getElementById('decree-attachments').value = attachments.join('\n');

  const meta = document.getElementById('decree-meta');
  meta.textContent = decree.id
    ? `${decree.number || ''} — Auteur : ${decree.author_name || '—'}${decree.validator_name ? ' — Validé par ' + decree.validator_name : ''} — Statut : ${NH.STATUS_LABELS[decree.category] || decree.category}`
    : '';

  const statusActions = document.getElementById('decree-status-actions');
  statusActions.innerHTML = '';
  decreeStatusActions(decree).forEach(([label, target]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-outline btn-sm';
    btn.textContent = label;
    btn.addEventListener('click', async () => {
      try {
        await NH.patch(`/api/decrees/${decree.id}`, { status: target });
        NH.toast('Statut mis à jour.');
        NH.closeModal('decree-modal');
        loadDecrees();
      } catch (e) { NH.toast(e.message, 'error'); }
    });
    statusActions.appendChild(btn);
  });

  const canEdit = decree.id ? NH.hasPermission(currentUser, 'decrees', 'edit') : NH.hasPermission(currentUser, 'decrees', 'add');
  document.getElementById('decree-save-btn').style.display = canEdit ? '' : 'none';
  document.querySelectorAll('#decree-form input, #decree-form textarea, #decree-form select').forEach((el) => { el.disabled = !canEdit; });
}

async function openDecreeModal(id) {
  document.getElementById('decree-modal-title').textContent = id ? 'Décret' : 'Nouveau décret';
  if (id) {
    try {
      const data = await NH.get(`/api/decrees/${id}`);
      fillDecreeForm(data.decree);
    } catch (e) { NH.toast(e.message, 'error'); return; }
  } else {
    fillDecreeForm({});
  }
  NH.openModal('decree-modal');
}

function printDecree() {
  const title = document.getElementById('decree-title').value;
  const number = document.getElementById('decree-meta').textContent;
  const content = document.getElementById('decree-content').value;
  const effectiveDate = document.getElementById('decree-effective-date').value;
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>${NH.escapeHtml(title)}</title>
    <style>body{font-family:Georgia,serif; max-width:700px; margin:3rem auto; color:#241611;}
    h1{border-bottom:2px solid #b8862c; padding-bottom:0.5rem;} .meta{color:#555; font-size:0.85rem; margin-bottom:2rem;}
    .content{white-space:pre-wrap; line-height:1.6;}</style></head>
    <body><h1>${NH.escapeHtml(title)}</h1>
    <div class="meta">${NH.escapeHtml(number)}${effectiveDate ? ' — Entrée en vigueur : ' + NH.formatDate(effectiveDate) : ''}</div>
    <div class="content">${NH.escapeHtml(content)}</div>
    </body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

document.addEventListener('nh:ready', (evt) => {
  currentUser = evt.detail;
  renderTabs();
  loadDecrees();

  document.getElementById('btn-new-decree').addEventListener('click', () => {
    if (!NH.hasPermission(currentUser, 'decrees', 'add')) { NH.toast('Permission refusée.', 'error'); return; }
    openDecreeModal(null);
  });
  document.getElementById('decree-modal-close').addEventListener('click', () => NH.closeModal('decree-modal'));
  document.getElementById('decree-modal-cancel').addEventListener('click', () => NH.closeModal('decree-modal'));
  document.getElementById('decree-print-btn').addEventListener('click', printDecree);

  let searchTimer;
  document.getElementById('filter-q').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { decreeState.q = e.target.value.trim(); loadDecrees(); }, 300);
  });

  document.getElementById('decree-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('decree-id').value;
    const payload = {
      title: document.getElementById('decree-title').value,
      effective_date: document.getElementById('decree-effective-date').value || null,
      confidentiality: document.getElementById('decree-confidentiality').value,
      content: document.getElementById('decree-content').value,
      internal_notes: document.getElementById('decree-notes').value,
      attachments: document.getElementById('decree-attachments').value.split('\n').map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (id) {
        await NH.put(`/api/decrees/${id}`, payload);
        NH.toast('Décret mis à jour.');
      } else {
        payload.category = 'a_faire';
        await NH.post('/api/decrees', payload);
        NH.toast('Décret créé.');
      }
      NH.closeModal('decree-modal');
      loadDecrees();
    } catch (e2) { NH.toast(e2.message, 'error'); }
  });

  if (NH.qs('new') === '1' && NH.hasPermission(currentUser, 'decrees', 'add')) openDecreeModal(null);
});
