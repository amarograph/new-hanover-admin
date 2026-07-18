const COURRIER_TABS = [
  { key: '', label: 'Tous' },
  { key: 'a_envoyer', label: 'À envoyer' },
  { key: 'envoye', label: 'Envoyés' },
];

// {{DATE}} / {{NOM_SIGNATAIRE}} / {{FONCTION_SIGNATAIRE}} sont remplacés
// automatiquement (date du jour, nom RP et grade de la personne connectée).
// Les autres blancs à compléter à la main sont entre crochets [________].
const SIGNATURE_BLOCK = `Pour le Bureau de l'Administrateur
Administration du Comté de New Hanover

Nom : {{NOM_SIGNATAIRE}}
Fonction : {{FONCTION_SIGNATAIRE}}`;

const COURRIER_TEMPLATES = {
  vierge: {
    subject: '',
    content: `\n\n\n${SIGNATURE_BLOCK}`,
  },

  convocation: {
    subject: 'Convocation officielle auprès de l\'Administration du Comté',
    content: `ADMINISTRATION DU COMTÉ DE NEW HANOVER
Bureau de l'Administrateur

Valentine, le {{DATE}}

CONVOCATION OFFICIELLE

À l'attention de :
Nom : [________________________________]

Objet : Convocation officielle auprès de l'Administration du Comté

Monsieur / Madame,

Par la présente, le Bureau de l'Administrateur du Comté de New Hanover vous informe que votre présence est officiellement requise afin d'être entendu(e) dans le cadre d'une affaire relevant des compétences de l'Administration.

Vous êtes convoqué(e) à vous présenter le [______________] à [___________], au [________________________________], où vous serez reçu(e) par un représentant dûment mandaté du Bureau de l'Administrateur.

Cette convocation revêt un caractère officiel. En cas d'empêchement légitime, il vous appartient d'en informer les services administratifs dans les plus brefs délais afin qu'une nouvelle date puisse être fixée.

À défaut de vous présenter sans justification valable, le Bureau de l'Administrateur se réserve le droit d'engager toute mesure administrative ou judiciaire prévue par les lois et décrets en vigueur au sein du Comté de New Hanover.

Nous vous prions de vous présenter avec le respect et la diligence qu'exige une telle convocation.

Veuillez agréer, Monsieur / Madame, l'expression de notre haute considération.

${SIGNATURE_BLOCK}`,
  },

  avertissement: {
    subject: 'Avertissement officiel',
    content: `ADMINISTRATION DU COMTÉ DE NEW HANOVER
Bureau de l'Administrateur

Valentine, le {{DATE}}

AVERTISSEMENT OFFICIEL

À l'attention de :
Nom : [________________________________]

Objet : Avertissement officiel

Monsieur / Madame,

Par la présente, le Bureau de l'Administrateur du Comté de New Hanover vous adresse un avertissement officiel à la suite de faits ayant été portés à la connaissance de l'Administration et susceptibles de constituer un manquement aux lois, règlements ou décrets en vigueur au sein du Comté.

Après examen des éléments recueillis, il apparaît que votre comportement est de nature à porter atteinte au bon ordre, au respect de l'autorité publique ou au bon fonctionnement des institutions du Comté de New Hanover.

En conséquence, le présent document constitue un premier avertissement officiel. Il vous est demandé de mettre immédiatement fin aux agissements reprochés et de vous conformer strictement aux dispositions légales et administratives applicables.

Le Bureau de l'Administrateur vous informe qu'en cas de récidive ou de nouveaux manquements, des mesures administratives, disciplinaires ou judiciaires pourront être engagées à votre encontre, sans autre mise en demeure préalable.

Le présent avertissement est versé aux archives administratives du Comté et pourra être produit comme pièce de référence dans toute procédure ultérieure.

Nous vous invitons à prendre la pleine mesure du présent avertissement et à adopter, à l'avenir, une conduite conforme aux attentes de l'Administration.

Veuillez agréer, Monsieur / Madame, l'expression de notre considération distinguée.

${SIGNATURE_BLOCK}`,
  },

  decret: {
    subject: 'Notification officielle de Décret',
    content: `ADMINISTRATION DU COMTÉ DE NEW HANOVER
Bureau de l'Administrateur

Valentine, le {{DATE}}

NOTIFICATION DE DÉCRET

À l'attention de :
Nom : [________________________________]

Objet : Notification officielle du Décret n° [_______] – 1892

Monsieur / Madame,

Par la présente, le Bureau de l'Administrateur du Comté de New Hanover vous notifie officiellement l'entrée en vigueur du Décret n° [_______] – 1892, adopté conformément aux pouvoirs conférés à l'Administration du Comté.

Le présent décret est applicable à compter du [__ / __ / 1892] et s'impose à toute personne, institution, entreprise ou organisation relevant de la juridiction du Comté de New Hanover.

Décret concerné

Numéro : [________________________________]

Intitulé : [________________________________________________]

Date d'adoption : [__ / __ / 1892]

Résumé des dispositions

[________________________________________________]

[________________________________________________]

[________________________________________________]

Obligations découlant du décret

À compter de son entrée en vigueur, il vous appartient de prendre toutes les dispositions nécessaires afin d'assurer le respect des prescriptions prévues par le présent décret.

Tout manquement ou toute violation des dispositions énoncées pourra donner lieu à des mesures administratives, disciplinaires ou judiciaires conformément aux lois et règlements en vigueur au sein du Comté de New Hanover.

Le texte intégral du décret est consultable auprès du Bureau de l'Administrateur ou dans les registres officiels de l'Administration.

Nous vous remercions de prendre connaissance de cette notification avec toute l'attention qu'elle requiert.

Veuillez agréer, Monsieur / Madame, l'expression de notre haute considération.

${SIGNATURE_BLOCK}`,
  },

  remerciement: {
    subject: 'Remerciements officiels',
    content: `ADMINISTRATION DU COMTÉ DE NEW HANOVER
Bureau de l'Administrateur

Valentine, le {{DATE}}

LETTRE DE REMERCIEMENT

À l'attention de :
Nom : [________________________________]

Objet : Remerciements officiels

Monsieur / Madame,

Le Bureau de l'Administrateur du Comté de New Hanover tient à vous adresser ses plus sincères remerciements pour votre engagement, votre coopération et les services que vous avez rendus au bénéfice du Comté et de ses habitants.

Votre implication ainsi que le sérieux dont vous avez fait preuve témoignent d'un profond sens du devoir et contribuent au maintien du bon fonctionnement de nos institutions ainsi qu'à la prospérité de notre territoire.

L'Administration souhaite souligner que les efforts de citoyens tels que vous constituent un exemple de civisme et de dévouement, valeurs essentielles au développement et à la stabilité du Comté de New Hanover.

Recevez, par la présente, la reconnaissance officielle de l'Administration pour votre contribution. Soyez assuré(e) que votre investissement est apprécié à sa juste valeur et restera inscrit dans les archives du Bureau de l'Administrateur.

En espérant pouvoir compter sur votre concours à l'avenir, nous vous prions d'agréer, Monsieur / Madame, l'expression de notre plus haute considération.

${SIGNATURE_BLOCK}`,
  },

  administrative: {
    subject: 'Lettre administrative',
    content: `ADMINISTRATION DU COMTÉ DE NEW HANOVER
Bureau de l'Administrateur

Valentine, le {{DATE}}

LETTRE ADMINISTRATIVE

À l'attention de :
Nom : [________________________________]

Objet : [________________________________________________]

Monsieur / Madame,

Par la présente, le Bureau de l'Administrateur du Comté de New Hanover souhaite porter à votre connaissance les éléments suivants :

[________________________________________________]

[________________________________________________]

[________________________________________________]

Dans le cadre de cette démarche, nous vous invitons à prendre les dispositions nécessaires ou à nous faire parvenir toute réponse, information ou document complémentaire susceptible de faciliter le traitement de ce dossier.

Pour toute précision relative à la présente correspondance, vous pouvez vous adresser directement au Bureau de l'Administrateur, qui demeure à votre entière disposition.

Dans l'attente de votre retour, nous vous prions d'agréer, Monsieur / Madame, l'expression de notre haute considération.

${SIGNATURE_BLOCK}`,
  },

  accuse_reception: {
    subject: 'Accusé de réception',
    content: `ACCUSÉ DE RÉCEPTION
ADMINISTRATION DU COMTÉ DE NEW HANOVER
Bureau de l'Administrateur

Valentine, le {{DATE}}

Objet : Accusé de réception

Monsieur / Madame,

Le Bureau de l'Administrateur du Comté de New Hanover accuse réception de votre courrier, de votre demande ou des documents qui lui sont parvenus en date du [__ / __ / 1892].

Votre dossier a été enregistré sous la référence N° [________________] et fera l'objet d'un examen dans les meilleurs délais.

Si des informations complémentaires s'avèrent nécessaires, les services administratifs reprendront contact avec vous.

Veuillez agréer, Monsieur / Madame, l'expression de notre haute considération.

${SIGNATURE_BLOCK}`,
  },

  refus: {
    subject: 'Refus administratif',
    content: `REFUS ADMINISTRATIF
ADMINISTRATION DU COMTÉ DE NEW HANOVER
Bureau de l'Administrateur

Valentine, le {{DATE}}

Objet : Refus administratif

Monsieur / Madame,

Après examen attentif de votre demande, le Bureau de l'Administrateur du Comté de New Hanover vous informe qu'il ne lui est malheureusement pas possible d'y donner une suite favorable.

Ce refus est motivé par les raisons suivantes :

[________________________________________________]

[________________________________________________]

Vous conservez la possibilité de présenter une nouvelle demande si les circonstances venaient à évoluer ou si les éléments ayant motivé cette décision étaient régularisés.

Veuillez agréer, Monsieur / Madame, l'expression de notre haute considération.

${SIGNATURE_BLOCK}`,
  },

  autorisation: {
    subject: 'Autorisation administrative',
    content: `AUTORISATION ADMINISTRATIVE
ADMINISTRATION DU COMTÉ DE NEW HANOVER
Bureau de l'Administrateur

Valentine, le {{DATE}}

Objet : Autorisation administrative

Le Bureau de l'Administrateur du Comté de New Hanover autorise par la présente :

Nom : [________________________________]

À procéder à :

[________________________________________________]

Cette autorisation est valable à compter du [__ / __ / 1892] jusqu'au [__ / __ / 1892], sous réserve du respect des lois et décrets en vigueur.

L'Administration pourra retirer cette autorisation à tout moment en cas de non-respect des conditions fixées.

${SIGNATURE_BLOCK}`,
  },

  communique_officiel: {
    subject: 'Communiqué officiel',
    content: `COMMUNIQUÉ OFFICIEL
ADMINISTRATION DU COMTÉ DE NEW HANOVER
Bureau de l'Administrateur

Valentine, le {{DATE}}

COMMUNIQUÉ OFFICIEL

Le Bureau de l'Administrateur du Comté de New Hanover informe l'ensemble des citoyens du Comté que :

[________________________________________________]

[________________________________________________]

La présente communication est portée à la connaissance du public et prend effet dès sa publication.

${SIGNATURE_BLOCK}`,
  },

  mise_en_demeure: {
    subject: 'Mise en demeure',
    content: `MISE EN DEMEURE
ADMINISTRATION DU COMTÉ DE NEW HANOVER
Bureau de l'Administrateur

Valentine, le {{DATE}}

Objet : Mise en demeure

Monsieur / Madame,

Il a été constaté que vous n'avez pas satisfait aux obligations qui vous incombent conformément aux lois et règlements du Comté.

Par conséquent, le Bureau de l'Administrateur vous met officiellement en demeure de régulariser votre situation dans un délai de [_______] jours à compter de la réception de la présente.

À défaut, des mesures administratives ou judiciaires pourront être engagées sans nouvel avertissement.

${SIGNATURE_BLOCK}`,
  },

  decision_administrative: {
    subject: 'Décision administrative',
    content: `DÉCISION ADMINISTRATIVE
ADMINISTRATION DU COMTÉ DE NEW HANOVER
Bureau de l'Administrateur

Valentine, le {{DATE}}

Objet : Décision administrative

Après examen du dossier référencé N° [________________], le Bureau de l'Administrateur du Comté de New Hanover arrête la décision suivante :

☐ Acceptation
☐ Refus
☐ Suspension
☐ Autorisation
☐ Autre : [________________________________]

Motifs de la décision :

[________________________________________________]

[________________________________________________]

La présente décision prend effet immédiatement, sauf mention contraire.

${SIGNATURE_BLOCK}`,
  },

  pv_audition: {
    subject: 'Procès-verbal d\'audition',
    content: `PROCÈS-VERBAL D'AUDITION
ADMINISTRATION DU COMTÉ DE NEW HANOVER
Bureau de l'Administrateur

Valentine, le {{DATE}}

PROCÈS-VERBAL D'AUDITION

Personne entendue :
[________________________________]

Date et heure :
[________________________________]

Lieu :
[________________________________]

Personnes présentes :
[________________________________]

Déclarations

[________________________________________________]

[________________________________________________]

[________________________________________________]

Observations de l'Administration

[________________________________________________]

[________________________________________________]

Le présent procès-verbal est établi afin de faire foi des déclarations recueillies.

${SIGNATURE_BLOCK}`,
  },

  notification_nomination: {
    subject: 'Notification de nomination / révocation',
    content: `NOTIFICATION DE NOMINATION OU DE RÉVOCATION
ADMINISTRATION DU COMTÉ DE NEW HANOVER
Bureau de l'Administrateur

Valentine, le {{DATE}}

Objet : Notification de nomination / révocation

Monsieur / Madame,

Par décision du Bureau de l'Administrateur du Comté de New Hanover, il a été décidé ce qui suit :

☐ Nomination
☐ Révocation

Fonction concernée :
[________________________________]

Date de prise d'effet :
[__ / __ / 1892]

Motifs :

[________________________________________________]

[________________________________________________]

Nous vous remercions de prendre acte de la présente décision et de vous conformer aux dispositions qui en découlent.

Veuillez agréer, Monsieur / Madame, l'expression de notre haute considération.

${SIGNATURE_BLOCK}`,
  },
};

function todayDateline() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/1892`;
}

function fillSignatureTokens(text) {
  const name = `${currentUser.character_first_name || ''} ${currentUser.character_last_name || ''}`.trim() || '[________________________________]';
  const fonction = currentUser.grade || 'Administrateur du Comté de New Hanover';
  return text
    .replace(/\{\{DATE\}\}/g, todayDateline())
    .replace(/\{\{NOM_SIGNATAIRE\}\}/g, name)
    .replace(/\{\{FONCTION_SIGNATAIRE\}\}/g, fonction);
}

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
  document.getElementById('f-content').value = item.id ? (item.content || '') : fillSignatureTokens(SIGNATURE_BLOCK);
  document.getElementById('f-template').value = '';
  document.getElementById('template-field').style.display = item.id ? 'none' : '';

  const authorName = item.id ? `${item.author_first_name || ''} ${item.author_last_name || ''}`.trim() || item.author_name : '';
  document.getElementById('item-meta').textContent = item.id
    ? `${item.number || ''} — Signé par ${authorName || '—'}${item.author_grade ? ' (' + item.author_grade + ')' : ''}${item.sent_at ? ' — Envoyé le ' + NH.formatDateTime(item.sent_at) : ''}`
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
    document.getElementById('f-content').value = fillSignatureTokens(tpl.content);
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
