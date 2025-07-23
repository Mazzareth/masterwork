import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const discord_api = 'https://discord.com/api/oauth2/authorize';
  const client_id = process.env.DISCORD_CLIENT_ID!;

  // Determine the redirect URI based on the environment
  const host = req.headers.get('host');
  const protocol = host?.startsWith('localhost') ? 'http' : 'https';
  const redirect_uri = `${protocol}://${host}/api/auth/discord/callback`;

  const params = new URLSearchParams({
    client_id: client_id,
    redirect_uri: redirect_uri,
    response_type: 'code',
    scope: 'identify email',
  });

  const redirectUrl = `${discord_api}?${params.toString()}`;
  return NextResponse.redirect(redirectUrl);
}