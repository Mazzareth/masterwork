# Firebase Firestore Rules (Required)

## Overview
- This application stores one document per user at `users/{uid}` containing a `profile` object and a `permissions` object.
- The required security posture is:
  - Only the signed-in owner may read their own document.
  - Only the owner may create or update their document, and writes must validate the schema.
  - All other collections/documents are denied by default.

## Required Firestore Rules
- Keep this section in sync with [firebase/firestore.rules](firebase/firestore.rules).

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }
    function isOwner(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }

    function hasValidProfile() {
      return
        (request.resource.data.profile.uid is string) &&
        (request.resource.data.profile.email is string || request.resource.data.profile.email == null) &&
        (request.resource.data.profile.displayName is string || request.resource.data.profile.displayName == null) &&
        (request.resource.data.profile.photoURL is string || request.resource.data.profile.photoURL == null);
    }

    function hasValidPermissions() {
      return
        (request.resource.data.permissions is map) &&
        (request.resource.data.permissions.zzq is bool) &&
        (request.resource.data.permissions.cc is bool) &&
        (request.resource.data.permissions.inhouse is bool);
    }

    // Users collection: each user can read/write only their own document.
    match /users/{uid} {
      allow create: if isOwner(uid) && hasValidPermissions() && hasValidProfile();
      allow read: if isOwner(uid);
      allow update: if isOwner(uid) && hasValidPermissions() && hasValidProfile();
      allow delete: if false;
    }

    // Deny everything else by default
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Data Model Contract
- The app code (see [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)) expects a document shaped like:

```json
{
  "profile": {
    "uid": "USER_UID",
    "email": "user@example.com",
    "displayName": "User Name",
    "photoURL": "https://example.com/photo.jpg"
  },
  "permissions": {
    "zzq": true,
    "cc": false,
    "inhouse": false
  },
  "createdAt": "<serverTimestamp>",
  "updatedAt": "<serverTimestamp>"
}
```

## Deploying Rules
- Firebase Console: Firestore → Rules → paste the contents above, or the file at [firebase/firestore.rules](firebase/firestore.rules).
- Firebase CLI:
  - npm i -g firebase-tools
  - firebase login
  - firebase use masterworkapp-qg9ri
  - firebase deploy --only firestore:rules

## Verification Checklist
- Signed-out user cannot read or write anything.
- Signed-in user can read their own `users/{uid}` document.
- Signed-in user cannot read or write other users’ documents.
- Writes that omit any of `permissions.zzq | permissions.cc | permissions.inhouse` are rejected.
- Writes with an invalid or missing `profile` shape are rejected.

## Sync Policy
- Source of truth is [firebase/firestore.rules](firebase/firestore.rules).
- When updating rules, update that file first, then copy the changes into this document’s “Required Firestore Rules” section.