import { NextRequest, NextResponse } from 'next/server';
import { InteractionType, InteractionResponseType, verifyKey } from 'discord-interactions';
import * as ping from '@/bot/commands/ping';

// Store commands in a Map
const commands = new Map();
commands.set(ping.command.name, ping);

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-signature-ed25519');
  const timestamp = req.headers.get('x-signature-timestamp');
  const rawBody = await req.text();

  if (!signature || !timestamp) {
    return new NextResponse('Missing signature headers', { status: 401 });
  }

  const isValid = verifyKey(
    rawBody,
    signature,
    timestamp,
    process.env.DISCORD_PUBLIC_KEY!
  );

  if (!isValid) {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const body = JSON.parse(rawBody);

  if (body.type === InteractionType.PING) {
    return NextResponse.json({ type: InteractionResponseType.PONG });
  }

  if (body.type === InteractionType.APPLICATION_COMMAND) {
    const command = commands.get(body.data.name);

    if (!command) {
      return new NextResponse('Unknown command', { status: 400 });
    }

    try {
      const response = await command.execute(req, NextResponse);
      return NextResponse.json(response);
    } catch (error) {
      console.error(error);
      return new NextResponse('Error executing command', { status: 500 });
    }
  }

  return new NextResponse('Unsupported interaction type', { status: 400 });
}