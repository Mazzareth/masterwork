# Context

## Overview
- "Masterwork — Claimed" is an invite-only task tracker for Mazzy's "claimed" participants (consensual collaborators / "pets").
- Access is controlled via a Firestore allowlist. By default only the admin (mercysquadrant@gmail.com) has access; the admin can grant or revoke access to other users.

## Components
- Page UI: [`src/app/masterwork/claimed/page.tsx`](src/app/masterwork/claimed/page.tsx:1) — client-side React page using AuthContext and Firestore.
- Firestore collections:
  - Tasks: `masterwork/claimed/tasks/{taskId}`
  - Allowlist: `masterwork/claimed/allowlist/{uid}` (document keyed by the user's uid)

## Data model
- Task document fields: title, status (open | in_progress | done), assignedTo, createdAt, updatedAt, createdBy.
- Allowlist document fields: email, grantedBy, createdAt.

## Security
- Access enforced server-side by Firestore rules. See the rule additions in [`firebase/firestore.rules`](firebase/firestore.rules:163).
  - Read/write to tasks allowed only if the user is the admin (email mercysquadrant@gmail.com) OR an allowlist document exists for their uid.
  - Only the admin can create/update/delete allowlist documents (grant/revoke access).
- Rely on the Firebase-authenticated email claim for admin check; consider migrating to an explicit role field on `/users/{uid}` for more robust role management.

## Dependencies & Integration
- Auth: [`src/contexts/AuthContext.tsx`](src/contexts/AuthContext.tsx:1)
- Firestore client: [`src/lib/firebase.ts`](src/lib/firebase.ts:1)
- UI: [`src/app/masterwork/claimed/page.tsx`](src/app/masterwork/claimed/page.tsx:1)

## Notes & Best Practices
- The current grant-by-email flow requires the target user to already have a `/users/{uid}` document (they must sign in once).
- Avoid relying solely on email strings long-term; use a stable role/claim for admin privileges.
- Do NOT store secrets in the repo. Use environment variables for service keys and set them in your host (Vercel).

## References
- UI page: [`src/app/masterwork/claimed/page.tsx`](src/app/masterwork/claimed/page.tsx:1)
- Firestore rules: [`firebase/firestore.rules`](firebase/firestore.rules:163)