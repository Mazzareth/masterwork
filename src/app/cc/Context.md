# Context

## Overview
- CC is the client-facing area where linked clients can chat with artists.
- Access is granted if either:
  - The user has explicit CC permission, or
  - The user has at least one linked chat summary under `/users/{uid}/sites/cc/chats` (invite acceptance flow).
- This keeps CC hidden from unrelated users while allowing invited clients to access without granting global `cc=true`.

## Behavior
- If not signed in: prompts for Google Sign-In and link back to Home.
- If checking linked access: shows a loading state while probing for `/users/{uid}/sites/cc/chats` existence.
- If signed in but unauthorized: shows "Not authorized" and link back to Home.
- If authorized: renders placeholder content (to be replaced by dashboard/chat UI).

## Dependencies
- Uses Auth context: [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)
- Firestore client: checks `/users/{uid}/sites/cc/chats` existence for linked-access gating in [page.tsx](src/app/cc/page.tsx)

## Notes
- Linting/Type safety: avoids `any` (uses concrete types or `unknown`), escapes apostrophes in JSX text to satisfy `react/no-unescaped-entities`, and includes correct React Hook dependencies.
- Chat summaries are typed and spread safely without `any` in [src/app/cc/page.tsx](src/app/cc/page.tsx).
- useSearchParams must be within a Suspense boundary for App Router CSR bailouts. The link accept page wraps its inner component with Suspense in [src/app/cc/link/page.tsx](src/app/cc/link/page.tsx).

## New (CC Enhancements)
- Commission Progress:
  - CC reads a mirrored projection from the shared chat doc at [`/chats/{chatId}`](src/lib/linking.ts:33) and displays average completion per chat on the dashboard ([page.tsx](src/app/cc/page.tsx)).
  - In-chat view shows each project with a progress bar ([page.tsx](src/app/cc/chat/[chatId]/page.tsx)).
- Updates:
  - Messages with `kind="update"` are rendered as professional alert cards in chat ([page.tsx](src/app/cc/chat/[chatId]/page.tsx:98)).
  - Owners send updates from ZZQ; clients see them highlighted here.
- Notifications / New Messages:
  - Per-chat unread is derived from per-user summary field `lastReadAt` vs `lastMessageAt` on `/users/{uid}/sites/cc/chats/{chatId}` ([ChatSummary](src/lib/linking.ts:43)).
  - CC chat view marks messages as read by setting `lastReadAt` on snapshot ([CCChatPage() messages effect](src/app/cc/chat/[chatId]/page.tsx:49)).
  - Dashboard shows a "Notifications" section listing chats with new messages and badges in the Chats list ([page.tsx](src/app/cc/page.tsx:172)).
  - Push enable button stores FCM tokens under `/users/{uid}/notificationTokens/{token}` via ([ensurePushPermissionAndToken()](src/lib/notifications.ts:23)).