import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const idToken = body.idToken;

    if (!idToken) {
      return new NextResponse(JSON.stringify({ error: 'ID token is required' }), { status: 400 });
    }

    // Set session expiration to 5 days.
    const expiresIn = 60 * 60 * 24 * 5 * 1000;

    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });

    const options = {
      name: '__session',
      value: sessionCookie,
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    };

    const response = new NextResponse(JSON.stringify({ status: 'success' }), {
      status: 200,
    });

    response.cookies.set(options);

    return response;
  } catch (error) {
    console.error('Session login error:', error);
    return new NextResponse(JSON.stringify({ error: 'Failed to create session' }), { status: 401 });
  }
}