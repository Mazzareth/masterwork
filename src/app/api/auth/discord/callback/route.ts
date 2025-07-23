import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db as adminDb, auth as adminAuth } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/profile?error=No code provided', req.url));
  }

  const cookieStore = cookies();
  const sessionCookie = await (await cookieStore).get('__session');

  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/profile?error=Not authenticated', req.url));
  }

  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_SECRET!,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${req.nextUrl.origin}/api/auth/discord/callback`,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Error fetching token:', tokenData);
      return NextResponse.redirect(new URL(`/profile?error=${tokenData.error_description}`, req.url));
    }

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();

    try {
      const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie.value, true);
      const uid = decodedClaims.uid;

      const userDocRef = adminDb.collection('users').doc(uid);

      await userDocRef.update({
        discordProfile: {
          id: userData.id,
          username: userData.username,
          avatar: userData.avatar,
        },
      });
    } catch (error) {
      console.error('Error during Discord callback processing:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return NextResponse.redirect(new URL(`/profile?error=${encodeURIComponent(errorMessage)}`, req.url));
    }

    return NextResponse.redirect(new URL('/profile?success=Discord linked', req.url));
  } catch (error: any) {
    console.error('Discord callback error:', error);
    return NextResponse.redirect(new URL(`/profile?error=${error.message || 'An unknown error occurred'}`, req.url));
  }
}