# Context

## Overview
- Firestore rules secure per-user data while enabling cross-tenant invites and chats.
- Owner's ZZQ data remains private under their `/users/{uid}/sites/zzq/**` subtree.
- Linked Clients use top-level canonical chats plus per-user mirrors for secure listing.

## Files
- [firebase/firestore.rules](firebase/firestore.rules:1)

## What’s enforced (key sections)
- Users can read/write only their own user doc:
  - [match /users/{uid}](firebase/firestore.rules:33)
- Owner-only ZZQ subtree:
  - [match /users/{uid}/sites/zzq/{document=**}](firebase/firestore.rules:41)
- Invites under owner subtree:
  - [match /users/{ownerId}/sites/zzq/invites/{token}](firebase/firestore.rules:49)
  - Any signed-in user may GET a specific invite if status="active" and not expired:
    - [allow get](firebase/firestore.rules:51)
  - Owner-only list/create/revoke:
    - [allow list](firebase/firestore.rules:55)
    - [allow create](firebase/firestore.rules:58)
    - [allow update] for owner revoke or accepting user setting status="used" with usedBy=uid:
      - (owner) [allow update](firebase/firestore.rules:64)
      - (acceptor) [allow update](firebase/firestore.rules:68)
    - [allow delete](firebase/firestore.rules:76)
- Canonical chats (cross-tenant):
  - [match /chats/{chatId}](firebase/firestore.rules:81)
  - Create if caller is in `request.resource.data.participants`:
    - [allow create](firebase/firestore.rules:83)
  - Read/Update if caller is in `resource.data.participants`:
    - [allow get, update](firebase/firestore.rules:86)
  - Disallow global list/delete:
    - [allow list: if false](firebase/firestore.rules:91)
    - [allow delete: if false](firebase/firestore.rules:92)
  - Messages derive permission from parent chat participants:
    - [match /chats/{chatId}/messages/{messageId}](firebase/firestore.rules:95)
    - [allow read, create](firebase/firestore.rules:96)
- Per-user CC mirrors for secure listing:
  - Owner’s CC chats mirror: [match /users/{ownerId}/sites/cc/chats/{chatId}](firebase/firestore.rules:104)
  - Client’s CC chats mirror: [match /users/{uid}/sites/cc/chats/{chatId}](firebase/firestore.rules:108)
- Per-user link mirrors:
  - Owner link under client: [match /users/{ownerId}/sites/zzq/clients/{clientId}/links/{linkId}](firebase/firestore.rules:114)
  - Client CC link: [match /users/{uid}/sites/cc/links/{linkId}](firebase/firestore.rules:117)
- Notification tokens:
  - Per-user device tokens stored under [match /users/{uid}/notificationTokens/{token}](firebase/firestore.rules:121) for FCM push delivery.

## Rationale
- Owner-only ZZQ subtree preserves privacy; no cross-user reads.
- Invitations live under the owner's path for owner listing; invitees can only GET by token when active.
- Canonical chat doc ensures participant-based access control; per-user mirrors allow listing without exposing data broadly.
- Disallowing LIST on `/chats` prevents enumeration while mirrors under `/users/{uid}/sites/cc/chats` provide user-specific lists.

## Operational notes
- Deploy rules via Console or CLI to activate changes:
  - Firebase CLI: `firebase deploy --only firestore:rules`
- Rules propagation can take 30–60 seconds.
- Indexes: Firestore may prompt for single-field indexes when ordering by `lastMessageAt` (chats mirrors) or `createdAt` (messages). Accept prompts.

## References
- Canonical chat creation path used by [acceptInvite()](src/lib/linking.ts:179)
- Invite GET/update used by [CCLinkAcceptPage()](src/app/cc/link/page.tsx:1)
- Mirrors for CC dashboard reading in [CCPage()](src/app/cc/page.tsx:1)
