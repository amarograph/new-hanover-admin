const COURRIER_TABS = [
  { key: '', label: 'Tous' },
  { key: 'a_envoyer', label: 'À envoyer' },
  { key: 'envoye', label: 'Envoyés' },
];

const COURRIER_TEMPLATES = {
  convocation: {
    subject: 'Convocation à comparaître devant l\'Administration',
    content: `Monsieur/Madame [Nom],

Vous êtes prié(e) de bien vouloir vous présenter dans les bureaux de l'Administration du Comté de New Hanover, à la date et à l'heure qui vous seront communiquées, afin d'être entendu(e) au sujet de [motif].

Le défaut de comparution sans motif légitime pourra entraîner les suites que la loi prévoit.

Pour l'Administration du Comté de New Hanover.`,
  },
  avertissement: {
    subject: 'Avertissement officiel',
    content: `Monsieur/Madame [Nom],

Il a été porté à la connaissance de l'Administration du Comté de New Hanover que vous auriez commis les faits suivants : [description des faits].

Le présent courrier constitue un avertissement officiel. Toute récidive pourra faire l'objet de sanctions plus sévères, conformément aux décrets en vigueur.

Pour l'Administration du Comté de New Hanover.`,
  },
  decret: {
    subject: 'Notification d\'un décret administratif',
    content: `Monsieur/Madame [Nom],

Nous vous informons par la présente qu'un nouveau décret administratif ([numéro du décret]) a été publié et s'applique à votre situation.

Nous vous invitons à en prendre connaissance dans les meilleurs délais et à vous y conformer.

Pour l'Administration du Comté de New Hanover.`,
  },
  remerciement: {
    subject: 'Lettre de remerciement',
    content: `Monsieur/Madame [Nom],

L'Administration du Comté de New Hanover tient à vous exprimer ses remerciements pour [motif].

Votre contribution est précieuse pour notre communauté.

Pour l'Administration du Comté de New Hanover.`,
  },
};

const courrierState = { status: '', q: '' };
let currentUser = null;

async function loadItems() {
  const params = new URLSearchParams();
  if (courrierState.status) params.set('status', courrierState.status);
  try {
    const data = await NH.get(`/api/courriers?${params.toString()}`);
    const tbody = document.getElementById('table-body');
    document.getElementById('table-empty').style.display = data.courriers.length ? 'none' : '';
    tbody.innerHTML = data.courriers.map((c) => `
      <tr class="row" data-id="${c.id}" style="cursor:pointer;">
        <td>${NH.escapeHtml(c.number || '—')}</td>
        <td class="muted">${NH.escapeHtml(c.recipient || '—')}</td>
        <td>${NH.escapeHtml(c.subject)}</td>
        <td class="muted">${NH.formatDate(c.created_at)}</td>
        <td><span class="stamp ${c.status === 'envoye' ? 'stamp-green' : 'stamp-gold'}">${c.status === 'envoye' ? 'Envoyé' : 'À envoyer'}</span></td>
      </tr>`).join('');
    tbody.querySelectorAll('.row').forEach((row) => row.addEventListener('click', () => openModal(row.dataset.id)));
  } catch (e) { NH.toast(e.message, 'error'); }
}

function renderTabs() {
  const tabs = document.getElementById('status-tabs');
  tabs.innerHTML = COURRIER_TABS.map((t) => `<div class="tab ${courrierState.status === t.key ? 'active' : ''}" data-key="${t.key}">${t.label}</div>`).join('');
  tabs.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
    courrierState.status = tab.dataset.key; renderTabs(); loadItems();
  }));
}

function fillForm(item) {
  document.getElementById('f-id').value = item.id || '';
  document.getElementById('f-recipient').value = item.recipient || '';
  document.getElementById('f-subject').value = item.subject || '';
  document.getElementById('f-content').value = item.content || '';
  document.getElementById('f-template').value = '';
  document.getElementById('template-field').style.display = item.id ? 'none' : '';

  document.getElementById('item-meta').textContent = item.id
    ? `${item.number || ''} — Rédigé par ${item.author_name || '—'}${item.sent_at ? ' — Envoyé le ' + NH.formatDateTime(item.sent_at) : ''}`
    : '';
  document.getElementById('modal-title').textContent = item.id ? 'Courrier' : 'Nouveau courrier';

  const isSent = item.status === 'envoye';
  const canEdit = item.id ? (NH.hasPermission(currentUser, 'courriers', 'edit') && !isSent) : NH.hasPermission(currentUser, 'courriers', 'add');
  document.getElementById('save-btn').style.display = canEdit ? '' : 'none';
  document.querySelectorAll('#item-form input, #item-form textarea, #item-form select').forEach((el) => { el.disabled = !canEdit; });

  const canMarkSent = !!item.id && !isSent && NH.hasPermission(currentUser, 'courriers', 'edit');
  document.getElementById('btn-mark-sent').style.display = canMarkSent ? '' : 'none';

  const canDelete = !!item.id && NH.hasPermission(currentUser, 'courriers', 'delete');
  document.getElementById('btn-delete').style.display = canDelete ? '' : 'none';
}

async function openModal(id) {
  if (id) {
    try { const data = await NH.get(`/api/courriers/${id}`); fillForm(data.courrier); }
    catch (e) { NH.toast(e.message, 'error'); return; }
  } else { fillForm({}); }
  NH.openModal('item-modal');
}

document.addEventListener('nh:ready', (evt) => {
  currentUser = evt.detail;
  renderTabs();
  loadItems();

  document.getElementById('btn-new').addEventListener('click', () => {
    if (!NH.hasPermission(currentUser, 'courriers', 'add')) { NH.toast('Permission refusée.', 'error'); return; }
    openModal(null);
  });
  document.getElementById('modal-close').addEventListener('click', () => NH.closeModal('item-modal'));
  document.getElementById('modal-cancel').addEventListener('click', () => NH.closeModal('item-modal'));

  document.getElementById('f-template').addEventListener('change', (e) => {
    const tpl = COURRIER_TEMPLATES[e.target.value];
    if (!tpl) return;
    document.getElementById('f-subject').value = tpl.subject;
    document.getElementById('f-content').value = tpl.content;
  });

  document.getElementById('btn-mark-sent').addEventListener('click', async () => {
    const id = document.getElementById('f-id').value;
    if (!id || !NH.confirmAction('Marquer ce courrier comme envoyé ? Il ne pourra plus être modifié.')) return;
    try {
      await NH.patch(`/api/courriers/${id}`, {});
      NH.toast('Courrier marqué comme envoyé.');
      NH.closeModal('item-modal');
      loadItems();
    } catch (e) { NH.toast(e.message, 'error'); }
  });

  document.getElementById('btn-delete').addEventListener('click', async () => {
    const id = document.getElementById('f-id').value;
    if (!id || !NH.confirmAction('Supprimer ce courrier ? Cette action est irréversible.')) return;
    try {
      await NH.del(`/api/courriers/${id}`);
      NH.toast('Courrier supprimé.');
      NH.closeModal('item-modal');
      loadItems();
    } catch (e) { NH.toast(e.message, 'error'); }
  });

  document.getElementById('item-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('f-id').value;
    const payload = {
      recipient: document.getElementById('f-recipient').value,
      subject: document.getElementById('f-subject').value,
      content: document.getElementById('f-content').value,
    };
    try {
      if (id) { await NH.put(`/api/courriers/${id}`, payload); NH.toast('Courrier mis à jour.'); }
      else { await NH.post('/api/courriers', payload); NH.toast('Courrier créé.'); }
      NH.closeModal('item-modal');
      loadItems();
    } catch (e2) { NH.toast(e2.message, 'error'); }
  });

  const preselect = NH.qs('id');
  if (preselect) openModal(preselect);
  if (NH.qs('new') === '1' && NH.hasPermission(currentUser, 'courriers', 'add')) openModal(null);
});
