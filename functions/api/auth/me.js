import { json } from '../../_lib/respond.js';

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return json({ authenticated: false });

  const {
    id, discord_id, discord_username, character_first_name, character_last_name,
    job_title, grade, arrival_date, last_login, status, role, permissions,
  } = user;

  return json({
    authenticated: true,
    user: {
      id, discord_id, discord_username, character_first_name, character_last_name,
      job_title, grade, arrival_date, last_login, status,
      role: role ? { id: role.id, name: role.name } : null,
      permissions,
    },
  });
}
