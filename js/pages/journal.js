document.addEventListener('nh:ready', async () => {
  try {
    const data = await NH.get('/api/activity-log?limit=200');
    const tbody = document.getElementById('table-body');
    document.getElementById('table-empty').style.display = data.entries.length ? 'none' : '';
    tbody.innerHTML = data.entries.map((entry) => `
      <tr>
        <td class="muted">${NH.formatDateTime(entry.created_at)}</td>
        <td>${NH.escapeHtml(entry.user_name || 'Système')}</td>
        <td>${NH.escapeHtml(entry.action)}</td>
        <td class="muted">${entry.target_type ? `${NH.escapeHtml(entry.target_type)} #${NH.escapeHtml(entry.target_id)}` : '—'}</td>
      </tr>`).join('');
  } catch (e) { NH.toast(e.message, 'error'); }
});
