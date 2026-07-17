let currentUser = null;

async function loadTaches() {
  try {
    const data = await NH.get('/api/taches');
    const list = document.getElementById('tache-list');
    document.getElementById('tache-empty').style.display = data.taches.length ? 'none' : '';
    const canEdit = NH.hasPermission(currentUser, 'taches', 'edit');
    const canDelete = NH.hasPermission(currentUser, 'taches', 'delete');
    list.innerHTML = data.taches.map((t) => `
      <li class="tache-item ${t.done ? 'done' : ''}" data-id="${t.id}">
        <input type="checkbox" ${t.done ? 'checked' : ''} ${canEdit ? '' : 'disabled'}>
        <span class="tache-text">${NH.escapeHtml(t.text)}</span>
        ${canDelete ? '<button type="button" class="tache-remove" title="Supprimer">&times;</button>' : ''}
      </li>`).join('');

    list.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener('change', async (e) => {
        const id = e.target.closest('.tache-item').dataset.id;
        try {
          await NH.patch(`/api/taches/${id}`, { done: e.target.checked });
          loadTaches();
        } catch (err) { NH.toast(err.message, 'error'); }
      });
    });
    list.querySelectorAll('.tache-remove').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.closest('.tache-item').dataset.id;
        try {
          await NH.del(`/api/taches/${id}`);
          loadTaches();
        } catch (err) { NH.toast(err.message, 'error'); }
      });
    });
  } catch (e) { NH.toast(e.message, 'error'); }
}

document.addEventListener('nh:ready', (evt) => {
  currentUser = evt.detail;
  document.getElementById('tache-form').style.display = NH.hasPermission(currentUser, 'taches', 'add') ? '' : 'none';
  loadTaches();

  document.getElementById('tache-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('f-text');
    const text = input.value.trim();
    if (!text) return;
    try {
      await NH.post('/api/taches', { text });
      input.value = '';
      loadTaches();
    } catch (err) { NH.toast(err.message, 'error'); }
  });
});
