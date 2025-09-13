# Context

## Overview
- Firestore security rules for Masterwork.app.
- Enforces per-user access to their own document in `users/{uid}` and validates the `permissions` object structure.
- Adds site-specific nested data for ZZQ CRM under each user: `/users/{uid}/sites/zzq/**`.

## Files
- [firebase/firestore.rules](firebase/firestore.rules)

## Rules Summary
- Users may read their own user document: `/users/{uid}`.
- Users may create/update their own user document only if both:
  - `permissions` is a map containing boolean `zzq`, `cc`, and `inhouse`, and
  - `profile` has valid shape (`uid` string; `email`, `displayName`, `photoURL` nullable strings).
- ZZQ CRM subtree (per-user) is permitted for the owner:
  - `/users/{uid}/sites/zzq/clients/{clientId}`
  - `/users/{uid}/sites/zzq/clients/{clientId}/projects/{projectId}`
  - `/users/{uid}/sites/zzq/clients/{clientId}/notes/{noteId}`
  - All read/create/update/delete allowed only if `request.auth.uid == uid`.
- All other reads/writes are denied by default.

## Data Model Notes (ZZQ)
- Clients hold artist’s customers; fields include `displayName`, optional `username` (Discord handle), and timestamps.
- Projects and Notes are always nested under a specific Client, ensuring CRM linkage to a Client.
- The parent `sites/zzq` document is not required to exist for its subcollections to function, but can be created for metadata if desired.

## Deploy
- Firebase Console: Firestore → Rules → Paste contents of [firebase/firestore.rules](firebase/firestore.rules)
- Or Firebase CLI:
  - `npm i -g firebase-tools`
  - `firebase login`
  - `firebase use masterworkapp-qg9ri`
  - `firebase deploy --only firestore:rules`