export async function onRequestGet(context) {
  const { env } = context;
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_REDIRECT_URI) {
    return new Response('Discord OAuth n\'est pas configuré (DISCORD_CLIENT_ID / DISCORD_REDIRECT_URI manquants).', { status: 500 });
  }
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
    prompt: 'consent',
  });
  return Response.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`, 302);
}
