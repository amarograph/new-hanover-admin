function userLabel(u) {
  const name = (u.character_first_name || u.character_last_name) ? `${u.character_first_name || ''} ${u.character_last_name || ''}`.trim() : u.discord_username;
  return `${name}${u.role_name ? ' — ' + u.role_name : ''}`;
}

document.addEventListener('nh:ready', async () => {
  try {
    const [usersData, settingsData] = await Promise.all([
      NH.get('/api/users'),
      NH.get('/api/settings'),
    ]);
    const signableUsers = usersData.users.filter((u) => u.role_name !== 'Admin dev');
    const options = '<option value="">—</option>' + signableUsers.map((u) => `<option value="${u.id}">${NH.escapeHtml(userLabel(u))}</option>`).join('');
    document.getElementById('f-signer-1').innerHTML = options;
    document.getElementById('f-signer-2').innerHTML = options;
    document.getElementById('f-signer-1').value = settingsData.signer_1 ? settingsData.signer_1.id : '';
    document.getElementById('f-signer-2').value = settingsData.signer_2 ? settingsData.signer_2.id : '';
  } catch (e) { NH.toast(e.message, 'error'); }

  document.getElementById('signers-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const signer1 = document.getElementById('f-signer-1').value;
    const signer2 = document.getElementById('f-signer-2').value;
    try {
      await NH.put('/api/settings', {
        signer_1_id: signer1 ? Number(signer1) : null,
        signer_2_id: signer2 ? Number(signer2) : null,
      });
      NH.toast('Signataires mis à jour.');
    } catch (err) { NH.toast(err.message, 'error'); }
  });
});
