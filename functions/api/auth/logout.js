import { clearSessionCookie, getCookie, SESSION_COOKIE } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const token = getCookie(request, SESSION_COOKIE);
  if (token) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Set-Cookie': clearSessionCookie(),
    },
  });
}
