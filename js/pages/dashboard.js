document.addEventListener('nh:ready', async (evt) => {
  const user = evt.detail;

  const quickActions = [
    { label: 'Créer un décret', href: '/decrets.html?new=1', perm: ['decrees', 'add'] },
    { label: 'Ajouter un communiqué', href: '/communiques.html?new=1', perm: ['communiques', 'add'] },
    { label: 'Créer un événement d\'agenda', href: '/agenda.html?new=1', perm: ['agenda', 'add'] },
    { label: 'Ajouter une transaction', href: '/comptabilite.html?new=1', perm: ['accounting', 'add'] },
    { label: 'Enregistrer un courrier', href: '/courriers.html' },
    { label: 'Déposer un courrier (boîte aux lettres)', href: '/boite-lettres.html?new=1', perm: ['boite_lettres', 'add'] },
    { label: 'Créer une tâche', href: '/taches.html' },
    { label: 'Ajouter une entreprise', href: '/entreprises.html' },
    { label: 'Modifier l\'inventaire du coffre', href: '/inventaire.html' },
  ];
  document.getElementById('quick-actions').innerHTML = quickActions
    .filter((a) => !a.perm || NH.hasPermission(user, a.perm[0], a.perm[1]))
    .map((a) => `<a class="btn btn-outline btn-sm" href="${a.href}">${a.label}</a>`)
    .join('');

  let data;
  try {
    data = await NH.get('/api/dashboard');
  } catch (e) {
    NH.toast(e.message, 'error');
    return;
  }

  const tiles = [];
  if (data.decrees_en_preparation !== null) tiles.push(['Décrets en préparation', data.decrees_en_preparation]);
  if (data.decrees_a_publier !== null) tiles.push(['Décrets à publier', data.decrees_a_publier]);
  if (data.communiques_en_attente !== null) tiles.push(['Communiqués en attente', data.communiques_en_attente]);
  if (data.mail_en_attente !== null) tiles.push(['Boîte aux lettres à répondre', data.mail_en_attente]);
  else tiles.push(['Courriers en attente', '—', 'Module à venir']);
  tiles.push(['Tâches en cours', '—', 'Module à venir']);
  document.getElementById('stat-tiles').innerHTML = tiles.map(([label, value, note]) => `
    <div class="stat-tile">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value}</div>
      ${note ? `<div class="muted" style="font-size:0.7rem;">${note}</div>` : ''}
    </div>`).join('');

  const balanceBlock = document.getElementById('balance-block');
  if (data.balance !== null) {
    balanceBlock.innerHTML = `<div class="stat-value" style="color: ${data.balance >= 0 ? 'var(--green-dark)' : 'var(--bordeaux)'}">${NH.formatMoney(data.balance)}</div>
      <a class="btn btn-sm btn-outline" href="/comptabilite.html" style="margin-top:0.6rem;">Voir la comptabilité</a>`;
  } else {
    balanceBlock.innerHTML = '<p class="muted">Vous n\'avez pas accès à la comptabilité.</p>';
  }

  const upcoming = document.getElementById('upcoming-events');
  if (data.upcoming_events && data.upcoming_events.length) {
    upcoming.innerHTML = '<table><tbody>' + data.upcoming_events.map((e) => `
      <tr><td>${NH.formatDate(e.date)}</td><td>${NH.escapeHtml(e.title)}</td><td class="muted">${NH.AGENDA_TYPE_LABELS[e.type] || e.type}</td></tr>
    `).join('') + '</tbody></table>';
  } else if (data.upcoming_events) {
    upcoming.innerHTML = '<p class="empty-state">Aucun événement à venir.</p>';
  } else {
    upcoming.innerHTML = '<p class="muted">Vous n\'avez pas accès à l\'agenda.</p>';
  }

  const recentTx = document.getElementById('recent-transactions');
  if (data.recent_in) {
    let html = '<h4 style="font-size:0.8rem; text-transform:uppercase; color:var(--green-dark);">Entrées récentes</h4>';
    html += data.recent_in.length ? data.recent_in.map((t) => `<div class="flex-between"><span>${NH.escapeHtml(t.reason || t.category || t.number)}</span><span>${NH.formatMoney(t.amount)}</span></div>`).join('') : '<p class="empty-state">Aucune</p>';
    html += '<h4 style="font-size:0.8rem; text-transform:uppercase; color:var(--bordeaux); margin-top:0.8rem;">Sorties récentes</h4>';
    html += data.recent_out.length ? data.recent_out.map((t) => `<div class="flex-between"><span>${NH.escapeHtml(t.reason || t.category || t.number)}</span><span>${NH.formatMoney(t.amount)}</span></div>`).join('') : '<p class="empty-state">Aucune</p>';
    recentTx.innerHTML = html;
  } else {
    recentTx.innerHTML = '<p class="muted">Vous n\'avez pas accès à la comptabilité.</p>';
  }

  if (data.boite_lettres_a_repondre && data.boite_lettres_a_repondre.length) {
    document.getElementById('mailbox-sheet').style.display = '';
    document.getElementById('mailbox-pending').innerHTML = '<ul class="tache-list" style="list-style:none; margin:0; padding:0;">' + data.boite_lettres_a_repondre.map((b) => `
      <li style="padding:0.5rem 0; border-bottom:1px solid var(--paper-line);">
        <a href="/boite-lettres.html?id=${b.id}">${NH.escapeHtml(b.description || 'Courrier sans description')}</a>
        <span class="muted" style="float:right;">${NH.formatDate(b.created_at)}</span>
      </li>`).join('') + '</ul>';
  }
});
