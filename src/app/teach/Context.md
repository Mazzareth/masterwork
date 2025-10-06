# Context

## Overview
- Unique, mobile‑first “Teach Scene” theme for in‑person Piano/Guitar/Bass lessons (Topeka area).
- Visual feel: calm cosmic/aurora background with soft glass panels; friendly, professional, creative.
- Always accessible directly; Teach‑only users stay in `/teach`.

## Theming
- New background system: `.teach-scene` in [globals.css](src/app/globals.css)
  - Layered radial/conic gradients; light/dark aware; motion‑safe.
  - Applied at page root in [TeachLandingPage()](src/app/teach/page.tsx:1).
- Panels use translucent backgrounds with subtle shadows for depth.

## Components
- [TeachLandingPage()](src/app/teach/page.tsx:1)
  - Reworked Hero: gradient heading (text‑balance), larger mobile CTAs with focus-visible rings.
  - Sections unchanged in content but upgraded styling (rounded‑2xl, blur, subtle glow).
- [SchedulingForm()](src/app/teach/components/SchedulingForm.tsx:157)
  - Accessible status UX: role=alert for errors; role=status for success; submit button announces aria-busy/aria-disabled.
  - Timezone hint preserved; inputs retain native semantics.
- [InstrumentCards()](src/app/teach/components/InstrumentCards.tsx:1)
- Grid-stacked flip faces (not absolutely positioned) to auto-size to tallest side; fixes back-face button clipping on mobile. See [globals.css](src/app/globals.css:110).
- Fixed nested button issue (no interactive-in-interactive).
- Added aria-pressed on Select, stronger focus-visible styles, gentle selection glow.
- Back-of-card copy still centralized via [instrumentinfo.ts](src/config/instrumentinfo.ts:1).
- Header
  - [Header()](src/app/Header.tsx:11) gets a teach-only translucent gradient top bar to harmonize with the scene.

## Accessibility
- Loading state: role=status, aria-busy in [TeachLandingPage()](src/app/teach/page.tsx:1).
- Form messages announced to screen readers; clear focus states on all CTAs.
- Touch targets sized for mobile; color contrast kept within WCAG-friendly ranges.

## Routing and Gating
- Root redirect and permission gating unchanged; see:
  - [Home()](src/app/page.tsx)
  - [Header()](src/app/Header.tsx:11)
  - [AuthProvider](src/contexts/AuthContext.tsx:1)

## Notes
- No hub links on Teach page by design.
- Mobile-first: stacked layout, full-width CTAs on small screens, reduced visual clutter.

## References
- Config/copy: [src/config/instrumentinfo.ts](src/config/instrumentinfo.ts:1)
- Page labels/visibility: [src/config/pages.ts](src/config/pages.ts:1)