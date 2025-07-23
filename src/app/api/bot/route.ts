import { NextResponse } from 'next/server';
import { InteractionType, InteractionResponseType } from 'discord-interactions';
import { verifyDiscordRequest } from '../../../bot/utils';
import { command as pingCommand, execute as pingExecute } from '../../../bot/commands/ping';

export async function POST(req: Request) {
  const { isValid, body } = await verifyDiscordRequest(req);

  if (!isValid || !body) {
    return new NextResponse('Invalid request signature', { status: 401 });
  }

  const interaction = JSON.parse(body);

  if (interaction.type === InteractionType.PING) {
    return new NextResponse(JSON.stringify({ type: InteractionResponseType.PONG }), { status: 200 });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    switch (interaction.data.name) {
      case pingCommand.name:
        const response = await pingExecute();
        return new NextResponse(JSON.stringify(response), { status: 200 });
      default:
        return new NextResponse('Unknown command', { status: 400 });
    }
  }

  return new NextResponse('Unsupported interaction type', { status: 400 });
}