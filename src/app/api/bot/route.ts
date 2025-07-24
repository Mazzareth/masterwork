import { NextResponse } from 'next/server';

/**
 * Handles GET requests to this endpoint.
 * @returns {NextResponse} A JSON response indicating that only POST requests are accepted.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { message: 'This endpoint only accepts POST requests.' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

/**
 * Handles POST requests to send a notification to a Discord webhook.
 * @param {Request} req The incoming Next.js request object.
 * @property {object} req.body - The JSON body of the request.
 * @property {string} req.body.displayName - The display name of the user.
 * @returns {Promise<NextResponse>} A JSON response indicating success or failure.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    return NextResponse.json(
      { error: 'Server configuration error: Missing Discord Webhook URL.' },
      { status: 500 }
    );
  }

  try {
    const { displayName }: { displayName: string } = await req.json();
    const content = `${displayName} has just updated their profile! Check it out.`;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Error from Discord Webhook:', errorData);
      return NextResponse.json(
        { error: 'Failed to send message to Discord.' },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, message: 'Message sent successfully!' });

  } catch (error) {
    console.error('Internal Server Error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}