export const SESSION_COOKIE = 'nh_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 jours

export function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export function makeSessionCookie(token, maxAgeSeconds = SESSION_MAX_AGE) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export async function getSessionUser(context) {
  const { request, env } = context;
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;

  const row = await env.DB.prepare(
    `SELECT s.expires_at as session_expires_at, u.*
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ?`
  ).bind(token).first();
  if (!row) return null;

  if (new Date(row.session_expires_at) < new Date()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return null;
  }

  let role = null;
  if (row.role_id) {
    role = await env.DB.prepare('SELECT * FROM roles WHERE id = ?').bind(row.role_id).first();
  }

  return {
    ...row,
    role,
    permissions: role ? JSON.parse(role.permissions) : {},
  };
}

export function hasPermission(user, moduleName, action) {
  if (!user || user.status !== 'accepted') return false;
  const perms = user.permissions || {};
  if (perms.all && perms.all.includes(action)) return true;
  if (perms[moduleName] && perms[moduleName].includes(action)) return true;
  return false;
}
