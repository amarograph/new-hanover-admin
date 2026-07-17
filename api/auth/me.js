import { getSessionUser } from '../../lib/auth.js';

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  if (!user) return res.status(200).json({ authenticated: false });

  const {
    id, discord_id, discord_username, character_first_name, character_last_name,
    job_title, grade, arrival_date, last_login, status, role, permissions,
  } = user;

  res.status(200).json({
    authenticated: true,
    user: {
      id, discord_id, discord_username, character_first_name, character_last_name,
      job_title, grade, arrival_date, last_login, status,
      role: role ? { id: role.id, name: role.name } : null,
      permissions,
    },
  });
}
