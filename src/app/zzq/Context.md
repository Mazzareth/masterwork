# Context

## Overview
- ZZQ is a focused, lightweight CRM for commissions workflow.
- UX-first design with a persistent, scrollable, searchable Clients list on the left, a slide-in Client View, and a nested slide-out Commission panel.
- All data is stored per-user in Firestore under the user profile in a site-specific subtree.

## UI/Flow
- Left panel (sticky):
  - Search input (client name or discord username).
  - Client cards show:
    - Display name (primary)
    - Discord username (secondary, italic, subdued)
  - Add Client button (prompt-based for speed).
- Client View (slides in from the right, keeps clients list visible):
  - Header: Client name + username, Close button.
  - Two columns:
    - Projects: list with quick-complete checkbox; Add Project via prompt.
      - Click a project to open the Commission panel.
    - Notes: aggregated list across all projects; Add Note via prompt.
      - Clicking a note opens its project’s Commission panel and auto-scrolls/highlights the note; edits happen inline there.
- Commission panel (nested slide-out from the right):
  - Live-bound fields:
    - Title (inline editable)
    - Status (Pending / In Progress / Completed)
    - Completion (0–100% slider)
  - Notes section fills the remaining height of the Commission panel and provides a large scroll area; inline editable textareas auto-save on blur.
- No separate Note Edit panel; note editing is consolidated in the Commission panel’s Notes section (on-blur auto-save).
- Designed to conserve space while keeping Clients and Client View visible.
- Color theme: Dark-first palette with neon cyan→fuchsia accents, glassmorphism (frosted panels), and high-contrast typography. Light mode gracefully degrades to a dimmed variant for visual consistency.

## Data Model (Firestore)
- Root: `/users/{uid}` (managed by AuthProvider bootstrap)
- ZZQ subtree:
  - Clients: `/users/{uid}/sites/zzq/clients/{clientId}`
    - Fields: `displayName: string`, `username?: string|null`, `createdAt`, `updatedAt`
  - Projects: `/users/{uid}/sites/zzq/clients/{clientId}/projects/{projectId}`
    - Fields: `title: string`, `status: "pending"|"in_progress"|"completed"`, `completion: number`, timestamps
  - Notes (per project): `/users/{uid}/sites/zzq/clients/{clientId}/projects/{projectId}/notes/{noteId}`
    - Fields: `text: string`, timestamps
  - Client Notes panel aggregates all notes across the client’s projects (no separate client-level notes collection required).

## Security
- Only the signed-in owner can read/write their ZZQ subtree.
- See [firebase/firestore.rules](firebase/firestore.rules) matches under `/users/{uid}/sites/zzq/**`.

## Components
- Page: [src/app/zzq/page.tsx](src/app/zzq/page.tsx)
  - Client-side subscriptions to Clients, Projects, Notes; single nested slide-out for Commission; notes are edited inline within Commission.
  - Optimistic updates for project fields and note text.
  - Keyboard UX: Ctrl/Cmd+K focuses client search; Esc closes the topmost open panel (Commission → Client).
  - Micro-component: StatusBadge for project state chips and animated progress visualization.

- Styles: [src/app/globals.css](src/app/globals.css)
  - .zzq-bg dark gradient background with subtle neon blooms.
  - .text-gradient accent gradient for headings.
  - Motion token: --ease-snap easing curve; skeleton and spinner animations.
## Dependencies
- Auth: [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)
- Firebase App/DB: [src/lib/firebase.ts](src/lib/firebase.ts)

## Notes
- Strict “Client-first” information architecture: all projects and notes are linked to a specific Client.
- Nested slide-outs avoid deep navigation and keep context visible at all times.
- Inline, live-updating edits reduce clicks and keep the flow fast; can be extended later with richer forms.
- Commission panel opens only when a project is selected AND loaded (or an aggregated note is clicked). Selecting a client does not open Commission; its open state is derived from `selectedProjectId` AND `projectLive` in [ZZQPage()](src/app/zzq/page.tsx:86). The panel will not show "No commission selected" - it only appears when a project is actually available.
- Off-canvas containment: the page wrapper also uses overflow-hidden to fully prevent horizontal scrollbars, and closed panels use pointer-events-none so they cannot intercept clicks or create accidental horizontal overflow. See [page.tsx wrapper](src/app/zzq/page.tsx:543) and panel toggles at [client panel](src/app/zzq/page.tsx:632) and [commission panel](src/app/zzq/page.tsx:787).

## Dark Theme Revamp (2025-09)
- Visual system
  - Dark neon aesthetic using .zzq-bg and .text-gradient from [src/app/globals.css](src/app/globals.css).
  - Glassy panels with border-white/10, backdrop-blur, and subtle inner shadow on selection.
- Interactions and motion
  - Slide panels with ease-[var(--ease-snap)] and will-change for snappy transitions.
  - Active scale and hover states on actionable elements; focus-visible rings for keyboard users.
- Keyboard
  - Ctrl/Cmd+K focuses client search; Esc closes Commission → Client panels, in order.
- Performance
  - Skeleton shimmer for perceived speed; debounced search; optimistic updates for Firestore writes.
- Accessibility
  - Managed focus on panel open; ARIA labels on controls; respects prefers-reduced-motion.

## Type Safety (2025-09)
- Replaced any with precise types:
  - Firestore timestamps typed as Timestamp across Client/Project/Note models.
  - Snapshot mappings cast to concrete Doc shapes instead of any merges in [src/app/zzq/page.tsx](src/app/zzq/page.tsx).
- Removed redundant casts in aggregated note sorting; relies on Timestamp.seconds.
