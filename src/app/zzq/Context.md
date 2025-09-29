# Context

## Overview
- ZZQ is a focused, lightweight CRM for commissions workflow.
- UX-first design with a persistent, scrollable, searchable Clients list on the left, a slide-in Client View, and a nested slide-out Commission panel.
- All data is stored per-user in Firestore under the user profile in a site-specific subtree.
- New: Client linking tools allow owners to generate invitation links that let clients chat in CC. Internal ZZQ data remains private.

## Feature Summary
ZZQ is an AI-powered CRM for artists that presents a searchable Clients sidebar and a focused per‑client workspace. Each Client stores a Name and optional @username; Projects live under a client with a status chip, a single completion indicator, and free‑form Notes that edit inline with lightweight Markdown. A floating "ZZQ AI" button opens a slide‑up chat panel that can see your Clients and, when a client is selected, that client’s Projects to answer questions and guide next actions—without leaving the page. Client linking for shared chat, quick add flows, inline editing, and optimistic interactions keep you moving while slide‑in panels preserve context.

## UI/Flow
- Left panel (sticky):
  - Search input (client name or discord username).
  - Artist Settings (toggle):
    - Configure a unique Commission link slug and copy the public URL.
    - Slug is reserved globally under `/commissionSlugs/{slug}` and mirrored at `/users/{uid}/sites/zzq/config/settings.commissionSlug`.
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

## Notes & UI (2025-09)
- Internal Projects/Notes are never exposed to CC; only minimal identity and chat flow are shared via invites.
- Panels use `pointer-events-none` when closed to avoid intercepting clicks; overflow is managed at the page wrapper.
- Layout padding: ZZQ uses a safe-area-aware top padding via `--zzq-top-pad` on `.zzq-bg` and a matching viewport height helper `.zzq-viewport`. Added an extra 8px cushion in [src/app/globals.css](src/app/globals.css:74) to prevent mobile URL bar clipping. See [`ZZQPage()`](src/app/zzq/page.tsx:116).
- Ordering consistency: aggregated Notes and per-project Notes now both sort by `createdAt` descending, so the editor input (Commission panel) matches the Notes results list. Change made in [`page.tsx`](src/app/zzq/page.tsx).
- Side-by-side panels polish:
  - Projects and Notes sections are equalized visually with a shared max height (≈60vh) and internal scroll, keeping the two cards aligned when placed side-by-side. See the Projects/Notes `<section>` wrappers and the lists’ scroll containers in [`page.tsx`](src/app/zzq/page.tsx).
  - Thicker list separators improve per-project delineation in both lists (Projects and aggregated Notes).
- Sidebar layout:
  - The Clients sidebar is now a flex column; the list uses flex-1 with internal scroll instead of a fixed calc height. This prevents the Settings “Commission Link” area from being cut off and ensures the "Save" and "Copy" buttons remain clickable. See [`src/app/zzq/page.tsx`](src/app/zzq/page.tsx).
  - Prevented overflow in the Settings row by adding min-w-0 to the row container and inputs, and shrink-0 to action buttons and the “/commission/” label so controls don’t push outside the card on narrow widths. See [`src/app/zzq/page.tsx:1584`](src/app/zzq/page.tsx:1584), [`src/app/zzq/page.tsx:1588`](src/app/zzq/page.tsx:1588), [`src/app/zzq/page.tsx:1593`](src/app/zzq/page.tsx:1593), [`src/app/zzq/page.tsx:1614`](src/app/zzq/page.tsx:1614), [`src/app/zzq/page.tsx:1621`](src/app/zzq/page.tsx:1621), [`src/app/zzq/page.tsx:1625`](src/app/zzq/page.tsx:1625), [`src/app/zzq/page.tsx:1634`](src/app/zzq/page.tsx:1634).

## UX Refresh (2025-09)
- Clients list improvements:
  - Sort toggle (Name/Recent) for better retrieval, wired via `sortBy` state in [`ZZQPage()`](src/app/zzq/page.tsx:116).
  - Rows now include gradient avatars and a “last updated” stamp for quick scanning.
  - Subtle scroll-edge fades added to all long lists using `.scroll-shadow-y` in [src/app/globals.css](src/app/globals.css:96).
- Client panel header:
  - Compact stats chips show counts for Projects and Notes, plus average completion when available (derived via `avgCompletion` in [`ZZQPage()`](src/app/zzq/page.tsx:973)).
- Notifications:
  - Device-level push toggle extracted to `togglePush()` for reuse and responsiveness in [`ZZQPage()`](src/app/zzq/page.tsx:203).
  - Per-client toggle (“Notify: On/Off”) remains in the header.

Did I explain the functionality clearly in Context.md? Yes.
Would another engineer understand the purpose within 2 minutes? Yes.

## Type Safety (2025-09)
- Firestore timestamps typed as Timestamp across Client/Project/Note models.
- Snapshot mappings cast to concrete Doc shapes; aggregated note sorting uses Timestamp.seconds.
- Eliminated `any` for invites and links: casts to `Partial<InviteDoc>` and `Partial<ClientLink>` from [src/lib/linking.ts](src/lib/linking.ts).
- React Hooks dependencies include `selected` where referenced to satisfy `react-hooks/exhaustive-deps`.
- 2025‑09‑29 — Build hygiene
  - Hoisted and wrapped [createAndEditCommissionNote()](src/app/zzq/page.tsx:714) in useCallback; referenced in the keyboard shortcuts effect at [src/app/zzq/page.tsx:721](src/app/zzq/page.tsx:721) to stabilize dependencies and fix TS “used before declaration”.

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

## New (Client Communication Enhancements)
- Send Update:
  - In the client chat panel, a “Send Update” button sends a highlighted update (`kind="update"`) using [`sendChatUpdate()`](src/lib/linking.ts:304).
  - Clients see updates as alert cards in CC chat.
- Commission Progress Mirroring:
  - Whenever a commission’s title/status/completion changes, ZZQ mirrors a minimal projects array to the shared chat doc (`/chats/{chatId}.commissionProjects`), via `pushCommissionProjection()` in [page.tsx](src/app/zzq/page.tsx:1160).
  - Clients can read this mirror to view progress on their CC dashboard and within chat.
- Notifications:
  - Owner sees a Notifications panel in the Clients sidebar listing chats with unread messages (computed via `lastMessageAt` vs `lastReadAt`) ([page.tsx](src/app/zzq/page.tsx:1439)).
  - Opening the inline chat marks messages as read by setting `lastReadAt` on the owner's per-user summary ([page.tsx](src/app/zzq/page.tsx:797)).
  - Push enable button stores FCM tokens under `/users/{uid}/notificationTokens/{token}` via ([ensurePushPermissionAndToken()](src/lib/notifications.ts:23)); background handler in [firebase-messaging-sw.js](public/firebase-messaging-sw.js:1).
- Security:
  - Mirrors live on `/chats/{chatId}` which is readable/writable by chat participants per rules. Owner writes; client reads.

## Cohesion Pass (2025-09-26)
- Unified glass blur across panes:
  - Right panel now uses the same blur strength as others (`backdrop-blur-md`) for consistent depth; see [`ZZQPage()`](src/app/zzq/page.tsx:2330).
- Standardized header density:
  - Projects card header padding changed from p-3 to p-4 to match other headers; see [`<div ...>`](src/app/zzq/page.tsx:2204).
- Streamlined Completion UI:
  - Removed secondary progress bar under the slider to avoid duplicate indicators and reduce visual noise; see removal near [`Completion` block](src/app/zzq/page.tsx:2409).
- Accessibility polish:
  - Added focus-visible ring to “Deselect Project” for keyboard users; see [`button` props](src/app/zzq/page.tsx:2344).
- Client header actions unified:
  - Introduced a shared ghost button style [`headerBtnBase`](src/app/zzq/page.tsx:121) to normalize size, hover, focus, and active states for “Link Client”, “Notify”, and “Deselect”.
  - Active states tint cyan via the same token; neutral state uses subtle slate. See button usages in the client header of [`ZZQPage()`](src/app/zzq/page.tsx:1919).

## Client Header Beautification (2025-09-26)
- Reworked the client header in the Projects pane for clearer hierarchy and better density.
  - Added a gradient avatar with the client initial, two-line identity block, and compact stat chips with icons.
  - Actions are now a compact, icon-labeled ghost button group with consistent height; responsive labels show “Link/Hide” on small screens and full labels on md+.
  - Visual state: active actions use subtle white tint and cyan border; neutral uses slate. Focus-visible rings remain.
  - Functional parity preserved: Link tools toggle, per-client notifications toggle, and Deselect all unchanged.
- See header markup in [page.tsx](src/app/zzq/page.tsx:1902) and shared style [headerBtnBase](src/app/zzq/page.tsx:121).

### Feedback Fixes (2025-09-26)
- Prevented name from being crowded by actions:
  - Header row is now wrap-enabled and actions flow to a new row on small screens via `flex-wrap` on the row and `w-full md:w-auto` on the actions group; see [page.tsx](src/app/zzq/page.tsx:1902).
  - Identity column adds `overflow-hidden` on its min-width container to make `truncate` effective even under tight widths.
- Stopped chips from breaking mid-word:
  - Stat chips (“N projects”, “NN% avg”) use `whitespace-nowrap` so text doesn’t wrap inside the pill; chips wrap as whole units within the row.
- Behavior unchanged; purely layout fixes based on runtime feedback.

## Commission Panel Naturalization (2025-09-26)
- Title is now an inline, content-editable heading (no "Title" label). Press Enter to save; placeholder shows "Untitled Commission" when empty.
- Status and completion are displayed as compact, clickable chips:
  - Status cycles Pending → In Progress → Completed.
  - Completion cycles 0% → 25% → 50% → 75% → 100%. A thin gradient bar under the header reflects progress.
  - Removes segmented buttons and the slider for a non-form, natural feel.
- Notes
  - Markdown preview when idle; click to edit inline with an auto-resizing textarea. Save on blur.
  - Supported syntax: #/##/### headings, -, * lists, **bold**, _italic_, `inline code`, and page breaks with a line containing `---`.
  - "New" creates a note and immediately opens it for editing (composer removed).
- Implementation details:
  - Minimal Markdown renderer and sanitization embedded in [page.tsx](src/app/zzq/page.tsx).
  - Inline note editing state via `editingNoteId` and `noteDrafts` inside [`ZZQPage()`](src/app/zzq/page.tsx).

Did I explain the functionality clearly in Context.md? Yes.
Would another engineer understand the purpose of this directory/codebase within 2 minutes? Yes.

## New: ZZQ AI — Slide-Up Chat (DeepSeek)
- Introduced a floating "ZZQ AI" button (bottom-right) which opens a slide-up chat panel from the bottom of the screen.
- Panel header: "ZZQ — DeepSeek" (assistant displayed as "ZZQ"), powered by DeepSeek's chat API via a server-side proxy.
- Behavior:
  - The panel composes a system message containing the owner's clients and (when selected) that client's projects (ids, status, completion) so ZZQ can answer questions about them.
  - Client sends an OpenAI-compatible payload to the server proxy at `/api/deepseek`; the proxy forwards the request to DeepSeek and returns the response.
  - Current implementation is non-streaming (stream: false).
- Implementation (files):
  - Server proxy: src/app/api/deepseek/route.ts
  - UI and panel: src/app/zzq/page.tsx
- Configuration & Security:
  - Requires server env var DEEPSEEK_API_KEY to be set (keep secret).
  - Recommended: add server-side session validation, rate limiting, and request validation before forwarding to DeepSeek.
  - Avoid sending sensitive fields to the model unless explicitly desired.
- Notes:
  - This update is intentionally minimal to demonstrate UI + server proxy integration. For production, implement authentication checks in the proxy and consider streaming responses for better UX.
