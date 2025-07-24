import { NextResponse } from 'next/server';
import { InteractionType, InteractionResponseType, verifyKey } from 'discord-interactions';

export async function POST(req: Request) {
  console.log('Received interaction request.');

  const signature = req.headers.get('x-signature-ed25519');
  const timestamp = req.headers.get('x-signature-timestamp');
  const rawBody = await req.text();

  if (!signature || !timestamp) {
    console.error('Missing signature or timestamp headers.');
    return new NextResponse('Bad request signature', { status: 401 });
  }

  console.log('Verifying request signature...');
  const isValid = verifyKey(
    rawBody,
    signature,
    timestamp,
    process.env.DISCORD_PUBLIC_KEY!
  );

  if (!isValid) {
    console.error('Invalid request signature.');
    return new NextResponse('Bad request signature', { status: 401 });
  }

  console.log('Signature verified.');

  try {
    const body = JSON.parse(rawBody);
    const { type } = body;

    console.log(`Received interaction type: ${type}`);

    if (type === InteractionType.PING) {
      console.log('Handling PING request.');
      return NextResponse.json({ type: InteractionResponseType.PONG });
    }

    // Handle other interaction types here
    console.log('Acknowledging other interaction.');
    return NextResponse.json({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });

  } catch (err) {
    console.error('Error processing interaction:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}