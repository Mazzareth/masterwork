# Context

## Overview
- Chat view for a specific linked relationship between an Artist (owner) and a Client (linked user).
- Renders messages from `/chats/{chatId}/messages` with real-time updates and a send box.
- Access is controlled by Firestore rules requiring the current user to be a participant of the canonical chat.

## Routes
- This file documents: [src/app/cc/chat/[chatId]/page.tsx](src/app/cc/chat/[chatId]/page.tsx)

## Data Model
- Canonical chat: `/chats/{chatId}` with `participants: [ownerId, userId]`
- Messages: `/chats/{chatId}/messages/{messageId}` with `{ senderId, text, createdAt }`
- Per-user chat summaries for listing on CC dashboard (not rendered here):
  - `/users/{uid}/sites/cc/chats/{chatId}`

## Behavior
- Subscribes to messages ordered by `createdAt`, autoscrolls to latest.
- Sending a message writes a document under `/chats/{chatId}/messages` and updates the parent chat’s `lastMessageAt`.
- No message edit/delete in this phase.

## Dependencies
- Auth: [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)
- Firebase App/DB: [src/lib/firebase.ts](src/lib/firebase.ts)
- Linking utilities (send): [src/lib/linking.ts](src/lib/linking.ts)

## Notes
- This view assumes that the user reached it via CC dashboard or post-accept redirect and is a chat participant per Firestore rules.
- Read receipts and unread counters are slated for a later phase.