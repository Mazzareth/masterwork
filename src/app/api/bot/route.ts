import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const channelId = process.env.DISCORD_CHANNEL_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!channelId || !botToken) {
    return NextResponse.json(
      { error: 'Server configuration error: Missing Discord credentials.' },
      { status: 500 }
    );
  }

  const discordApiUrl = `https://discord.com/api/v10/channels/${channelId}/messages`;

  try {
    const { displayName } = await req.json();
    const content = `${displayName} has just updated their profile! Check it out.`;

    const response = await fetch(discordApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error from Discord API:', errorData);
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