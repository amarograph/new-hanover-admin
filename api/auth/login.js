export default async function handler(req, res) {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_REDIRECT_URI) {
    res.status(500).send('Discord OAuth n\'est pas configuré (DISCORD_CLIENT_ID / DISCORD_REDIRECT_URI manquants).');
    return;
  }
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
    prompt: 'consent',
  });
  res.redirect(302, `https://discord.com/oauth2/authorize?${params.toString()}`);
}
