const agendaState = { view: 'mois', refDate: new Date() };
let currentUser = null;
let eventsCache = [];

function pad2(n) { return String(n).padStart(2, '0'); }
function toISODate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function startOfWeek(d) {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7; // lundi = 0
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
function addDays(d, n) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }

function rangeForView() {
  if (agendaState.view === 'jour') {
    const d = new Date(agendaState.refDate);
    return { from: toISODate(d), to: toISODate(d) };
  }
  if (agendaState.view === 'semaine') {
    const start = startOfWeek(agendaState.refDate);
    const end = addDays(start, 6);
    return { from: toISODate(start), to: toISODate(end) };
  }
  const y = agendaState.refDate.getFullYear();
  const m = agendaState.refDate.getMonth();
  const monthStart = new Date(y, m, 1);
  const monthEnd = new Date(y, m + 1, 0);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = addDays(startOfWeek(monthEnd), 6);
  return { from: toISODate(gridStart), to: toISODate(gridEnd) };
}

// Affichage uniquement : l'année réelle sert au stockage/tri des dates,
// mais l'univers du site se situe en 1892, donc on ne l'affiche jamais.
function periodLabel() {
  const opts = { jour: { day: '2-digit', month: 'long', year: 'numeric' }, semaine: {}, mois: { month: 'long', year: 'numeric' } };
  let label;
  if (agendaState.view === 'semaine') {
    const start = startOfWeek(agendaState.refDate);
    const end = addDays(start, 6);
    label = `${start.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} — ${end.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  } else {
    label = agendaState.refDate.toLocaleDateString('fr-FR', opts[agendaState.view]);
  }
  return label.replace(/\d{4}/, '1892');
}

function eventsOn(dateISO) { return eventsCache.filter((e) => e.date === dateISO); }

function renderMonth() {
  const y = agendaState.refDate.getFullYear();
  const m = agendaState.refDate.getMonth();
  const monthStart = new Date(y, m, 1);
  const gridStart = startOfWeek(monthStart);
  const todayISO = toISODate(new Date());
  let html = '<div class="cal-grid">';
  ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].forEach((d) => { html += `<div class="week-col-header">${d}</div>`; });
  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i);
    const iso = toISODate(d);
    const evts = eventsOn(iso);
    const isOther = d.getMonth() !== m;
    html += `<div class="cal-cell ${isOther ? 'other-month' : ''} ${iso === todayISO ? 'today' : ''}" data-date="${iso}">
      <div class="day-num">${d.getDate()}</div>
      ${evts.slice(0, 3).map((e) => `<div class="cal-event" title="${NH.escapeHtml(e.title)}">${e.start_time ? e.start_time.slice(0,5) + ' ' : ''}${NH.escapeHtml(e.title)}</div>`).join('')}
      ${evts.length > 3 ? `<div class="muted" style="font-size:0.65rem;">+${evts.length - 3} autres</div>` : ''}
    </div>`;
  }
  html += '</div>';
  document.getElementById('calendar-container').innerHTML = html;
  document.querySelectorAll('.cal-cell').forEach((cell) => {
    cell.addEventListener('click', () => {
      agendaState.refDate = new Date(cell.dataset.date + 'T00:00:00');
      agendaState.view = 'jour';
      syncViewTabs();
      renderCalendar();
    });
  });
}

function renderWeek() {
  const start = startOfWeek(agendaState.refDate);
  let html = '<div class="week-cols">';
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const iso = toISODate(d);
    const evts = eventsOn(iso);
    html += `<div>
      <div class="week-col-header">${d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' })}</div>
      <div class="cal-cell" data-date="${iso}" style="min-height:220px;">
        ${evts.map((e) => `<div class="cal-event" title="${NH.escapeHtml(e.title)}">${e.start_time ? e.start_time.slice(0,5) + ' ' : ''}${NH.escapeHtml(e.title)}</div>`).join('')}
      </div>
    </div>`;
  }
  html += '</div>';
  document.getElementById('calendar-container').innerHTML = html;
  document.querySelectorAll('.cal-cell').forEach((cell) => {
    cell.addEventListener('click', (ev) => {
      if (ev.target.classList.contains('cal-event')) return;
      agendaState.refDate = new Date(cell.dataset.date + 'T00:00:00');
      agendaState.view = 'jour';
      syncViewTabs();
      renderCalendar();
    });
  });
  document.querySelectorAll('.cal-event').forEach((el, idx) => {
    // handled via day view for detail; week view is overview only
  });
}

function renderDay() {
  const iso = toISODate(agendaState.refDate);
  const evts = eventsOn(iso).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  if (!evts.length) {
    document.getElementById('calendar-container').innerHTML = '<p class="empty-state">Aucun élément prévu ce jour.</p>';
    return;
  }
  document.getElementById('calendar-container').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Heure</th><th>Titre</th><th>Type</th><th>Lieu</th><th>Priorité</th><th>Statut</th></tr></thead><tbody>${
    evts.map((e) => `<tr class="row" data-id="${e.id}" style="cursor:pointer;">
      <td>${e.start_time ? e.start_time.slice(0,5) : ''}${e.end_time ? ' - ' + e.end_time.slice(0,5) : ''}</td>
      <td>${NH.escapeHtml(e.title)}</td>
      <td class="muted">${NH.AGENDA_TYPE_LABELS[e.type] || e.type}</td>
      <td class="muted">${NH.escapeHtml(e.location || '—')}</td>
      <td>${NH.PRIORITY_LABELS[e.priority] || e.priority}</td>
      <td><span class="stamp stamp-neutral">${NH.AGENDA_STATUS_LABELS[e.status] || e.status}</span></td>
    </tr>`).join('')
  }</tbody></table></div>`;
  document.querySelectorAll('#calendar-container .row').forEach((row) => {
    row.addEventListener('click', () => openEventModal(row.dataset.id));
  });
}

function syncViewTabs() {
  document.querySelectorAll('#view-tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.view === agendaState.view));
}

async function renderCalendar() {
  document.getElementById('period-label').textContent = periodLabel();
  const { from, to } = rangeForView();
  try {
    const data = await NH.get(`/api/agenda?from=${from}&to=${to}`);
    eventsCache = data.events;
  } catch (e) { NH.toast(e.message, 'error'); eventsCache = []; }
  if (agendaState.view === 'mois') renderMonth();
  else if (agendaState.view === 'semaine') renderWeek();
  else renderDay();
}

function fillForm(evt) {
  document.getElementById('f-id').value = evt.id || '';
  document.getElementById('f-title').value = evt.title || '';
  document.getElementById('f-type').value = evt.type || 'rendez_vous';
  document.getElementById('f-priority').value = evt.priority || 'normale';
  document.getElementById('f-date').value = evt.date || toISODate(agendaState.refDate);
  document.getElementById('f-start').value = evt.start_time || '';
  document.getElementById('f-end').value = evt.end_time || '';
  document.getElementById('f-location').value = evt.location || '';
  document.getElementById('f-status').value = evt.status || 'prevu';
  const participants = evt.participants ? JSON.parse(evt.participants) : [];
  document.getElementById('f-participants').value = participants.join(', ');
  document.getElementById('f-description').value = evt.description || '';
  document.getElementById('f-reminder').checked = !!evt.reminder;
  document.getElementById('btn-delete').style.display = evt.id ? '' : 'none';
  document.getElementById('modal-title').textContent = evt.id ? "Modifier l'élément d'agenda" : "Nouvel élément d'agenda";
}

async function openEventModal(id) {
  if (id) {
    try { const data = await NH.get(`/api/agenda/${id}`); fillForm(data.event); }
    catch (e) { NH.toast(e.message, 'error'); return; }
  } else {
    fillForm({});
  }
  NH.openModal('event-modal');
}

document.addEventListener('nh:ready', (evt) => {
  currentUser = evt.detail;
  syncViewTabs();
  renderCalendar();

  document.querySelectorAll('#view-tabs .tab').forEach((tab) => {
    tab.addEventListener('click', () => { agendaState.view = tab.dataset.view; syncViewTabs(); renderCalendar(); });
  });
  document.getElementById('btn-prev').addEventListener('click', () => {
    if (agendaState.view === 'mois') agendaState.refDate.setMonth(agendaState.refDate.getMonth() - 1);
    else if (agendaState.view === 'semaine') agendaState.refDate = addDays(agendaState.refDate, -7);
    else agendaState.refDate = addDays(agendaState.refDate, -1);
    renderCalendar();
  });
  document.getElementById('btn-next').addEventListener('click', () => {
    if (agendaState.view === 'mois') agendaState.refDate.setMonth(agendaState.refDate.getMonth() + 1);
    else if (agendaState.view === 'semaine') agendaState.refDate = addDays(agendaState.refDate, 7);
    else agendaState.refDate = addDays(agendaState.refDate, 1);
    renderCalendar();
  });
  document.getElementById('btn-today').addEventListener('click', () => { agendaState.refDate = new Date(); renderCalendar(); });

  document.getElementById('btn-new').addEventListener('click', () => {
    if (!NH.hasPermission(currentUser, 'agenda', 'add')) { NH.toast('Permission refusée.', 'error'); return; }
    openEventModal(null);
  });
  document.getElementById('modal-close').addEventListener('click', () => NH.closeModal('event-modal'));
  document.getElementById('modal-cancel').addEventListener('click', () => NH.closeModal('event-modal'));

  document.getElementById('event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('f-id').value;
    const payload = {
      title: document.getElementById('f-title').value,
      type: document.getElementById('f-type').value,
      priority: document.getElementById('f-priority').value,
      date: document.getElementById('f-date').value,
      start_time: document.getElementById('f-start').value || null,
      end_time: document.getElementById('f-end').value || null,
      location: document.getElementById('f-location').value,
      status: document.getElementById('f-status').value,
      participants: document.getElementById('f-participants').value.split(',').map((s) => s.trim()).filter(Boolean),
      description: document.getElementById('f-description').value,
      reminder: document.getElementById('f-reminder').checked,
    };
    try {
      if (id) await NH.put(`/api/agenda/${id}`, payload);
      else await NH.post('/api/agenda', payload);
      NH.toast('Élément enregistré.');
      NH.closeModal('event-modal');
      renderCalendar();
    } catch (e2) { NH.toast(e2.message, 'error'); }
  });

  document.getElementById('btn-delete').addEventListener('click', async () => {
    const id = document.getElementById('f-id').value;
    if (!id || !NH.confirmAction('Supprimer cet élément d\'agenda ?')) return;
    try {
      await NH.del(`/api/agenda/${id}`);
      NH.toast('Élément supprimé.');
      NH.closeModal('event-modal');
      renderCalendar();
    } catch (e) { NH.toast(e.message, 'error'); }
  });
});
