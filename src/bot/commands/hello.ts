import { InteractionResponseType } from 'discord-interactions';

export const command = {
  name: 'hello',
  description: 'Says hello!',
};

export function execute() {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: 'Hello there!',
    },
  };
}