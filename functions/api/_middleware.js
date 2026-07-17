import { getSessionUser } from '../_lib/auth.js';

export async function onRequest(context) {
  context.data.user = await getSessionUser(context);
  return context.next();
}
