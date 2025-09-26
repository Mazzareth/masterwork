import { NextResponse } from "next/server";

type ChatMessage = { role: "system" | "user" | "assistant" | string; content: string };

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = body.messages as ChatMessage[] | undefined;
    const model = body.model ?? "deepseek-chat";
    const stream = Boolean(body.stream ?? false);

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages is required" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "DeepSeek API key not configured" }, { status: 500 });
    }

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, stream }),
    });

    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text();

    if (contentType.includes("application/json")) {
      const json = JSON.parse(text);
      return NextResponse.json(json, { status: res.ok ? 200 : 502 });
    }

    return new Response(text, { status: res.ok ? 200 : 502, headers: { "Content-Type": contentType } });
  } catch (err) {
    console.error("DeepSeek proxy error", err);
    return NextResponse.json({ error: "DeepSeek proxy failed" }, { status: 500 });
  }
}