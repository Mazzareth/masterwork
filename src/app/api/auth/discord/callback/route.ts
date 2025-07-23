import { NextRequest, NextResponse } from 'next/server';
import { auth, db as adminDb } from '@/lib/firebase-admin'; // Using admin SDK for server-side auth

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

interface DiscordUser {
  id: string;
  username: string;
  avatar: string;
  email: string;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const sessionCookie = req.cookies.get('__session')?.value;

  if (!code) {
    return NextResponse.redirect(new URL('/profile?error=No code provided', req.url));
  }

  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login?error=Not authenticated', req.url));
  }

  try {
    const decodedToken = await auth.verifySessionCookie(sessionCookie, true);
    const uid = decodedToken.uid;

    const discord_client_id = process.env.DISCORD_CLIENT_ID!;
    const discord_client_secret = process.env.DISCORD_SECRET!;
    const redirect_uri = process.env.NODE_ENV === 'production' 
      ? 'https://www.masterwork.app/api/auth/discord/callback'
      : 'http://localhost:3000/api/auth/discord/callback';

    // 1. Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: discord_client_id,
        client_secret: discord_client_secret,
        grant_type: 'authorization_code',
        code,
        redirect_uri,
      }),
    });

    const tokenData: DiscordTokenResponse = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Discord token exchange error:', tokenData);
      return NextResponse.redirect(new URL('/profile?error=Discord token exchange failed', req.url));
    }

    // 2. Fetch user's Discord profile
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData: DiscordUser = await userResponse.json();

    if (!userResponse.ok) {
      console.error('Discord user fetch error:', userData);
      return NextResponse.redirect(new URL('/profile?error=Failed to fetch Discord profile', req.url));
    }

    // 3. Update user profile in Firestore
    const discordProfile = {
      id: userData.id,
      username: userData.username,
      avatar: userData.avatar,
    };

    // 3. Update user profile in Firestore using the Admin SDK
    const userDocRef = adminDb.collection('users').doc(uid);

    await userDocRef.set({ 
      discordProfile 
    }, { merge: true });

    // 4. Redirect back to the profile page
    return NextResponse.redirect(new URL('/profile?success=Discord linked successfully', req.url));

  } catch (error) {
    console.error('Discord callback error:', error);
    return NextResponse.redirect(new URL('/profile?error=An unexpected error occurred', req.url));
  }
}