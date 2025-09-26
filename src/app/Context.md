# Context

## Overview
- App Router root and portal hub.
- Authentication is provided globally; the hub renders available destinations (ZZQ, CC, InHouse) based on both UI visibility toggles and Firestore permissions.
- UI refined: top navigation with auth controls on the top-right, gradient background, and card-style links. Branding header and placeholder footer text removed.

## Components
- Layout
  - [src/app/layout.tsx](src/app/layout.tsx)
    - Server component that mounts the client-side AuthProvider and sets base fonts and metadata.
- Header
  - [src/app/Header.tsx](src/app/Header.tsx)
    - Global sticky header with navigation (based on `pageVisibility` + Firestore `permissions`) and auth controls. Rendered inside `AuthProvider` in layout.
- Hub (Main Page)
  - [src/app/page.tsx](src/app/page.tsx)
    - Client component:
      - Top-right login/logout with avatar and display name.
      - If signed out: centered welcome and CTA to sign in.
      - If signed in: grid of destination cards, filtered by `pageVisibility` and Firestore `permissions`.
      - Cards are accessible, hover-elevated, and responsive.
- Routes (with auth/permission gates):
  - [src/app/zzq/page.tsx](src/app/zzq/page.tsx)
  - [src/app/cc/page.tsx](src/app/cc/page.tsx)
  - [src/app/inhouse/page.tsx](src/app/inhouse/page.tsx)
  - Commission Pages:
    - Dynamic client entrypoint: [src/app/commission/[slug]/page.tsx](src/app/commission/[slug]/page.tsx)
    - Artists configure slug in ZZQ Settings; clients visit /commission/{slug}, sign in, and submit a brief to open a chat.

## Dependencies
- Auth provider and hooks: [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)
- UI visibility toggles: [src/config/pages.ts](src/config/pages.ts)

## Design Notes
- New users default to ZZQ-only permission; CC/InHouse disabled until enabled in Firestore.
- The old “visibility toggles” footer line has been removed; refer to [src/config/pages.ts](src/config/pages.ts) for toggles.
- Geist fonts are applied globally via CSS variable `--font-geist-sans`.
- Global UI utilities (2025-09):
  - In [src/app/globals.css](src/app/globals.css):
    - `--ease-snap` easing var for snappy transitions.
    - `.skeleton` shimmer and `.spinner` loader; both respect prefers-reduced-motion.
    - `.zzq-bg` dark neon background with radial cyan/fuchsia blooms and glass base.
    - `.text-gradient` cyan→violet→pink gradient text for headings and emphasis.
  - Adopted in [src/app/zzq/page.tsx](src/app/zzq/page.tsx) for perceived performance, optimistic UI, focus management on slide-in panels, and the new dark theme visuals.
  - Keyboard UX in [src/app/zzq/page.tsx](src/app/zzq/page.tsx): Ctrl/Cmd+K focuses client search; Esc closes Commission → Client. Notes are edited inline within the Commission panel, and the aggregated client Notes list navigates to and highlights the target note. The Commission Notes pane now expands to the available height using flex, replacing the previous 12rem max height cap.
- ZZQ Commission panel opens only when a project is clicked (or an aggregated note is selected). Selecting a client does not open Commission; open state is derived from `selectedProjectId` in [ZZQPage()](src/app/zzq/page.tsx:86). The page wrapper also uses `overflow-hidden` to prevent horizontal scrollbars at [page.tsx wrapper](src/app/zzq/page.tsx:543), and closed panels use `pointer-events-none` so they cannot intercept clicks (see [client panel](src/app/zzq/page.tsx:632) and [commission panel](src/app/zzq/page.tsx:787)). Selecting a client explicitly clears any open Commission via the [onClick handler](src/app/zzq/page.tsx:587), and the Client Close button also clears Commission via its [onClick](src/app/zzq/page.tsx:654).

## Type Safety (2025-09)
- Eliminated any casts to satisfy @typescript-eslint/no-explicit-any.
- Home hub permission filter now indexes typed Permissions without casts; see [src/app/page.tsx](src/app/page.tsx).
- Firestore timestamps use Timestamp; pages avoid any by casting document data to explicit shapes; see [src/app/zzq/page.tsx](src/app/zzq/page.tsx).
- Auth context timestamps typed as Timestamp; write payloads leverage serverTimestamp() without type assertions; see [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx).

## Updates (2025-09-26)
- ZZQ UI consistency:
  - Per-project Notes (in Commission) now sort by `createdAt` descending to match the aggregated Notes list.
  - Projects and Notes cards use equal visual height with internal scrolling and thicker separators for clearer grouping. See [`src/app/zzq/page.tsx`](src/app/zzq/page.tsx).
- Bug fix:
  - ZZQ sidebar Settings overflow/clipping resolved. The sidebar is now a flex column and the Clients list is flex-1 with internal scroll, replacing the previous fixed calc height. This prevents the Commission Link area from being cut off and keeps "Save" and "Copy" buttons clickable. See [`src/app/zzq/page.tsx`](src/app/zzq/page.tsx).
- Commission Pages & Settings:
  - Artists can set a unique commission slug in ZZQ Settings (left header). The chosen slug is reserved globally under `/commissionSlugs/{slug}` and stored at `/users/{uid}/sites/zzq/config/settings.commissionSlug`.
  - Clients can visit `/commission/{slug}` to authenticate and submit a brief; a chat is created for both participants and the client is redirected to the CC chat.
- Push Notifications:
  - Device-level enable/disable from the ZZQ sidebar; stores/deletes FCM token under `/users/{uid}/notificationTokens/{token}` via [`ensurePushPermissionAndToken()`](src/lib/notifications.ts:20) and [`disablePushForThisDevice()`](src/lib/notifications.ts:122).
  - Per-client notification preference toggle on the Client View header; writes `notificationsEnabled` on the client doc at `/users/{uid}/sites/zzq/clients/{clientId}` (owner-only).