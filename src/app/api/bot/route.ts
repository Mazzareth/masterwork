import { NextResponse } from 'next/server';

// Handle GET requests to this endpoint
export async function GET() {
  return NextResponse.json(
    { message: 'This endpoint only accepts POST requests.' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

export async function POST(req: Request) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    return NextResponse.json(
      { error: 'Server configuration error: Missing Discord Webhook URL.' },
      { status: 500 }
    );
  }

  try {
    const { displayName } = await req.json();
    const content = `${displayName} has just updated their profile! Check it out.`;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const errorData = await response.text(); // Webhook errors might not be JSON
      console.error('Error from Discord Webhook:', errorData);
      return NextResponse.json(
        { error: 'Failed to send message to Discord.' },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, message: 'Message sent successfully!' });

  } catch (error) {
    console.error('Internal Server Error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}