import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase-admin';

/**
 * @description Handles the request to check a Riot account and save the PUUID.
 * @param {NextRequest} req - The incoming Next.js request.
 * @returns {Promise<NextResponse>} A Next.js response.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Verify user authentication from the session cookie
    const sessionCookie = req.cookies.get('__session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie, true);
    const uid = decodedToken.uid;

    // 2. Parse request body
    const { gameName, tagLine }: { gameName: string; tagLine: string } = await req.json();

    if (!gameName || !tagLine) {
      return NextResponse.json({ error: 'gameName and tagLine are required.' }, { status: 400 });
    }

    // 3. Call Riot API
    const riotApiKey = process.env.RIOT_API_KEY;
    if (!riotApiKey) {
      console.error('RIOT_API_KEY is not set.');
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    const riotApiUrl = `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${riotApiKey}`;

    const riotResponse = await fetch(riotApiUrl);

    if (!riotResponse.ok) {
        const errorData = await riotResponse.json();
        console.error('Riot API error:', errorData);
        return NextResponse.json({ error: 'Failed to fetch account from Riot API.', details: errorData }, { status: riotResponse.status });
    }

    const riotData = await riotResponse.json();
    const { puuid } = riotData;

    if (!puuid) {
        return NextResponse.json({ error: 'PUUID not found in Riot API response.' }, { status: 404 });
    }

    // 4. Save PUUID to Firestore
    const userDocRef = db.collection('users').doc(uid);
    await userDocRef.set({ puuid: puuid, leagueIGN: gameName, hashtag: tagLine }, { merge: true });

    // 5. Return success response
    return NextResponse.json({ success: true, puuid: puuid });

  } catch (error) {
    console.error('Riot API route error:', error);
    if (error instanceof Error && 'code' in error && ((error as any).code === 'auth/session-cookie-expired' || (error as any).code === 'auth/session-cookie-revoked')) {
        return NextResponse.json({ error: 'Session expired, please log in again.' }, { status: 401 });
    }
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}