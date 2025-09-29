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
- [src/lib/gote.ts](src/lib/gote.ts)
  - BigGote invites and chat utilities (goteChats, gote invites, per-user summaries; accept flow and send message/update helpers).
  - `createGoteInvite()`: returns `{ token, url, chatId }`; stores the invite with a unique `chatId` and creates an owner stub summary at `/users/{ownerId}/sites/gote/chats/{chatId}` with `lastMessageAt=serverTimestamp()` so the chat appears immediately at the top of the list.
  - `acceptGoteInvite()`: uses `invite.chatId` if present (avoids overwriting any existing chat) or falls back to a deterministic id for legacy invites; ensures `/goteChats/{chatId}` with participants; initializes `aiDndEnabled` from the invite; mirrors `title` to per‑user summaries; marks invite `used`; merges `permissions.gote = true` into `/users/{uid}`.
  - `sendGoteChatMessage()` / `sendGoteChatUpdate()`: write messages and mirror `lastMessageAt` onto per‑user chat summaries.
  - Inventory helpers: [`readGoteInventory()`](src/lib/gote.ts:410), [`patchGoteInventory()`](src/lib/gote.ts:446) using `/goteChats/{chatId}/inventories/{uid}` docs (`items[]`, `updatedAt`).
- [src/lib/notifications.ts](src/lib/notifications.ts)
  - [`ensurePushPermissionAndToken()`](src/lib/notifications.ts:21): Requests permission, registers `/firebase-messaging-sw.js`, obtains an FCM token with `NEXT_PUBLIC_FIREBASE_VAPID_KEY`, and persists it to `/users/{uid}/notificationTokens/{token}`.
  - [`subscribeToForegroundMessages()`](src/lib/notifications.ts:96): Foreground FCM listener for in-app toasts.
  - [`getCurrentFcmTokenIfSupported()`](src/lib/notifications.ts:112): Best-effort read of the current device token without prompting.
  - [`disablePushForThisDevice()`](src/lib/notifications.ts:147): Deletes the local FCM token and removes the corresponding `/users/{uid}/notificationTokens/{token}` doc.
- [src/lib/commission.ts](src/lib/commission.ts)
  - Commission slugs and commission chat helpers:
    - [`reserveCommissionSlug()`](src/lib/commission.ts:1) reserves `/commissionSlugs/{slug}` for the owner and writes the owner settings doc.
    - `computeCommissionChatId()` derives a stable id for (ownerId, slug, userId) commission chats.
    - `openOrEnsureCommissionChat()` creates the canonical chat with participants and minimal metadata for commission-origin chats.

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
## Updates (2025-09-27)
- Fix: Eliminated a Firestore “Missing or insufficient permissions” error that occurred when a non-owner chat participant mirrored lastMessageAt onto the owner’s per-user summary. Updated [sendChatMessage()](src/lib/linking.ts:283) and [sendChatUpdate()](src/lib/linking.ts:347) to include the required identifiers when writing to `/users/{ownerId}/sites/cc/chats/{chatId}`:
  - Payload now includes `chatId`, `ownerId`, and the participant’s `userId` (when available), alongside `lastMessageAt`.
  - This satisfies the rule constraints in [firebase/firestore.rules](firebase/firestore.rules:131) for participant-created/updated owner summaries.
- Correction: The stable chat id helper is [deterministicChatId()](src/lib/linking.ts:97) (previous docs referenced an older name).
- Validation: From a non-owner account, use `/commission/{slug}` and submit a request. The owner should now see a “New” entry in ZZQ → Notifications without any permission errors.

## Updates (2025-09-29)
- BigGote access gating fix: [acceptGoteInvite()](src/lib/gote.ts:158) now updates the nested permission ("permissions.gote") using update semantics with a fallback merge write to create the user doc if missing. This ensures the Masterwork header shows BigGote immediately after acceptance and unlocks the Invite panel for the new participant. Header filter: [Header()](src/app/Header.tsx:11).

## New (Characters & States, 2025-09-29)
- Character Profiles (player-provided at chat setup; read-only thereafter in UI)
  - Path: [goteChats/{chatId}/characters/{uid}](firebase/firestore.rules)
  - Fields: name, height, weight, dickFlaccid, dickErect, build ("Skinny|Slim|Average|Muscular|Plump"), weaknesses (text), kinks (string[])
  - Helpers: see [src/lib/gote.ts](src/lib/gote.ts)
- Character State (Narrator/AI-managed during the story; defaults to mid-levels)
  - Path: [goteChats/{chatId}/states/{uid}](firebase/firestore.rules)
  - Fields:
    - statusTags: string[] (e.g., "Stunned", "Shocked")
    - hunger: "Famished|Hungry|Sated|Full|Engorged" (default: Sated)
    - thirst: "Parched|Thirsty|Quenched|Hydrated|Saturated" (default: Quenched)
    - oxygen: "Suffocating|Winded|Steady|Oxygenated|Brimming" (default: Steady)
    - clothing: string[]
    - accessories: string[]
  - Enumerations/constants exported from [src/lib/gote.ts](src/lib/gote.ts): build options and level lists with defaults.
  - Helpers: read and patch state with additive/set/remove semantics.
- Inventory remains at [goteChats/{chatId}/inventories/{uid}](firebase/firestore.rules) with additive/set/remove operations.

Design notes:
- Characters are self-authored by the player at creation/join; states are adjusted by the Narrator (executed client-side by participants), consistent with existing permissions for profiles/inventories.
- Mid-level defaults: Hunger=Sated, Thirst=Quenched, Oxygen=Steady.