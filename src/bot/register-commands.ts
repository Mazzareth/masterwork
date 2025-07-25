import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { command as pingCommand } from './commands/ping';
import { command as helloCommand } from './commands/hello';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const commands = [pingCommand, helloCommand];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN!);

/**
 * @description Registers the application's slash commands with Discord.
 */
(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();