const MAX_SIGNATURE_BYTES = 500 * 1024;
let pendingSignature;

function renderSignaturePreview(dataUrl) {
  const preview = document.getElementById('signature-preview');
  preview.innerHTML = dataUrl
    ? `<img src="${dataUrl}" style="max-width:260px; max-height:120px; background:#fff; border-radius:4px; display:block; padding:0.4rem;">`
    : '<span class="muted">Aucune signature enregistrée.</span>';
}

document.addEventListener('nh:ready', (evt) => {
  const user = evt.detail;
  document.getElementById('profile-discord-info').textContent = `Pseudo Discord : ${user.discord_username} — Rôle : ${user.role ? user.role.name : 'Sans rôle'}`;
  document.getElementById('f-first-name').value = user.character_first_name || '';
  document.getElementById('f-last-name').value = user.character_last_name || '';
  renderSignaturePreview(user.signature || null);

  document.getElementById('signature-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'image/png') {
      NH.toast('La signature doit être une image PNG.', 'error');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_SIGNATURE_BYTES) {
      NH.toast('Signature trop volumineuse (500 Ko maximum).', 'error');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      pendingSignature = reader.result;
      renderSignaturePreview(pendingSignature);
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      character_first_name: document.getElementById('f-first-name').value,
      character_last_name: document.getElementById('f-last-name').value,
    };
    if (pendingSignature !== undefined) payload.signature = pendingSignature;
    try {
      await NH.patch('/api/auth/profile', payload);
      NH.toast('Profil mis à jour.');
    } catch (err) { NH.toast(err.message, 'error'); }
  });
});
