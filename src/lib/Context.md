# Context

## Overview
- Firebase client initialization for the browser.
- Ensures a single Firebase App instance (safe across Next.js Fast Refresh).
- Exposes Auth, Google provider, and Firestore instances for the app.
- Provides linking utilities for invite creation and chat wiring used by ZZQ and CC.

## Components
- [src/lib/firebase.ts](src/lib/firebase.ts)
  - Initializes the app with provided config.
  - Exports `auth`, `googleProvider`, and `db`.
- [src/lib/linking.ts](src/lib/linking.ts)
  - Utilities for the client-linking flow and chats (invite creation/acceptance, deterministic chat id, send message).
- [src/lib/notifications.ts](src/lib/notifications.ts)
  - [`ensurePushPermissionAndToken()`](src/lib/notifications.ts:21): Requests permission, registers `/firebase-messaging-sw.js`, obtains an FCM token with `NEXT_PUBLIC_FIREBASE_VAPID_KEY`, and persists it to `/users/{uid}/notificationTokens/{token}`.
  - [`subscribeToForegroundMessages()`](src/lib/notifications.ts:96): Foreground FCM listener for in-app toasts.
  - [`getCurrentFcmTokenIfSupported()`](src/lib/notifications.ts:112): Best-effort read of the current device token without prompting.
  - [`disablePushForThisDevice()`](src/lib/notifications.ts:147): Deletes the local FCM token and removes the corresponding `/users/{uid}/notificationTokens/{token}` doc.

## Design Notes
- Client-only usage: This module is loaded in client components via the consuming contexts/components.
- Singletons via `getApps().length ? getApp() : initializeApp(...)`.
- Firebase config is embedded per requirement; for production consider environment variables.
- Firestore doc path creation uses a single string path with `doc(db, path)` instead of variadic segments when deleting to avoid TS overload ambiguity with spread const tuples. See [src/lib/linking.ts](src/lib/linking.ts).

## New (Linking and Chat Enhancements)
- `sendChatUpdate` in [src/lib/linking.ts](src/lib/linking.ts):
  - Sends a highlighted update by writing a chat message with `kind: "update"` and bumps `lastUpdateAt` on the chat doc.
- Commission Progress Mirroring:
  - ZZQ writes a minimal projection of commission projects (id, title, status, completion) to `/chats/{chatId}.commissionProjects`.
  - CC clients subscribe to this field to display overall and per-project progress without exposing private ZZQ data.
- Unread Tracking:
  - `ChatSummary` extended with `lastReadAt` ([type](src/lib/linking.ts:43)). CC and ZZQ chat views set this field when messages are loaded to compute "New" states.
- Push Tokens:
  - Notification tokens stored under `/users/{uid}/notificationTokens/{token}` secured by rules ([firebase/firestore.rules](firebase/firestore.rules:121)).

## References
- Firebase Web v9+ Modular SDK docs
- Local files:
  - [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)
  - [src/config/pages.ts](src/config/pages.ts)