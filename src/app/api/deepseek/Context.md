# Context

## Overview
- Server-side proxy for DeepSeek to keep the API key off the client.
- Exposes POST /api/deepseek and forwards OpenAI-compatible chat requests to DeepSeek's /chat/completions endpoint.

## Behavior
- Accepts JSON: { model?, messages: [...], stream?: boolean } (OpenAI-compatible).
- Forwards request to https://api.deepseek.com/chat/completions using the DEEPSEEK_API_KEY environment variable.
- Returns DeepSeek's JSON or raw text response directly. Non-streaming by default (stream: false).

## Security & Ops
- Requires DEEPSEEK_API_KEY in the server environment (e.g., Vercel environment variables).
- Keep the API key secret; do NOT expose it to client code.
- Recommended: add rate-limiting, request validation, and logging/monitoring to protect the key and control costs.
- Consider request size and usage quotas to avoid expensive calls.

## Integration
- Called by the ZZQ UI slide-up panel at [`src/app/zzq/page.tsx`](src/app/zzq/page.tsx:194) which builds a system message containing the owner's clients and projects as context.
- The client should send only the minimal context needed; sensitive data should be kept server-side and not embedded directly in client-sent messages unless intentionally included.

## Files
- Route implementation: [`src/app/api/deepseek/route.ts`](src/app/api/deepseek/route.ts:1)

## Notes
- Proxy is intentionally minimal. Expand for streaming, validation, authentication checks (verify user session) and quotas if needed.
- After deployment, set `DEEPSEEK_API_KEY` in production secrets.