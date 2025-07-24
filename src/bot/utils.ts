import { verifyKey } from 'discord-interactions';

/**
 * @description Verifies a Discord interaction request.
 * @param {Request} req - The request object from the interaction.
 * @returns {Promise<{ isValid: boolean; body: string | null }>} An object containing whether the request is valid and the request body.
 */
export async function verifyDiscordRequest(req: Request) {
  const signature = req.headers.get('x-signature-ed25519');
  const timestamp = req.headers.get('x-signature-timestamp');
  const body = await req.text();

  if (!signature || !timestamp) {
    return { isValid: false, body: null };
  }

  const isValid = verifyKey(
    body,
    signature,
    timestamp,
    process.env.DISCORD_PUBLIC_KEY!
  );

  return { isValid, body };
}