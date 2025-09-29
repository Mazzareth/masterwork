# Context

## Overview
- Centralized UI configuration for which main-page entries are shown as buttons.
- Independent from Firestore permissions: a page button renders only if both the UI visibility and the user's permission are true.

## Components
- [src/config/pages.ts](src/config/pages.ts)
  - `pageVisibility`: object toggles for `zzq`, `cc`, `inhouse`, `gote`.
  - `PAGE_LABELS`: display labels.

## Notes
- To hide a page globally from the portal UI, set its flag to `false` in [src/config/pages.ts](src/config/pages.ts).
- Permissions are still enforced at each route even if a button is hidden or directly navigated-to.
## Global AI Defaults (BigGote)
- Defaults: [src/config/gote-ai.ts](src/config/gote-ai.ts:1)
- Imported by BigGote: [src/app/gote/page.tsx](src/app/gote/page.tsx:10)
- Philosophy: Impartial Reality Engine & Referee; strict player agency; PvP adjudication protocol; continuity.
- Action schema aligned to [handleFinishTurn()](src/app/gote/page.tsx:597):
  - Root returns narratorMessage plus optional actions.
  - actions.profiles.<uid>: displayName, avatarUrl, charInfo, position, role (per‑chat profile only).
  - actions.inventories.<uid>: add/remove/set arrays of { name, qty?, notes? }.
  - actions.states.<uid>: set { hunger, thirst, oxygen } and set/add/remove for statusTags, clothing, accessories.
- Character Profiles (/characters) are immutable; Narrator never edits them. Per‑chat Profiles (/profiles) may be adjusted when earned by the fiction.
- Per‑chat overrides live on `/goteChats/{chatId}.aiBehavior` and are concatenated after the defaults (later guidance wins on conflict).
- How to customize (pre-deploy): Edit the template string in [src/config/gote-ai.ts](src/config/gote-ai.ts:1) and redeploy.

## Updates (2025-09-29)
- Upgraded DEFAULT_NARRATOR_RULES to codify the Impartial Reality Engine, PvP protocol, and allowed mechanical actions aligned with [patchGoteInventory()](src/lib/gote.ts:446) and [patchGoteCharacterState()](src/lib/gote.ts:650). Used by Finish Turn via [handleFinishTurn()](src/app/gote/page.tsx:597).