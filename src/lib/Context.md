# Context

## Overview
- Firebase client initialization for the browser.
- Ensures a single Firebase App instance (safe across Next.js Fast Refresh).
- Exposes Auth, Google provider, and Firestore instances for the app.

## Components
- [src/lib/firebase.ts](src/lib/firebase.ts)
  - Initializes the app with provided config.
  - Exports `auth`, `googleProvider`, and `db`.

## Design Notes
- Client-only usage: This module is loaded in client components via the consuming contexts/components.
- Singletons via `getApps().length ? getApp() : initializeApp(...)`.
- Firebase config is embedded per requirement; for production consider environment variables.

## References
- Firebase Web v9+ Modular SDK docs
- Local files:
  - [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)
  - [src/config/pages.ts](src/config/pages.ts)