let archivesCache = [];
let typeFilter = '';

function renderTabs() {
  const types = [...new Set(archivesCache.map((a) => a.type))];
  const tabs = document.getElementById('type-tabs');
  tabs.innerHTML = ['Tous', ...types].map((t) => {
    const key = t === 'Tous' ? '' : t;
    return `<div class="tab ${typeFilter === key ? 'active' : ''}" data-key="${NH.escapeHtml(key)}">${NH.escapeHtml(t)}</div>`;
  }).join('');
  tabs.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
    typeFilter = tab.dataset.key; renderTabs(); renderList();
  }));
}

function renderList() {
  const tbody = document.getElementById('table-body');
  const rows = typeFilter ? archivesCache.filter((a) => a.type === typeFilter) : archivesCache;
  document.getElementById('table-empty').style.display = rows.length ? 'none' : '';
  tbody.innerHTML = rows.map((a) => `
    <tr class="row" style="cursor:${a.url ? 'pointer' : 'default'};" data-url="${a.url || ''}">
      <td class="muted">${NH.escapeHtml(a.type)}</td>
      <td>${NH.escapeHtml(a.label)}</td>
      <td class="muted">${a.date ? NH.formatDate(a.date) : '—'}</td>
    </tr>`).join('');
  tbody.querySelectorAll('.row').forEach((row) => {
    if (!row.dataset.url) return;
    row.addEventListener('click', () => { window.location.href = row.dataset.url; });
  });
}

document.addEventListener('nh:ready', async () => {
  try {
    const data = await NH.get('/api/dashboard?view=archives');
    archivesCache = data.archives;
    renderTabs();
    renderList();
  } catch (e) { NH.toast(e.message, 'error'); }
});
