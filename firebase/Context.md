# Context

## Overview
- Firestore security rules live at [`firebase/firestore.rules`](firebase/firestore.rules:1).
- Rules protect per-user data (ZZQ), canonical chats, invites, commission slugs, and other site-specific subtrees.

## Recent changes (2025-09-26)
- Introduced a lightweight admin helper `isAdmin()` that checks the authenticated user's email (currently "mercysquadrant@gmail.com").
- Relaxed `/users/{uid}` rules to allow owner or admin to create/get/list/update user documents to support Auth provider bootstrap and admin lookup by email.
- Added an invite-only area for Masterwork Claimed:
  - Tasks: `masterwork/claimed/tasks/{taskId}`
  - Allowlist: `masterwork/claimed/allowlist/{uid}`
  - Access is granted if the user is admin or has an allowlist document keyed by their uid.
- Note: admin check currently uses an email claim — consider migrating to an admin UID or role stored on `/users/{uid}` for greater robustness.

## Updates (2025-09-27)
- Adjusted owner chat summary rules to unblock ZZQ notifications:
  - In [firebase/firestore.rules](firebase/firestore.rules:131), `allow create, update` for `/users/{ownerId}/sites/cc/chats/{chatId}` now checks that the writer is a participant and that any provided `userId` corresponds to an allowed participant (either themselves or the linked client), removing the previous strict `userId == request.auth.uid` requirement.
  - This resolves “Missing or insufficient permissions” errors triggered when linked clients mirror `lastMessageAt` into the owner’s summary while still ensuring only participants can update the document.
- Paired with the client-side patch in [sendChatMessage()](src/lib/linking.ts:283) and [sendChatUpdate()](src/lib/linking.ts:347) to include the required identifiers in the write payload.
## Debugging "Missing or insufficient permissions"
- Common causes:
  - The client attempted a Firestore read/write before auth was available. AuthProvider uses `onAuthStateChanged`; ensure your client waits for `user` before making Firestore calls.
  - Admin email mismatch: rules use `request.auth.token.email == "mercysquadrant@gmail.com"`. Confirm the signed-in user is using that Google account.
  - Query/list operations require explicit `list` permission on the target collection (for example, the admin must be signed-in to query `/users` by email).
- Quick checks:
  - Sign in as the admin account once (so `/users/{uid}` exists) before using the admin UI to grant others.
  - If you prefer, I can change the admin check to a specific UID or a role field on `/users/{uid}`.

## Files referenced
- [`firebase/firestore.rules`](firebase/firestore.rules:1)
- [`src/contexts/AuthContext.tsx`](src/contexts/AuthContext.tsx:1)
- [`src/app/zzq/page.tsx`](src/app/zzq/page.tsx:1)
- [`src/app/masterwork/claimed/page.tsx`](src/app/masterwork/claimed/page.tsx:1)

## Next steps
- If the permission error persists, paste the console error including the Firestore document path or confirm which account (email/uid) you're signed in as so I can further adjust rules safely.
- Recommended: migrate admin check to UID or role claim to avoid brittle email-based checks.