# Context

## Overview
- Client-side authentication context providing Google Sign-In, user profile, and permissions from Firestore.
- Bootstraps a user document on first login with default permissions (ZZQ = true, CC/InHouse = false).
- Subscribes to live changes of the user document to keep permissions fresh across the app.

## Components
- [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)
  - Exposes `useAuth()` with `user`, `profile`, `permissions`, `loading`, `loginWithGoogle()`, `logout()`.
  - Persists and syncs:
    - `profile`: uid, email, displayName, photoURL
    - `permissions`: `{ zzq: boolean; cc: boolean; inhouse: boolean }`
- [src/lib/firebase.ts](src/lib/firebase.ts)
  - Firebase singletons: `auth`, `googleProvider`, `db`.

## Design Notes
- Default permission is whitelisted access to ZZQ only for new users.
- Rules enforce users can only read/write their own document, while the UI uses permissions to drive visibility and access.
- Provider is mounted at the root layout to cover all routes.
- Migration-safe writes: when updating an existing user doc, the provider includes `permissions` if it is missing in the same merge write as the profile update. This satisfies rules and avoids “missing or insufficient permissions” errors on older documents.
- On auth changes, any active user-doc `onSnapshot` subscription is torn down before handling the new state to prevent “missing or insufficient permissions” errors after sign-out.

## References
- Consumed in:
  - [src/app/layout.tsx](src/app/layout.tsx)
  - [src/app/page.tsx](src/app/page.tsx)
  - [src/app/zzq/page.tsx](src/app/zzq/page.tsx)
  - [src/app/cc/page.tsx](src/app/cc/page.tsx)
  - [src/app/inhouse/page.tsx](src/app/inhouse/page.tsx)

## Type Safety (2025-09)
- UserDoc timestamps now typed as Timestamp; removed any usage.
- Write payloads to Firestore avoid explicit type annotations so serverTimestamp() is accepted without any; see [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx).