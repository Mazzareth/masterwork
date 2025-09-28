# Context

## Overview
- Public, slug-based Commission entrypoint for clients to start a chat with an artist.
- Route: [/commission/[slug]](src/app/commission/[slug]/page.tsx)
  - Resolves slug -> ownerId via [/commissionSlugs/{slug}](firebase/firestore.rules).
  - Requires Google login; after submit, opens/ensures a chat and redirects client to CC chat.

## Flow
1. Artist sets a unique slug in ZZQ Settings (see [ZZQ page](src/app/zzq/page.tsx)).
2. Client visits `/commission/{slug}`:
   - If signed out, they authenticate (Google).
   - Minimal form: optional message.
   - On submit:
     - Ensure/create canonical chat with participants [ownerId, userId].
     - Create per-user chat summaries for owner and client (rules allow).
     - Redirect client to [/cc/chat/[chatId]](src/app/cc/chat/[chatId]/page.tsx).

## Data Model
- Commission Slugs (global):
  - `/commissionSlugs/{slug}`: `{ ownerId, createdAt, updatedAt }`
- Chats:
  - `/chats/{chatId}` with `participants: [ownerId, userId]`, `clientId`, `clientRef`.
    - For commission-origin chats, `clientId` is a stable pseudo id (`u:{userId}`) and `clientRef` is `commissionSlug:{slug}`.
- Per-user views:
  - Owner summary: `/users/{ownerId}/sites/cc/chats/{chatId}`
  - Client summary: `/users/{userId}/sites/cc/chats/{chatId}`
  - Client link mirror: `/users/{userId}/sites/cc/links/{chatId}`

## Files
- Page: [/commission/[slug]/page.tsx](src/app/commission/[slug]/page.tsx)
- Commission helpers: [src/lib/commission.ts](src/lib/commission.ts)
  - Reserves slugs and opens/ensures chats.
- Linking utilities (message send): [src/lib/linking.ts](src/lib/linking.ts)
- Auth: [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)
- Security rules: [firebase/firestore.rules](firebase/firestore.rules)

## Security
- Rules additions:
  - `/commissionSlugs/{slug}`:
    - `get,list`: public (slug resolution contains no sensitive data).
    - `create`: only by `request.auth.uid == ownerId`, and only if not already taken.
    - `update,delete`: only by the owning `ownerId`.
  - Owner CC chat summaries allow `create,update` by any chat participant for discoverability.
- No client writes under `/users/{ownerId}/sites/zzq/**`; the owner app can later reconcile to a full client record if desired.

## UX Notes
- Minimal form now (message only); attachments placeholder left for future.
- On submit with no typed message, a system update “Started a commission request” is posted to ensure a visible unread signal for the artist.
- After submit, user is redirected to CC chat; the artist will see the chat via owner summary/Notifications.
- Slug management (create/copy) lives in ZZQ Settings.

## References
- Page: [/commission/[slug]/page.tsx](src/app/commission/[slug]/page.tsx)
- Helpers: [src/lib/commission.ts](src/lib/commission.ts), [src/lib/linking.ts](src/lib/linking.ts)
- Rules: [firebase/firestore.rules](firebase/firestore.rules)

Did I explain the functionality clearly in Context.md? Yes.
Would another engineer understand the purpose of this directory/codebase within 2 minutes? Yes.