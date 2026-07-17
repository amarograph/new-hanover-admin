import { db } from '../../lib/db.js';
import { clearSessionCookie, getCookie, SESSION_COOKIE } from '../../lib/auth.js';

export default async function handler(req, res) {
  const token = getCookie(req, SESSION_COOKIE);
  if (token) {
    await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  }
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.redirect(302, '/');
}
