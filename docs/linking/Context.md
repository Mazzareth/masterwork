# Linking + CC Chat – Implementation Plan (Context)

Overview
- Objective: Allow ZZQ owners to link a client in their ZZQ to another user's account, enabling chat and updates in CC. Notes and internal project data never leave the owner's ZZQ.
- Scope: New invite-based linking, many-to-many (one CC user can be linked to multiple artists/clients), and a real-time chat per linked relationship.

Roles
- Owner (Artist): The user under whose `/users/{ownerId}/sites/zzq/**` the client lives. Only owner can generate invites and revoke links for their ZZQ client.
- Linked Client (Customer): Any authenticated user who accepts an invite. They see chats for all linked clients in CC.

Design Principles
- No cross-user reads of ZZQ trees. Linked clients never read `/users/{ownerId}/sites/zzq/**`. Sharing happens via dedicated cross-tenant chat collections.
- Invite links over manual codes for UX and security. Links expire and become single-use upon acceptance.
- Denormalize small bits (client display name) for fast CC lists; keep ZZQ as the source of truth for internal data.

Firestore Collections (new)
- clientInvites
  - Purpose: Time-limited invites created by an owner to link a ZZQ client to a client user.
  - Path: `/clientInvites/{token}`
  - Fields:
    - token: string (doc id, random)
    - ownerId: string
    - clientRef: string (path "/users/{ownerId}/sites/zzq/clients/{clientId}")
    - clientId: string (redundant for convenience)
    - clientDisplayName: string (denormalized for CC display pre-link)
    - createdAt: Timestamp
    - expiresAt: Timestamp
    - usedAt?: Timestamp
    - usedBy?: string (uid)
    - status: "active" | "expired" | "used" | "revoked"
- clientUserLinks
  - Purpose: Many-to-many mapping from client to linked user.
  - Path: `/clientUserLinks/{linkId}`
  - Fields:
    - ownerId: string
    - clientRef: string
    - clientId: string
    - clientDisplayName: string
    - userId: string (linked user's uid)
    - createdAt: Timestamp
    - revokedAt?: Timestamp
    - revokedBy?: string
- chats
  - Purpose: Per-linked relationship chat container.
  - Path: `/chats/{chatId}`
  - Fields:
    - ownerId: string
    - userId: string (linked user)
    - clientRef: string
    - clientId: string
    - participants: string[] = [ownerId, userId]
    - lastMessageAt: Timestamp
    - createdAt: Timestamp
    - unread: { [uid: string]: number } (optional)
  - Subcollection: `/chats/{chatId}/messages/{messageId}`
    - senderId: string
    - text: string
    - createdAt: Timestamp
    - readBy?: string[]

ChatId Strategy
- Deterministic: `chatId = sha256(ownerId + ":" + clientId + ":" + userId)` to prevent duplicates. If not found on accept, create; otherwise reuse.

URLs and Routes (Next.js)
- /cc/link?token=... → Link acceptance flow (validates token, signs in if needed, creates clientUserLink + chat, marks invite used)
- /cc → CC dashboard listing all chats for `user.uid`
- /zzq → existing; add “Link Client” UI and management under the client detail pane

ZZQ UI Additions
- In client detail header: “Link Client” button (opens modal)
  - Modal shows: Generate Invite (Create), Active Invites (list + revoke), Linked Users (list + revoke)
- Copyable invite URL: `${origin}/cc/link?token={token}`

CC UI Additions
- Dashboard: list chats (clientDisplayName + artist name), unread counts, last message preview
- Chat window: real-time messages, send box, read receipts (optional phase 2)
- Link acceptance page: validates token, explains who is sharing what, Confirm button

Firestore Rules (high level)
- Keep owner-only access to `/users/{ownerId}/sites/zzq/**` (unchanged).
- Allow any signed-in user to read/write:
  - `/clientInvites/{token}`:
    - read: if request.auth != null AND (resource.data.status == "active")
    - write: owner creates; updates to "used"/"revoked" only by owner or the accepting user as appropriate
  - `/clientUserLinks/{linkId}`:
    - read: if request.auth.uid in [resource.data.ownerId, resource.data.userId]
    - write: create only when request.auth.uid == resource.data.userId with a valid invite OR when owner revokes (set revokedAt)
  - `/chats/{chatId}` and `/chats/{chatId}/messages/{messageId}`:
    - read/write: if request.auth.uid in resource.data.participants (for chat doc) AND for messages parent chat allows the user
- Indexes:
  - clientUserLinks: composite index on (userId asc, createdAt desc)
  - chats: composite index on (participants array-contains, lastMessageAt desc) or query by userId OR ownerId fields for simpler indexes

Flows
- Owner generates invite (ZZQ)
  - Create `/clientInvites/{token}` with 7-day expiry (configurable)
- Client clicks link (CC)
  - If not signed in → prompt sign-in → redirect back
  - Validate invite: status active, not expired
  - Create or reuse `/clientUserLinks/{linkId}` and `/chats/{chatId}`
  - Mark invite used (usedAt, usedBy, status="used")
- Messaging
  - Both sides subscribe to `/chats/{chatId}/messages` ordered by createdAt
  - Sending adds message with serverTimestamp()
  - Optional: maintain unread counts per chat

Data Privacy
- Only minimal denormalized client identity is visible in CC (e.g., display name). No projects or internal notes are shared.

Phased Delivery
- Phase 1: Invites, link acceptance, single chat per link, basic messaging
- Phase 2: Linked users list and revoke, unread counters, read receipts, notifications

Acceptance Criteria (Phase 1)
- Owner can create a link for any of their clients
- Client can accept via URL and sees a chat for each linked client under CC
- Owner and client can exchange messages in real time
- No access to `/users/{ownerId}/sites/zzq/**` by the linked client

Owner Tasks (you can do now)
- Approve the high-level rules plan and be ready to paste the concrete rules when provided
- Confirm we can add top-level collections: clientInvites, clientUserLinks, chats
- Optional: enable email notifications provider (future)

Engineering Tasks (sequenced)
- Add rules entries and deploy (we will provide the exact rules block)
- CC: implement `/cc/link` page and dashboard + chat
- ZZQ: implement “Link Client” modal and invite management
- Messaging: wire real-time listeners and sending
- QA: security tests (negative access), expiry, single-use, duplicate link prevention

Notes
- We intentionally avoid mirroring projects/notes; only chat moves across tenants.
- Deterministic chatId prevents duplicates if multiple invites are created/accepted for the same relationship.