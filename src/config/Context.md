# Context

## Overview
- Centralized UI configuration for which main-page entries are shown as buttons.
- Independent from Firestore permissions: a page button renders only if both the UI visibility and the user's permission are true.

## Components
- [src/config/pages.ts](src/config/pages.ts)
  - `pageVisibility`: object toggles for `zzq`, `cc`, `inhouse`.
  - `PAGE_LABELS`: display labels.

## Notes
- To hide a page globally from the portal UI, set its flag to `false` in [src/config/pages.ts](src/config/pages.ts).
- Permissions are still enforced at each route even if a button is hidden or directly navigated-to.