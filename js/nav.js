(function () {
  const NAV_SECTIONS = [
    { group: null, items: [
      { href: '/dashboard.html', label: 'Accueil', icon: '⌂', page: 'dashboard' },
      { href: '/profil.html', label: 'Mon profil', icon: '☺', page: 'profil' },
      { href: '/decrets.html', label: 'Décrets', icon: '§', page: 'decrets', perm: ['decrees', 'view'] },
      { href: '/communiques.html', label: 'Communiqués', icon: '✉', page: 'communiques', perm: ['communiques', 'view'] },
      { href: '/agenda.html', label: 'Agenda', icon: '▤', page: 'agenda', perm: ['agenda', 'view'] },
      { href: '/entreprises.html', label: 'Entreprises', icon: '⚑', page: 'entreprises', perm: ['entreprises', 'view'] },
      { href: '/comptabilite.html', label: 'Comptabilité', icon: '⚖', page: 'comptabilite', perm: ['accounting', 'view'] },
      { href: '/employes.html', label: 'Employés', icon: '☺', page: 'employes', perm: ['employes', 'view'] },
      { href: '/taches.html', label: 'Tâches', icon: '✓', page: 'taches', perm: ['taches', 'view'] },
      { href: '/courriers.html', label: 'Courriers', icon: '✎', page: 'courriers', perm: ['courriers', 'view'] },
      { href: '/armes.html', label: 'Registre des armes', icon: '⚔', page: 'armes' },
      { href: '/chevaux.html', label: 'Registre des chevaux', icon: '♞', page: 'chevaux' },
      { href: '/inventaire.html', label: 'Inventaire du coffre', icon: '⚿', page: 'inventaire' },
      { href: '/evenements.html', label: 'Événements', icon: '✦', page: 'evenements' },
      { href: '/archives.html', label: 'Archives', icon: '⌘', page: 'archives' },
    ]},
    { group: 'Administration du site', items: [
      { href: '/demandes-acces.html', label: "Demandes d'accès", icon: '⚹', page: 'demandes-acces', perm: ['admin', 'manage_users'] },
      { href: '/utilisateurs.html', label: 'Utilisateurs', icon: '⚙', page: 'utilisateurs', perm: ['admin', 'manage_users'] },
      { href: '/roles.html', label: 'Rôles et permissions', icon: '⚖', page: 'roles', perm: ['admin', 'manage_users'] },
      { href: '/journal.html', label: "Journal d'activité", icon: '▤', page: 'journal', perm: ['admin', 'view_log'] },
      { href: '/parametres.html', label: 'Paramètres', icon: '⚒', page: 'parametres', perm: ['admin', 'manage_users'] },
      { href: '/sauvegardes.html', label: 'Sauvegardes', icon: '⛁', page: 'sauvegardes', perm: ['admin', 'manage_users'] },
    ]},
  ];

  function hasPermission(user, moduleName, action) {
    if (!user) return false;
    const perms = user.permissions || {};
    if (perms.all && perms.all.includes(action)) return true;
    if (perms[moduleName] && perms[moduleName].includes(action)) return true;
    return false;
  }
  window.NH = window.NH || {};
  NH.hasPermission = hasPermission;

  function renderSidebar(user, currentPage) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    let html = `<a class="brand" href="/dashboard.html"><img src="/css/img/crest-120.png" alt="" class="brand-crest">Administration<br>de New Hanover<small>Territoire du New Hanover — 1892</small></a>`;
    NAV_SECTIONS.forEach((section) => {
      const visibleItems = section.items.filter((it) => !it.perm || hasPermission(user, it.perm[0], it.perm[1]));
      if (!visibleItems.length) return;
      html += `<div class="nav-group">`;
      if (section.group) html += `<div class="nav-group-title">${section.group}</div>`;
      html += '<nav>';
      visibleItems.forEach((it) => {
        html += `<a href="${it.href}" class="${it.page === currentPage ? 'active' : ''}"><span class="nav-icon">${it.icon}</span>${it.label}</a>`;
      });
      html += '</nav></div>';
    });
    if (hasPermission(user, 'admin', 'manage_users')) {
      html += `<div class="nav-group" style="margin-top:auto; padding-top:1rem;">
        <a href="/utilisateurs.html" class="btn btn-gold" style="display:block; margin:0 1rem; text-align:center; text-decoration:none;">⚙ Panel Admin</a>
      </div>`;
    }
    sidebar.innerHTML = html;
  }

  function renderTopbar(user) {
    const topbar = document.getElementById('topbar');
    if (!topbar) return;
    const displayName = (user.character_first_name || user.character_last_name)
      ? `${user.character_first_name || ''} ${user.character_last_name || ''}`.trim()
      : user.discord_username;
    topbar.innerHTML = `
      <button class="menu-toggle" id="menu-toggle" title="Menu" aria-label="Menu">☰</button>
      <div class="search-box">
        <input type="search" id="global-search" placeholder="Rechercher un décret, une entreprise, un employé..." autocomplete="off">
        <div class="search-results" id="search-results"></div>
      </div>
      <div class="topbar-spacer"></div>
      ${hasPermission(user, 'admin', 'manage_users') ? `<a href="/utilisateurs.html" class="btn btn-outline btn-sm no-print" style="text-decoration:none; margin-right:0.6rem;">⚙ Panel Admin</a>` : ''}
      <div class="user-chip">
        <span class="name">${NH.escapeHtml(displayName)}</span>
        <span class="muted">${NH.escapeHtml(user.role ? user.role.name : 'Sans rôle')}</span>
      </div>
      <button class="theme-toggle" id="theme-toggle" title="Basculer le mode d'affichage">☾ / ☀</button>
      <button class="logout-btn" id="logout-btn">Déconnexion</button>
    `;

    document.getElementById('menu-toggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });
    document.getElementById('logout-btn').addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/';
    });
    document.getElementById('theme-toggle').addEventListener('click', () => {
      const root = document.documentElement;
      const next = root.getAttribute('data-theme') === 'nuit' ? 'jour' : 'nuit';
      root.setAttribute('data-theme', next);
      localStorage.setItem('nh-theme', next);
    });

    const searchInput = document.getElementById('global-search');
    const searchResults = document.getElementById('search-results');
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const q = searchInput.value.trim();
      if (q.length < 2) { searchResults.classList.remove('open'); return; }
      debounceTimer = setTimeout(async () => {
        try {
          const data = await NH.get(`/api/search?q=${encodeURIComponent(q)}`);
          if (!data.results.length) {
            searchResults.innerHTML = '<div style="padding:0.6rem 0.8rem;" class="muted">Aucun résultat</div>';
          } else {
            searchResults.innerHTML = data.results.map((r) =>
              `<a href="${r.url}"><span class="type-tag">${r.type}</span>${NH.escapeHtml(r.label)}</a>`
            ).join('');
          }
          searchResults.classList.add('open');
        } catch (e) { /* ignore */ }
      }, 250);
    });
    document.addEventListener('click', (e) => {
      if (!searchResults.contains(e.target) && e.target !== searchInput) searchResults.classList.remove('open');
    });
  }

  async function initGate() {
    const savedTheme = localStorage.getItem('nh-theme');
    if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

    let data;
    try {
      data = await NH.get('/api/auth/me');
    } catch (e) {
      window.location.href = '/';
      return;
    }
    if (!data.authenticated) {
      window.location.href = '/';
      return;
    }
    if (data.user.status === 'pending') {
      window.location.href = '/en-attente.html';
      return;
    }
    if (data.user.status !== 'accepted') {
      window.location.href = `/compte-bloque.html?status=${data.user.status}`;
      return;
    }

    const currentPage = document.body.dataset.page;
    const requiredPerm = document.body.dataset.requirePermission;
    if (requiredPerm) {
      const [mod, action] = requiredPerm.split(':');
      if (!hasPermission(data.user, mod, action)) {
        document.getElementById('content').innerHTML = '<div class="sheet"><h2>Accès refusé</h2><p>Vous ne disposez pas des permissions nécessaires pour consulter cette page.</p></div>';
      }
    }

    renderSidebar(data.user, currentPage);
    renderTopbar(data.user);

    window.NH.currentUser = data.user;
    document.dispatchEvent(new CustomEvent('nh:ready', { detail: data.user }));
  }

  document.addEventListener('DOMContentLoaded', initGate);
})();
