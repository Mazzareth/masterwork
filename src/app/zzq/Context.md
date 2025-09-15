# Context

## Overview
- ZZQ is a focused, lightweight CRM for commissions workflow.
- UX-first design with a persistent, scrollable, searchable Clients list on the left, a slide-in Client View, and a nested slide-out Commission panel.
- All data is stored per-user in Firestore under the user profile in a site-specific subtree.
- New: Client linking tools allow owners to generate invitation links that let clients chat in CC. Internal ZZQ data remains private.

## UI/Flow
- Left panel (sticky):
  - Search input (client name or discord username).
  - Client cards show:
    - Display name (primary)
    - Discord username (secondary, italic, subdued)
  - Quick Add composer (promptless):
    - Toggle with the header button or Ctrl/Cmd+N.
    - Single-line parse: “Name @username” → displayName + optional username chip.
    - Enter to create, Esc to cancel. On create, the new client is auto-selected and highlighted.
- Client View (slides in from the right, keeps clients list visible):
  - Header: Client name + username, actions: “Link Client” and “Close”.
  - Linking panel (toggle):
    - “Generate Link” creates an invite and shows a copyable URL.
    - Active Invites list with “Revoke”.
    - Linked Users list with “Chat” and “Unlink”.
    - Inline “Client Chat” view appears when a linked user is selected:
      - Real-time messages (owner ↔ selected linked user) from `/chats/{chatId}/messages`
      - Send box with optimistic UI
  - Two columns:
    - Projects: list with quick-complete checkbox and quick-add.
    - Notes: aggregated list across all projects; opens Commission to edit inline.
- Commission panel (nested slide-out from the right):
  - Live-bound fields: Title, Status, Completion slider.
  - Notes quick-add; inline editable notes with on-blur save.
- Client management:
  - Inline edit in Clients list (pencil icon): click to edit "Name @username" inline. Enter to save, Esc to cancel, or use Save/Cancel buttons. Persists displayName, username to Firestore.
  - Delete client (trash icon): asks for confirmation, then cascades deletion of client links, projects, project notes, and invites referencing the client. UI updates optimistically.

## Data Model (Firestore)
- Root: `/users/{uid}` (managed by AuthProvider bootstrap)
- ZZQ subtree:
  - Clients: `/users/{uid}/sites/zzq/clients/{clientId}`
  - Projects: `/users/{uid}/sites/zzq/clients/{clientId}/projects/{projectId}`
  - Notes: `/users/{uid}/sites/zzq/clients/{clientId}/projects/{projectId}/notes/{noteId}`
  - Invites (owner-only listing, token-based GET by invitees):
    - `/users/{uid}/sites/zzq/invites/{token}` (created by owner)
- Cross-tenant chat (separate collections; see docs):
  - Canonical: `/chats/{chatId}` with `participants: [ownerId, userId]`
  - Per-user summaries: `/users/{uid}/sites/cc/chats/{chatId}`

## Security
- ZZQ subtree remains owner-only (no cross-user reads).
- Invites: owner can list; invitees can GET a specific active, non-expired token.
- Chats/messages gated by participants; listing via per-user summaries.

## Components
- Page: [src/app/zzq/page.tsx](src/app/zzq/page.tsx)
  - Live clients/projects/notes, commission panel, and the new client-linking panel (invite generation).
- Styles: [src/app/globals.css](src/app/globals.css)

## Dependencies
- Auth: [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)
- Firebase App/DB: [src/lib/firebase.ts](src/lib/firebase.ts)
- Linking utilities: [src/lib/linking.ts](src/lib/linking.ts)

## Notes
- Internal Projects/Notes are never exposed to CC; only minimal identity and chat flow are shared via invites.
- Panels use `pointer-events-none` when closed to avoid intercepting clicks; overflow is managed at the page wrapper.
- Layout padding: ZZQ now uses a safe-area-aware top padding via `--zzq-top-pad` on `.zzq-bg` and a matching viewport height helper `.zzq-viewport` to keep panels full-height without clipping. See [src/app/globals.css](src/app/globals.css) and [ZZQPage()](src/app/zzq/page.tsx:112).

## Type Safety (2025-09)
- Firestore timestamps typed as Timestamp across Client/Project/Note models.
- Snapshot mappings cast to concrete Doc shapes; aggregated note sorting uses Timestamp.seconds.
- Eliminated `any` for invites and links: casts to `Partial<InviteDoc>` and `Partial<ClientLink>` from [src/lib/linking.ts](src/lib/linking.ts).
- React Hooks dependencies include `selected` where referenced to satisfy `react-hooks/exhaustive-deps`.

## Context Menu (Right-click)

- Added custom context menus to improve quick actions:
  - Clients list item: Open, Edit, Delete
  - Projects list row: Open, Rename, Delete
  - Notes (Aggregated list): Open note, Edit note, Delete note
- Interaction:
  - Right-click on a client/project/note to open the menu at cursor.
  - Menu clamps to the viewport and closes on: click outside, ESC, scroll, or resize.
- Implementation:
  - Lightweight state-driven overlay rendered via React Portal into document.body (avoids sidebar stacking/overflow clipping and ensures it overlays both the Clients panel and the main panes).
  - Overlay is fixed-position with high z-index and guarded against accidental outside-click close when clicking inside the menu.
  - Event wiring uses onContextMenu handlers and prevents the native browser menu.
  - Viewport clamping in [openContextMenu()](src/app/zzq/page.tsx:418) uses a fixed item count of 3 across menu kinds to estimate height correctly for positioning. If you change menu items in the UI, update this count or compute it dynamically.
- Scope:
  - Right-click is enabled for the Clients panel cards, Projects list rows, and Aggregated Notes list rows.
  - Commission panel’s per-project Notes editor does not have a right-click menu (can be enabled later).
- File:
  - [src/app/zzq/page.tsx](src/app/zzq/page.tsx)