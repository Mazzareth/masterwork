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

## Design Notes
- Client-only usage: This module is loaded in client components via the consuming contexts/components.
- Singletons via `getApps().length ? getApp() : initializeApp(...)`.
- Firebase config is embedded per requirement; for production consider environment variables.
- Firestore doc path creation uses a single string path with `doc(db, path)` instead of variadic segments when deleting to avoid TS overload ambiguity with spread const tuples. See [src/lib/linking.ts](src/lib/linking.ts).

## References
- Firebase Web v9+ Modular SDK docs
- Local files:
  - [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)
  - [src/config/pages.ts](src/config/pages.ts)