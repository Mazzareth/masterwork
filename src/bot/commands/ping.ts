import { InteractionResponseType } from 'discord-interactions';

/**
 * @description The command's metadata.
 */
export const command = {
  name: 'ping',
  description: 'Replies with Pong!',
};

/**
 * @description The command's execution logic.
 * @returns {Promise<{type: InteractionResponseType, data: {content: string}}>} The response to the interaction.
 */
export async function execute() {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: 'Pong!',
    },
  };
}