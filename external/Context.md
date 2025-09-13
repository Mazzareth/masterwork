# Context

## Overview
- External-facing documentation directory.
- Captures operational requirements and references for services this app depends on.
- Primary document: Firebase Firestore rules required by the application, kept in sync with the repo’s rules file.

## Files
- [external/rules.md](external/rules.md) — Human-readable summary and the exact rules snippet to apply.
- [firebase/firestore.rules](firebase/firestore.rules) — Source of truth used for deployment.

## Design Decisions
- Source of truth for enforcement remains the rules file in `firebase/`. The doc in `external/` mirrors it for clarity and external sharing.
- Rules validate the shape of the user document and enforce per-user isolation.
- App contracts:
  - The app initializes a user document on first login with default permissions (ZZQ only). See [src/contexts/AuthContext.tsx](../src/contexts/AuthContext.tsx).
  - UI visibility is also gated by config. See [src/config/pages.ts](../src/config/pages.ts).

## Update Policy
- When modifying [firebase/firestore.rules](../firebase/firestore.rules), immediately update [external/rules.md](external/rules.md) to match.
- Include the “Data Model Contract” and “Verification Checklist” in the doc to aid external reviewers.

## References
- Auth/permissions runtime usage: [src/contexts/AuthContext.tsx](../src/contexts/AuthContext.tsx)
- Hub UI where permissions drive access: [src/app/page.tsx](../src/app/page.tsx)