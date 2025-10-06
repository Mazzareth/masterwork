# Context

## Overview
- Interactive components for the Teach (Lessons) page to enable auth-gated scheduling and an engaging instrument selection experience.
- Mobile-first with progressive density on larger screens; uses Tailwind utilities and a few custom CSS helpers (flip cards, range notches) in [src/app/globals.css](src/app/globals.css).

## Components
- [InstrumentCards()](src/app/teach/components/InstrumentCards.tsx:1)
  - Three cards (Piano, Guitar, Bass); multi-select.
  - Cards flip to show concise back-of-card marketing copy sourced from [src/config/instrumentinfo.ts](src/config/instrumentinfo.ts:1).
  - Selection state is external (passed via props); flip state internal.
  - Styling uses flip-card helpers in [src/app/globals.css](src/app/globals.css:110) with grid-stacked faces to prevent back-face clipping and auto-size height.
- [SchedulingForm()](src/app/teach/components/SchedulingForm.tsx:1)
  - Auth-only form used on [TeachLandingPage()](src/app/teach/page.tsx:1).
  - Captures: Name, Email, Phone, Role (Student/Parent), Student Name (optional if Parent), Preferred Contact, Instruments (multi), per-instrument concept sliders, availability notes, goals/styles.
  - Writes a single Firestore document to `/teachIntros` with status requested, normalized phone, timezone, and a profile/contact snapshot.
  - Uses discrete sliders with notch overlay; accent-color is set in [src/app/globals.css](src/app/globals.css).

## Accessibility
- InstrumentCards
  - Select uses aria-pressed for state; strong focus-visible ring and subtle selection glow.
  - Avoids nested interactive elements; “Learn more” has an explicit accessible label.
- SchedulingForm
  - Errors announced with role=alert; success with role=status.
  - Submit button exposes aria-busy and aria-disabled while saving.

## Data Model
- Collection: `/teachIntros` (public top-level)
  - Created by the signed-in user; readable by themselves and the admin.
  - Example shape (see implementation in [SchedulingForm()](src/app/teach/components/SchedulingForm.tsx:1)):
    - userId (uid); status: "requested"
    - createdAt (serverTimestamp)
    - profileSnapshot: { uid, email, displayName, photoURL }
    - contact: { name, email?, phone?, phoneNormalized?, preferredContact, role, studentName?, timezone }
    - instruments: InstrumentKey[]
    - conceptsByInstrument: Record<InstrumentKey, Record<conceptId, 0..4>>
    - notes: { availability?, goals? }
    - clientMeta: { ua?, lang? }
- Rules: see Teach Intro Scheduling in [firebase/firestore.rules](firebase/firestore.rules)

## Behavior & Flow
- [TeachLandingPage()](src/app/teach/page.tsx:1)
  - Shows a "Sign in to schedule" prompt if signed-out.
  - When signed-in, renders [SchedulingForm()](src/app/teach/components/SchedulingForm.tsx:1).
- Sliders
  - 5-notch discrete scale (0..4) with scale labels defined in [src/config/instrumentinfo.ts](src/config/instrumentinfo.ts:1).
  - If a concept value isn’t set before submit, defaults to mid-scale.

## Responsive & UX
- Small screens: stacked sections, compact spacing.
- Large screens: denser panels, side-by-side grids where appropriate; clear section headings and microcopy.
- Flip-cards provide interactive "learn more" affordance; selection remains a clear, primary action.

## Extensibility
- Add/modify instrument copy and concepts in [src/config/instrumentinfo.ts](src/config/instrumentinfo.ts:1).
  - To add a new concept for an instrument: append to its concepts array; the UI renders sliders automatically.
  - To change slider labels or scale, update SLIDER_* constants and SLIDER_SCALE_LABELS.
- Back-of-card text is centralized: `BACK_OF_CARD` in [src/config/instrumentinfo.ts](src/config/instrumentinfo.ts:1).

## Dependencies
- Auth: [useAuth()](src/contexts/AuthContext.tsx:186) for user, profile.
- Firestore: [db](src/lib/firebase.ts:1)
- Styles: flip-card and range helpers in [src/app/globals.css](src/app/globals.css:104)

## Notes
- Phone normalization is best-effort (+1 for US numbers). Adjust if supporting international formats broadly.
- Admin email is currently checked in rules; consider migrating to admin UID/role for robustness.

## References
- Page integration: [src/app/teach/page.tsx](src/app/teach/page.tsx:1)
- Rules: [firebase/firestore.rules](firebase/firestore.rules)
- Config: [src/config/instrumentinfo.ts](src/config/instrumentinfo.ts:1)