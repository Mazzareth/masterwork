import { NextResponse } from 'next/server';
import { InteractionType, InteractionResponseType } from 'discord-interactions';
import nacl from 'tweetnacl';

export async function POST(req: Request) {
  const signature = req.headers.get('x-signature-ed25519');
  const timestamp = req.headers.get('x-signature-timestamp');
  const rawBody = await req.text();

  if (!signature || !timestamp) {
    return new NextResponse('Bad request signature', { status: 401 });
  }

  const isVerified = nacl.sign.detached.verify(
    Buffer.from(timestamp + rawBody),
    Buffer.from(signature, 'hex'),
    Buffer.from(process.env.DISCORD_PUBLIC_KEY!, 'hex')
  );

  if (!isVerified) {
    return new NextResponse('Invalid request signature', { status: 401 });
  }

  const body = JSON.parse(rawBody);

  if (body.type === InteractionType.PING) {
    return new Response(JSON.stringify({ type: InteractionResponseType.PONG }), { status: 200 });
  } 

  if (body.type === InteractionType.APPLICATION_COMMAND) {
    switch (body.data.name) {
      case 'ping':
        console.log('Handling ping command');
        return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: 'Pong!',
            },
        });
      default:
        console.error('Unknown command');
        return new NextResponse('Unknown command', { status: 400 });
    }
  }

  console.error('Unknown interaction type');
  return new NextResponse('Unknown interaction type', { status: 400 });
}