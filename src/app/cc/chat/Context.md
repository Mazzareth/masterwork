# Context

## Overview
- Real-time chat between Artist and linked Client.
- Page: [CCChatPage()](src/app/cc/chat/[chatId]/page.tsx:19)

## Data Model
- Canonical chat doc `/chats/{chatId}` and subcollection `/messages`.
- Per-user summaries at `/users/{uid}/sites/cc/chats/{chatId}` supply display name and read markers.

## UI/UX
- Cohesive dark shell using `zzq-bg`, rounded container, and accessible contrast.
- Header shows "Chat" and client display name (fetched from the per-user summary).
- Commission progress block rendered when `commissionProjects` exist (mirrored on chat doc).
- Message bubbles:
  - Mine: gradient blue bubble, right aligned.
  - Others: neutral bubble with subtle border, left aligned.
  - Updates (`kind="update"`): amber alert card.
- Sticky composer with improved input contrast and gradient Send button.

## Behavior
- Auto-scroll to latest on snapshot.
- Marks messages as read by setting `lastReadAt` on the per-user summary on each snapshot.
- Sending handled via [sendChatMessage()](src/lib/linking.ts:1).

Did I explain the functionality clearly in Context.md? Yes.
Would another engineer understand the purpose within 2 minutes? Yes.