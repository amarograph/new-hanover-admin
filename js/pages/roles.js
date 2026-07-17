const MODULES = [
  { key: 'decrees', label: 'Décrets', actions: ['view', 'add', 'edit', 'archive', 'delete', 'validate', 'download'] },
  { key: 'communiques', label: 'Communiqués', actions: ['view', 'add', 'edit', 'archive', 'delete', 'validate', 'download'] },
  { key: 'agenda', label: 'Agenda', actions: ['view', 'add', 'edit', 'archive', 'delete', 'download'] },
  { key: 'accounting', label: 'Comptabilité', actions: ['view', 'add', 'edit', 'delete', 'validate', 'download'] },
  { key: 'entreprises', label: 'Entreprises', actions: ['view', 'add', 'edit', 'archive', 'delete', 'download'] },
  { key: 'employes', label: 'Employés', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'taches', label: 'Tâches', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'courriers', label: 'Courriers', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'boite_lettres', label: 'Boîte aux lettres', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'armes', label: 'Registre des armes', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'admin', label: 'Administration du site', actions: ['manage_users', 'view_log'] },
];
const ACTION_LABELS = {
  view: 'Voir', add: 'Ajouter', edit: 'Modifier', archive: 'Archiver', delete: 'Supprimer',
  validate: 'Valider', refuse: 'Refuser', download: 'Télécharger',
  manage_users: 'Gérer les utilisateurs', view_log: "Voir le journal",
};
const ALL_ACTIONS = ['view', 'add', 'edit', 'archive', 'delete', 'validate', 'refuse', 'download', 'manage_users', 'view_log'];

let rolesCache = [];

function renderPermMatrix(permissions = {}) {
  let html = '<thead><tr><th>Module</th>' + ALL_ACTIONS.map((a) => `<th>${ACTION_LABELS[a]}</th>`).join('') + '</tr></thead><tbody>';
  MODULES.forEach((mod) => {
    html += `<tr><td>${mod.label}</td>`;
    ALL_ACTIONS.forEach((action) => {
      if (!mod.actions.includes(action)) { html += '<td></td>'; return; }
      const checked = (permissions[mod.key] || []).includes(action) ? 'checked' : '';
      html += `<td><input type="checkbox" data-module="${mod.key}" data-action="${action}" ${checked}></td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';
  document.getElementById('perm-matrix').innerHTML = html;
}

function readPermMatrix() {
  const permissions = {};
  document.querySelectorAll('#perm-matrix input[type="checkbox"]:checked').forEach((cb) => {
    const mod = cb.dataset.module;
    permissions[mod] = permissions[mod] || [];
    permissions[mod].push(cb.dataset.action);
  });
  return permissions;
}

async function loadRoles() {
  try {
    const data = await NH.get('/api/roles');
    rolesCache = data.roles;
    document.getElementById('table-body').innerHTML = rolesCache.map((r) => `
      <tr class="row" data-id="${r.id}" style="cursor:pointer;">
        <td>${NH.escapeHtml(r.name)}${r.is_system ? ' <span class="muted">(rôle système)</span>' : ''}</td>
        <td class="muted">${NH.escapeHtml(r.description || '—')}</td>
        <td class="text-right muted">Modifier &rsaquo;</td>
      </tr>`).join('');
    document.querySelectorAll('#table-body .row').forEach((row) => row.addEventListener('click', () => openModal(row.dataset.id)));
  } catch (e) { NH.toast(e.message, 'error'); }
}

function openModal(id) {
  const role = id ? rolesCache.find((r) => String(r.id) === String(id)) : null;
  document.getElementById('modal-title').textContent = role ? role.name : 'Nouveau rôle';
  document.getElementById('f-id').value = role ? role.id : '';
  document.getElementById('f-name').value = role ? role.name : '';
  document.getElementById('f-description').value = role ? role.description || '' : '';
  renderPermMatrix(role ? role.permissions : {});
  document.getElementById('btn-delete').style.display = role && !role.is_system ? '' : 'none';
  NH.openModal('role-modal');
}

document.addEventListener('nh:ready', () => {
  loadRoles();

  document.getElementById('btn-new').addEventListener('click', () => openModal(null));
  document.getElementById('modal-close').addEventListener('click', () => NH.closeModal('role-modal'));
  document.getElementById('modal-cancel').addEventListener('click', () => NH.closeModal('role-modal'));

  document.getElementById('role-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('f-id').value;
    const payload = {
      name: document.getElementById('f-name').value,
      description: document.getElementById('f-description').value,
      permissions: readPermMatrix(),
    };
    try {
      if (id) await NH.put(`/api/roles/${id}`, payload);
      else await NH.post('/api/roles', payload);
      NH.toast('Rôle enregistré.');
      NH.closeModal('role-modal');
      loadRoles();
    } catch (e2) { NH.toast(e2.message, 'error'); }
  });

  document.getElementById('btn-delete').addEventListener('click', async () => {
    const id = document.getElementById('f-id').value;
    if (!id || !NH.confirmAction('Supprimer ce rôle ?')) return;
    try {
      await NH.del(`/api/roles/${id}`);
      NH.toast('Rôle supprimé.');
      NH.closeModal('role-modal');
      loadRoles();
    } catch (e) { NH.toast(e.message, 'error'); }
  });
});
