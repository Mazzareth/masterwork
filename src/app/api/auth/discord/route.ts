import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const discord_client_id = process.env.DISCORD_CLIENT_ID;
  const redirect_uri = process.env.NODE_ENV === 'production' 
    ? 'https://www.masterwork.app/api/auth/discord/callback'
    : 'http://localhost:3000/api/auth/discord/callback';

  const scope = 'identify email';

  const url = `https://discord.com/api/oauth2/authorize?client_id=${discord_client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=${encodeURIComponent(scope)}`;

  return NextResponse.redirect(url);
}