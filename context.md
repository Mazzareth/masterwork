# Masterwork.app Context

Masterwork.app is a simple portal that lists whitelisted pages as buttons, gated by Firebase Auth (Google) and per-user Firestore permissions.

## Overview
- Main page renders buttons for ZZQ, CC, and InHouse.
- Visibility of each button is controlled by a UI config variable, and access is enforced by Firestore-stored permissions on the user's document.
- Authentication uses Firebase Auth (Google Sign-In).
- User document is bootstrapped on first login with default permissions: ZZQ = true, CC/InHouse = false.

## Components
- [src/lib/firebase.ts](src/lib/firebase.ts)
  - Firebase initialization with provided config.
  - Exposes `auth`, `googleProvider`, `db` singletons.
- [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)
  - Provides `useAuth()` with user, profile, permissions, loading, and `loginWithGoogle()` / `logout()`.
  - Creates or updates the Firestore user doc on first login and subscribes to live changes.
- [src/config/pages.ts](src/config/pages.ts)
  - UI visibility toggles for ZZQ/CC/InHouse buttons.
- [src/app/layout.tsx](src/app/layout.tsx)
  - Wraps the app in `AuthProvider`.
- [src/app/page.tsx](src/app/page.tsx)
  - Main portal page. Shows Login (when signed out) or permitted pages (when signed in).
- Routes (placeholders with permission checks):
  - [src/app/zzq/page.tsx](src/app/zzq/page.tsx)
  - [src/app/cc/page.tsx](src/app/cc/page.tsx)
  - [src/app/inhouse/page.tsx](src/app/inhouse/page.tsx)

## Data Model
- Collection: `users`
- Doc ID: `uid`
- Shape:
  - `profile`: `{ uid: string; email?: string | null; displayName?: string | null; photoURL?: string | null }`
  - `permissions`: `{ zzq: boolean; cc: boolean; inhouse: boolean }`
  - `createdAt`, `updatedAt`: server timestamps

## Firestore Security Rules
- Users can read and write only their own document.
- Permissions object must be a boolean map with `zzq`, `cc`, `inhouse`.
- Rules file: [firebase/firestore.rules](firebase/firestore.rules)

Inline for reference:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }
    function isOwner(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }

    function hasValidPermissions() {
      return
        (request.resource.data.permissions is map) &&
        (request.resource.data.permissions.zzq is bool) &&
        (request.resource.data.permissions.cc is bool) &&
        (request.resource.data.permissions.inhouse is bool);
    }

    match /users/{uid} {
      allow create: if isOwner(uid) && hasValidPermissions();
      allow read: if isOwner(uid);
      allow update: if isOwner(uid) && hasValidPermissions();
      allow delete: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Setup Instructions (Firebase)
1) Enable Authentication
- Firebase Console → Build → Authentication → Sign-in method → Enable Google.
- Add authorized domains: localhost (dev) and your production domain.

2) Create Firestore DB
- Firebase Console → Build → Firestore Database → Create (start in production or test).
- Open Rules tab and paste contents of [firebase/firestore.rules](firebase/firestore.rules).
- Alternatively with Firebase CLI:
  - `npm i -g firebase-tools`
  - `firebase login`
  - `firebase use masterworkapp-qg9ri` (or your project alias)
  - `firebase deploy --only firestore:rules`

3) Test the flow
- Run dev server: `npm run dev`
- Sign in with Google.
- Verify a doc appears under `users/{uid}` with default permissions granting ZZQ only.
- Toggle UI visibility via [src/config/pages.ts](src/config/pages.ts) if you need to hide a button regardless of permissions.

## Notes
- Default access: If a new user signs in and no document exists, they are initialized with ZZQ=true and CC/InHouse=false.
- UI visibility is independent from permissions; both must be true to display a button.
- Client components only. Server data access is not used here.

## References
- Next.js App Router
- Firebase Web v9+ Modular SDK
