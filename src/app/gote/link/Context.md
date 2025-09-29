# Context

## Overview
- Invite acceptance page for BigGote.
- Opens with `ownerId` and `token` query params; provisions chat access on accept and redirects to BigGote.

## Behavior
- Preflight: reads the invite document to validate and surface rule errors.
- Accept flow (client calls library logic):
  - Ensure canonical chat: `/goteChats/{chatId}` with participants `[ownerId, userId]`.
  - Create self summary: `/users/{userId}/sites/gote/chats/{chatId}`.
  - Best-effort owner summary mirror: `/users/{ownerId}/sites/gote/chats/{chatId}`.
  - Mark invite used: `status='used'`, `usedBy=userId`.
  - Grant access: merge `permissions.gote=true` into `/users/{userId}`.
- Redirect to `/gote` on success.

## Data Model
- Invites: `/users/{ownerId}/sites/gote/invites/{token}`
- Chats: `/goteChats/{chatId}` and `/goteChats/{chatId}/messages/{messageId}`
- Per-user summaries: `/users/{uid}/sites/gote/chats/{chatId}`

## Firestore Rules Dependencies
- Invite GET/UPDATE: see [firebase/firestore.rules](firebase/firestore.rules)
- goteChats participant-gated create/get/update: see [firebase/firestore.rules](firebase/firestore.rules)
- Owner summary mirroring via participant write: see [firebase/firestore.rules](firebase/firestore.rules)
- Self-owned user doc update to set `permissions.gote`: see [firebase/firestore.rules](firebase/firestore.rules)

## Components
- Page: [src/app/gote/link/page.tsx](src/app/gote/link/page.tsx)
- Acceptance logic and data ops: [src/lib/gote.ts](src/lib/gote.ts)
- BigGote shell (gating includes summary probe): [src/app/gote/page.tsx](src/app/gote/page.tsx)

## Notes
- The “+ New” button in BigGote opens the Invite panel; the chat is created when the invite is accepted.
- ChatId is deterministic to keep the accept operation idempotent.
- Access is granted either by `permissions.gote=true` or presence of at least one summary doc.

## Testing
- Owner: `/gote` → Invite → Generate Link.
- Invitee: open `/gote/link?ownerId=…&token=…` → Sign in → Accept Link → redirected to `/gote`.
- Validate: chat appears in the left list and messages send successfully.

## References
- Page: [src/app/gote/link/page.tsx](src/app/gote/link/page.tsx)
- Library: [src/lib/gote.ts](src/lib/gote.ts)
- UI: [src/app/gote/page.tsx](src/app/gote/page.tsx)
- Rules: [firebase/firestore.rules](firebase/firestore.rules)

## Updates
- 2025‑09‑29 — Validation flicker mitigation
  - Deduplicated invite validation per user+invite combination using a memoized key and ref to prevent re-running validation unnecessarily, reducing UI flicker on mobile. See [GoteLinkAcceptPageInner()](src/app/gote/link/page.tsx:19).
- 2025‑09‑29 — Sign-in gating fix for invite validation
  - The accept route now waits for the user to be signed in before reading the invite doc. This satisfies rules (isSignedIn()) for `/users/{ownerId}/sites/gote/invites/{token}` and prevents false “Invalid Link” errors when opening the URL while signed out. Rendering order prioritizes the login prompt ahead of invalid-link errors.
- 2025‑09‑29 — Mobile popup fallback
  - If the header Login triggers a popup error on mobile, [loginWithGoogle()](src/contexts/AuthContext.tsx:137) now falls back to `signInWithRedirect` to complete auth reliably.
- 2025‑09‑29 — Clarified that invite acceptance grants BigGote permissions on the user doc so the header nav shows immediately; wired via [acceptGoteInvite()](src/lib/gote.ts:159).

Did I explain the functionality clearly in Context.md? Yes.
Would another engineer understand the purpose of this directory/codebase within 2 minutes? Yes.