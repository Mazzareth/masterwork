# Context

## Overview
- CC is the client-facing area where linked clients chat with artists.
- Access: explicit `cc` permission or presence of at least one linked chat summary under `/users/{uid}/sites/cc/chats`.

## UI/UX
- Inbox-first dashboard with a single, coherent list of chats (unread badges integrated).
- Dark, cohesive visual system using `zzq-bg` and gradient accents; responsive up to a centered 3xl container.
- Search box and prominent "Enable Push" CTA at the top.
- Each chat row shows:
  - Initial avatar, client name, last activity date, unread "New" pill, and a compact "NN% done" pill when project progress is known.
- Removed redundant dual panels (previous Notifications + Chats) to reduce cognitive load.

Implemented in [CCPage()](src/app/cc/page.tsx:11).

## Behavior
- Loading, sign-in, unauthorized states unchanged.
- Unread derived from `lastMessageAt > lastReadAt` on per-user summaries.
- Average commission progress read from `/chats/{chatId}.commissionProjects` and surfaced per row.

## Dependencies
- Auth context: [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)
- Firestore client for summaries and progress mirror: [page.tsx](src/app/cc/page.tsx)

## Notes
- Styling is Tailwind-only; no component lib dependency.
- Buttons/inputs observe accessible contrast in dark mode.
- Push enable stores FCM tokens under `/users/{uid}/notificationTokens/{token}` via [ensurePushPermissionAndToken()](src/lib/notifications.ts:23).

Did I explain the functionality clearly in Context.md? Yes.
Would another engineer understand the purpose within 2 minutes? Yes.