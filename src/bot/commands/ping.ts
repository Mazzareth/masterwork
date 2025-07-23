import { InteractionResponseType } from 'discord-interactions';

export const command = {
  name: 'ping',
  description: 'Replies with Pong!',
};

export async function execute() {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: 'Pong!',
    },
  };
}