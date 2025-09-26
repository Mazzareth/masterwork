# Firestore Rules Proposal for Invites, Linking, and CC Chat

Status
- Ready for you to paste into Firebase Console Rules or merge into [firebase/firestore.rules](firebase/firestore.rules).
- Preserves owner-only access to ZZQ data while enabling cross-tenant chat through a secure pattern.

Design Summary
- Owner’s ZZQ data (clients/projects/notes) stays private under `/users/{ownerId}/sites/zzq/**` (owner-only).
- Invites are created under owner’s subtree for secure listing by owner; non-owners can only GET an invite by token when they have the link.
  - Path: `/users/{ownerId}/sites/zzq/invites/{token}`
- Linking is represented as mirrored “views” under each participant’s user document (owner and client) to enable secure listing by path scoping.
  - Owner-facing link: `/users/{ownerId}/sites/zzq/clients/{clientId}/links/{linkId}`
  - Client-facing link: `/users/{userId}/sites/cc/links/{linkId}`
- Chats:
  - Canonical chat metadata: `/chats/{chatId}` (participants enforced by rules)
  - Messages: `/chats/{chatId}/messages/{messageId}` (access enforced via canonical chat)
  - Per-user chat summaries for secure listing in CC and owner’s view:
    - `/users/{userId}/sites/cc/chats/{chatId}`
    - `/users/{ownerId}/sites/cc/chats/{chatId}`

Copyable Rules (replace or merge carefully)

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ---------- Helpers ----------
    function isSignedIn() {
      return request.auth != null;
    }
    function isOwner(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }
    // Defensive null-safe timestamp compare
    function notExpired(ts) {
      return ts == null || request.time < ts;
    }

    // ---------- Users base doc ----------
    // User profile, permissions, etc.
    match /users/{uid} {
      allow read, write: if isOwner(uid);
    }

    // ---------- ZZQ owner-only subtree ----------
    // All ZZQ internal data remains private to the owner.
    match /users/{uid}/sites/zzq/{document=**} {
      allow read, write: if isOwner(uid);
    }

    // ---------- Invites (under owner subtree) ----------
    // Allows: 
    // - Owners to create/list/revoke their invites
    // - Any signed-in user to GET a specific active invite by token (no LIST)
    // Path is encoded into the acceptance URL: includes ownerId + token.
    match /users/{ownerId}/sites/zzq/invites/{token} {
      // Non-owners may only GET (not list), and only if invite active and not expired
      allow get: if isSignedIn()
                 && resource.data.status == "active"
                 && notExpired(resource.data.expiresAt);

      // Only the owner may list their invites panel
      allow list: if isOwner(ownerId);

      // Owner creates active invite
      allow create: if isOwner(ownerId)
        && request.resource.data.ownerId == ownerId
        && request.resource.data.status == "active";

      // Update cases:
      // - Owner can revoke (set status "revoked") or refresh metadata they own.
      // - Accepting user can mark invite used (status "used", usedBy=their uid) if active & not expired.
      allow update: if (
        // Owner revoke or owner-side maintenance
        (isOwner(ownerId) &&
          // Owner may toggle to "revoked" or keep "active". Prevent owner setting "used".
          !(request.resource.data.status == "used"))
        ||
        // Accept path: the accepting user marks it as used
        (isSignedIn()
         && resource.data.status == "active"
         && notExpired(resource.data.expiresAt)
         && request.resource.data.status == "used"
         && request.resource.data.usedBy == request.auth.uid)
      );

      // Owner may delete stale/cancelled invites
      allow delete: if isOwner(ownerId);
    }

    // ---------- Commission Slugs ----------
    match /commissionSlugs/{slug} {
      // Publicly resolvable: contains only ownerId and timestamps
      allow get, list: if true;

      // Reserve a slug: only by the owner, and only if not already taken
      allow create: if isSignedIn()
        && request.resource.data.ownerId == request.auth.uid
        && !exists(/databases/$(database)/documents/commissionSlugs/$(slug));

      // Manage slug: only by the owning artist
      allow update, delete: if isSignedIn()
        && resource.data.ownerId == request.auth.uid;
    }

    // ---------- Canonical Chats ----------
    // Canonical chat doc enforces participants and permission checks.
    match /chats/{chatId} {
      // Create requires caller to be one of the participants
      allow create: if isSignedIn()
        && (request.auth.uid in request.resource.data.participants);

      // Read/Update requires caller to be a participant of existing chat
      allow get, update: if isSignedIn()
        && (request.auth.uid in resource.data.participants);

      // We generally disallow list to avoid broad enumeration.
      allow list: if false;

      // Delete: only allow if both participants match caller? Keep simple: disallow deletes client-side.
      allow delete: if false;

      // Messages subcollection: permission derived from canonical chat
      match /messages/{messageId} {
        // Read/write allowed if caller participates in the parent chat
        allow read, create: if isSignedIn()
          && (request.auth.uid in
                get(/databases/$(database)/documents/chats/$(chatId)).data.participants);

        // Editing/deleting messages is typically restricted or disabled; keep simple:
        allow update, delete: if false;
      }
    }

    // ---------- Per-user Chat Summaries (owner and client) ----------
    // These are lightweight views (mirrors) of chat for secure per-user listing in UI.
    // Owner-side (participants may create/update the owner's summary for discoverability)
    match /users/{ownerId}/sites/cc/chats/{chatId} {
      allow read, list, delete: if isOwner(ownerId);
      allow create, update: if isOwner(ownerId) || (
        isSignedIn()
        && (request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants)
        && request.resource.data.ownerId == ownerId
        && request.resource.data.chatId == chatId
      );
    }
    // Client-side
    match /users/{uid}/sites/cc/chats/{chatId} {
      allow read, write, list: if isOwner(uid);
      allow delete: if isOwner(uid);
    }

    // ---------- Per-user Link Views ----------
    // Owner-facing link entry under specific ZZQ client
    match /users/{ownerId}/sites/zzq/clients/{clientId}/links/{linkId} {
      allow read, write, list, delete: if isOwner(ownerId);
    }

    // Client-facing link entry under CC site
    match /users/{uid}/sites/cc/links/{linkId} {
      allow read, write, list, delete: if isOwner(uid);
    }

    // ---------- Default deny ----------
    match /{document=**} {
      allow read, write: if false;
    }
  }
}

Operational Guidance
- Acceptance flow URL must encode both ownerId and token to fetch `/users/{ownerId}/sites/zzq/invites/{token}`.
- On accept (client side):
  1) GET invite; verify status active and not expired
  2) Create canonical chat `/chats/{chatId}` with participants [ownerId, userId]
  3) Create per-user chat summaries:
     - `/users/{ownerId}/sites/cc/chats/{chatId}`
     - `/users/{userId}/sites/cc/chats/{chatId}`
  4) Create mirrored link views:
     - `/users/{ownerId}/sites/zzq/clients/{clientId}/links/{linkId}`
     - `/users/{userId}/sites/cc/links/{linkId}`
  5) Mark invite used (status="used", usedBy=userId)
- Owner revoke:
  - Update invite to "revoked" or unlink by removing mirrored link views and per-user chat summary; canonical chat remains or can be logically disabled (do not delete for audit).

Indexes to Add (Firestore)
- Chats: index on lastMessageAt (for sorting) - single-field
- Per-user chat summaries:
  - `/users/{uid}/sites/cc/chats` — single-field indexes typically suffice (lastMessageAt)
- If you query additional fields, add composite indexes as prompted.

Security Notes
- No cross-user access to `/users/{ownerId}/sites/zzq/**`.
- Listing invites is only allowed to the owner because `ownerId` is part of the path variable.
- Non-owners can only GET a specific invite doc by token (with active + not expired guard).
- Chat enumeration is prevented by disallowing `list` on `/chats`.
- Per-user listing relies on mirrored data under `/users/{uid}/sites/cc/chats`.

Next Steps (Owner)
- Paste this into the Firebase Console Rules or merge into [firebase/firestore.rules](firebase/firestore.rules)
- Deploy:
  - Firebase Console → Firestore → Rules → Publish
  - or Firebase CLI: `firebase deploy --only firestore:rules`