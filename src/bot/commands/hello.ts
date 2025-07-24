import { InteractionResponseType } from 'discord-interactions';

/**
 * @description The command's metadata.
 */
export const command = {
  name: 'hello',
  description: 'Says hello!',
};

/**
 * @description The command's execution logic.
 * @returns {{type: InteractionResponseType, data: {content: string}}} The response to the interaction.
 */
export function execute() {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: 'Hello there!',
    },
  };
}