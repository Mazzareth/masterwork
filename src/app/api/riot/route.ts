import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase-admin';
import { RiotApi, Constants } from 'twisted';

/**
 * @description Handles the request to check a Riot account and save the PUUID.
 * @param {NextRequest} req - The incoming Next.js request.
 * @returns {Promise<NextResponse>} A Next.js response.
 */
interface FirebaseError extends Error {
  code: string;
}

function isFirebaseError(error: unknown): error is FirebaseError {
  return typeof error === 'object' && error !== null && 'code' in error;
}

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

    // 3. Call Riot API using twisted
    const riotApiKey = process.env.RIOT_API_KEY;
    if (!riotApiKey) {
      console.error('RIOT_API_KEY is not set.');
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    const api = new RiotApi(riotApiKey);
    const accountResponse = await api.Account.getByRiotId(gameName, tagLine, Constants.RegionGroups.AMERICAS);
    const { puuid } = accountResponse.response;

    if (!puuid) {
        return NextResponse.json({ error: 'PUUID not found in Riot API response.' }, { status: 404 });
    }

    // 4. Get Account Name from PUUID
    const accountByPuuid = await api.Account.getByPUUID(puuid, Constants.RegionGroups.AMERICAS);

    // 5. Save PUUID and Riot ID to Firestore
    const userDocRef = db.collection('users').doc(uid);
    await userDocRef.set({ 
      puuid: puuid, 
      leagueIGN: accountByPuuid.response.gameName,
      hashtag: accountByPuuid.response.tagLine
    }, { merge: true });

    // 6. Return success response
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Riot API route error:', error);
    if (isFirebaseError(error) && (error.code === 'auth/session-cookie-expired' || error.code === 'auth/session-cookie-revoked')) {
      return NextResponse.json({ error: 'Session expired, please log in again.' }, { status: 401 });
    }
    // Handle errors from the twisted library
    if (error instanceof Error) {
        return NextResponse.json({ error: 'Failed to fetch account from Riot API.', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}