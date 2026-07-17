window.NH = window.NH || {};

NH.escapeHtml = function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
};

NH.formatDate = function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value.length <= 10 ? value + 'T00:00:00' : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

NH.formatDateTime = function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

NH.formatMoney = function formatMoney(value) {
  const n = Number(value || 0);
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $';
};

NH.toast = function toast(message, type = 'info') {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' error' : '');
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 4500);
};

NH.confirmAction = function confirmAction(message) {
  return window.confirm(message);
};

NH.openModal = function openModal(id) {
  document.getElementById(id).classList.add('open');
};
NH.closeModal = function closeModal(id) {
  document.getElementById(id).classList.remove('open');
};

NH.qs = function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
};

// Étiquettes de statut communes (décrets / communiqués)
NH.STATUS_LABELS = {
  a_faire: 'À faire',
  en_redaction: 'En rédaction',
  en_attente_validation: 'En attente de validation',
  a_publier: 'À publier',
  publie: 'Publié',
  archive: 'Archives',
};
NH.STATUS_STAMP_CLASS = {
  a_faire: 'stamp-grey',
  en_redaction: 'stamp-neutral',
  en_attente_validation: 'stamp-gold',
  a_publier: 'stamp-gold',
  publie: 'stamp-green',
  archive: 'stamp-grey',
};

NH.CONFIDENTIALITY_LABELS = {
  publique: 'Publique',
  interne: 'Interne',
  confidentiel: 'Confidentiel',
};

NH.AUDIENCE_LABELS = {
  tous: 'Tous les citoyens',
  entreprises: 'Entreprises',
  forces_ordre: "Forces de l'ordre",
  corps_medical: 'Corps médical',
  employes: "Employés de l'administration",
  personnalise: 'Groupe personnalisé',
};

NH.AGENDA_TYPE_LABELS = {
  rendez_vous: 'Rendez-vous',
  reunion: 'Réunion',
  audience: 'Audience',
  entretien: 'Entretien',
  evenement: 'Événement',
  date_limite: 'Date limite',
  publication_prevue: 'Publication prévue',
  inspection: 'Inspection',
  deplacement_officiel: 'Déplacement officiel',
  rappel: 'Rappel',
};

NH.AGENDA_STATUS_LABELS = {
  prevu: 'Prévu',
  confirme: 'Confirmé',
  reporte: 'Reporté',
  annule: 'Annulé',
  termine: 'Terminé',
};

NH.PRIORITY_LABELS = {
  faible: 'Faible',
  normale: 'Normale',
  importante: 'Importante',
  urgente: 'Urgente',
};

NH.USER_STATUS_LABELS = {
  pending: 'En attente de validation',
  accepted: 'Compte accepté',
  refused: 'Compte refusé',
  suspended: 'Compte suspendu',
  disabled: 'Compte désactivé',
};
NH.USER_STATUS_STAMP_CLASS = {
  pending: 'stamp-gold',
  accepted: 'stamp-green',
  refused: 'stamp-red',
  suspended: 'stamp-red',
  disabled: 'stamp-grey',
};

NH.TRANSACTION_CATEGORY_LABELS_IN = ['Taxes', 'Impôts', 'Amendes', 'Dons', 'Paiements de licences', 'Revenus d\'événements', 'Remboursements', 'Autres revenus'];
NH.TRANSACTION_CATEGORY_LABELS_OUT = ['Salaires', 'Achats de matériel', 'Subventions', 'Remboursements', 'Organisation d\'événements', 'Travaux', 'Déplacements', 'Dépenses administratives', 'Autres dépenses'];

NH.ENTREPRISE_STATUS_LABELS = {
  active: 'Active',
  en_attente_autorisation: 'En attente d\'autorisation',
  suspendue: 'Suspendue',
  fermee: 'Fermée',
  archivee: 'Archivée',
};
NH.ENTREPRISE_STATUS_STAMP_CLASS = {
  active: 'stamp-green',
  en_attente_autorisation: 'stamp-gold',
  suspendue: 'stamp-red',
  fermee: 'stamp-grey',
  archivee: 'stamp-grey',
};

NH.BL_STATUS_LABELS = {
  a_repondre: 'À répondre',
  doit_repondre: 'Doit répondre',
  repondu: 'Répondu',
};
NH.BL_STATUS_STAMP_CLASS = {
  a_repondre: 'stamp-gold',
  doit_repondre: 'stamp-red',
  repondu: 'stamp-green',
};

NH.ARME_CATEGORY_LABELS = {
  legale: 'Légale',
  illegale: 'Illégale',
  non_connu: 'Non connu',
};
NH.ARME_CATEGORY_STAMP_CLASS = {
  legale: 'stamp-green',
  illegale: 'stamp-red',
  non_connu: 'stamp-grey',
};

NH.CHEVAL_STATUS_LABELS = {
  actif: 'Actif',
  vendu: 'Vendu',
  perdu: 'Perdu',
  vole: 'Volé',
  retrouve: 'Retrouvé',
  decede: 'Décédé',
  saisi: 'Saisi',
  archive: 'Archivé',
};
NH.CHEVAL_STATUS_STAMP_CLASS = {
  actif: 'stamp-green',
  vendu: 'stamp-neutral',
  perdu: 'stamp-gold',
  vole: 'stamp-red',
  retrouve: 'stamp-green',
  decede: 'stamp-grey',
  saisi: 'stamp-gold',
  archive: 'stamp-grey',
};

NH.INV_CATEGORY_LABELS = {
  documents: 'Documents',
  materiel_administratif: 'Matériel administratif',
  armes: 'Armes',
  munitions: 'Munitions',
  fournitures: 'Fournitures',
  objets_saisis: 'Objets saisis',
  objets_valeur: 'Objets de valeur',
  materiel_evenementiel: 'Matériel événementiel',
};
