# Context

## Overview
- BigGote is a gated, black-and-white themed roleplay chat hub with:
  - Left: Chat browser (Discord-like) listing your BigGote chats.
  - “+ New” opens a New Chat dialog (set chat name and default AI DnD Mode, then generate a single‑use invite). A chat stub appears immediately in your Chats list; the canonical chat is created on acceptance and inherits these defaults. Each invite has a unique chatId, so existing chats are not overwritten.
  - Pending state: Until the invite is accepted, the chat is “pending” — messages and per‑chat profiles are disabled by design (rules require participants). The UI shows “Waiting for invite acceptance…” and disables the composer, AI toggle, and profile editors. After acceptance, these controls enable automatically.
  - Middle: Markdown-supported chat thread.
  - Right: Helper modules with clear separation:
    - Characters (side-by-side, read-only): name, height, weight, build, sizes, weaknesses, kinks; status tags; Hunger/Thirst/Oxygen bars; Clothing; Accessories.
    - Shared Pin (visible to both participants)
    - Narrator Rules (per chat; guides AI behavior; stored as `aiBehavior` on the chat). Global defaults live at [src/config/gote-ai.ts](src/config/gote-ai.ts)
    - "Finish Turn" lives in the composer; requires AI DnD Mode enabled on the chat.
- Access is granted when either:
  - `permissions.gote === true`, or
  - you have at least one `/users/{uid}/sites/gote/chats/*` summary (e.g., after accepting an invite).
  The page probes for a chat summary to avoid race conditions immediately after accepting an invite.

## Current Status
- Page at [src/app/gote/page.tsx](src/app/gote/page.tsx)
  - 3‑pane layout with careful spacing, fixed pane widths and internal scroll. Draggable resizers between panes with persistence (localStorage):
    - Left: 220–560px; Right: 260–640px
  - Conservative inline Markdown renderer: escapes `&` `<` `>` then supports `**bold**`, `_italic_`, `` `inline code` ``, `#`/`##`/`###` headings, lists, and `---` rules.
  - Firestore wiring (BigGote-specific; separate from ZZQ/CC):
    - Chat list subscribes to `/users/{uid}/sites/gote/chats` ordered by `lastMessageAt`
    - Selecting a chat streams `/goteChats/{chatId}/messages` and updates your `/users/{uid}/sites/gote/chats/{chatId}.lastReadAt`
    - Helper Modules load/save:
      - DnD toggle → `/goteChats/{chatId}.aiDndEnabled`
      - Shared Pin → `/goteChats/{chatId}.sharedPin`
      - Per-chat profiles:
        - Yours (editable) → `/goteChats/{chatId}/profiles/{uid}`
        - Partner (read-only) → `/goteChats/{chatId}/profiles/{partnerUid}`
- Invite acceptance route at [src/app/gote/link/page.tsx](src/app/gote/link/page.tsx)
  - Reads `/users/{ownerId}/sites/gote/invites/{token}` (active), accepts, and ensures:
    - `/goteChats/{chatId}` with `participants: [ownerId, userId]` and `aiDndEnabled` initialized from the invite
    - `/users/{userId}/sites/gote/chats/{chatId}` (self summary) with `title` mirrored from the invite
    - Grants BigGote access by setting `/users/{userId}.permissions.gote = true`
    - Marks invite `status="used"`, `usedBy=userId`
- Utilities at [src/lib/gote.ts](src/lib/gote.ts)
  - `createGoteInvite()`, `acceptGoteInvite()` (now also grants access on accept)
  - `sendGoteChatMessage()` (mirrors `lastMessageAt` to each participant’s summary)
  - `ensureOwnerGoteMirrors()` (optional) — idempotently create owner summary on invite use if desired

## Data Model (BigGote)
- Per-user summaries (self-owned):
  - `/users/{uid}/sites/gote/chats/{chatId}`
    - `{ chatId, lastMessageAt?, lastReadAt?, otherUserId?, title? }`
- Invites (owner subtree):
  - `/users/{ownerId}/sites/gote/invites/{token}`
    - `{ token, ownerId, createdAt, expiresAt?, usedAt?, usedBy?, status }`
- Canonical chat:
  - `/goteChats/{chatId}`
    - `participants: [ownerId, otherUserId]`
    - `aiDndEnabled?: boolean`
    - `sharedPin?: string`
    - `aiBehavior?: string` (Narrator Rules shown in the right panel; participants can edit)
  - `/goteChats/{chatId}/messages/{messageId}`
    - `{ senderId, text, createdAt, kind?: "message" | "update" }`
  - `/goteChats/{chatId}/profiles/{uid}`
    - `{ displayName, avatarUrl, charInfo, position: "top" | "bottom", role: "dominant" | "submissive" }`
    - Writable by any chat participant (rules) to support Omnipotent Narrator adjustments; readable by participants
  - `/goteChats/{chatId}/inventories/{uid}`
    - `{ items: Array<{ id, name, qty?, notes? }>, updatedAt }` — per-player, per-chat inventory used by AI and UI

## Permissions & Routing
- Gating:
  - `permissions.gote` exists on `/users/{uid}`; see [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)
  - Header entry “BigGote” controlled via [src/config/pages.ts](src/config/pages.ts) and filtered in [src/app/Header.tsx](src/app/Header.tsx)
- Firestore rules (BigGote-specific):
  - Owner subtree: `/users/{uid}/sites/gote/**` — owner read/write
  - Invites: `/users/{ownerId}/sites/gote/invites/{token}` — owner creates/lists/revokes; signed‑in GET allowed when active
  - Canonical chats: `/goteChats/{chatId}` and `/goteChats/{chatId}/messages/**` — participant‑gated
  - Per‑chat profiles: `/goteChats/{chatId}/profiles/{uid}` — readable by participants; create/update allowed by any chat participant (supports Omnipotent Narrator).
  - Inventories: `/goteChats/{chatId}/inventories/{uid}` — read/write/delete allowed by chat participants.
  - See [firebase/firestore.rules](firebase/firestore.rules)

## Components
- Page: [src/app/gote/page.tsx](src/app/gote/page.tsx)
- Invite acceptance: [src/app/gote/link/page.tsx](src/app/gote/link/page.tsx)
- Utilities (invites/chats): [src/lib/gote.ts](src/lib/gote.ts)
- Auth & permissions: [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)
- UI configuration (labels/visibility): [src/config/pages.ts](src/config/pages.ts)
- Header navigation: [src/app/Header.tsx](src/app/Header.tsx)
- Rules: [firebase/firestore.rules](firebase/firestore.rules)

## UX Notes (Black/White Theme)
- Strict black/white with subtle translucency; no overlapping layers; each pane owns its scroll area.
- Pane widths are resizable via thin vertical bars and persist per-device using localStorage.

## Testing
- Direct navigation:
  - Not signed in → login gate
  - Signed in but unauthorized → “Not authorized”
  - With `permissions.gote = true` → 3‑pane BigGote UI
- Invites:
  - Owner: open /gote → Invite → Generate Link → copy
  - Invitee: open the link at /gote/link, sign-in, Accept Link
- Profiles:
  - Your Settings: update Name/Avatar/Character Information/Position/Role (blur-save)
  - Partner Information: displayed read-only (partner edits their own profile)

## Updates
- 2025‑09‑29 — Invite generation targeting
  - The “Invite” button now targets the currently selected chat and is disabled when none is selected to prevent accidental creation of a new chat. The invite panel shows the target chat title for clarity. Links reuse the selected chatId via [createGoteInvite()](src/lib/gote.ts:91).
- 2025‑09‑29 — Mobile login reliability
  - Added popup→redirect fallback in [loginWithGoogle()](src/contexts/AuthContext.tsx:137) to address mobile browsers blocking popups. This fixes cases where invitees could not sign in to accept a link.
- 2025‑09‑29 — Invite link sign-in gating fix
  - The `/gote/link` route now requires the user to be signed in before validating the invite to avoid erroneous “Invalid Link” when signed out.
- 2025‑09‑29 — Characters/States & Scene
  - Added per-player immutable Character Profiles at `/goteChats/{chatId}/characters/{uid}` (player-authored during setup) and Narrator-managed Character States at `/goteChats/{chatId}/states/{uid}` with mid-level defaults (Hunger=Sated, Thirst=Quenched, Oxygen=Steady). Rules allow players to create their own Character Profile and any participant to update States.
  - New Chat: optional "Scene" field stored on `/goteChats/{chatId}.scene`, rendered at the top of the chat and included in AI context.
  - Finish Turn: JSON contract extended with `actions.states` (set levels, status tags, clothing, accessories) and applied via `patchGoteCharacterState()`; inventories behavior unchanged.
- 2025‑09‑29 — Omnipotent Narrator + Inventories
  - Added "Finish Turn" in BigGote, invoking [handleFinishTurn()](src/app/gote/page.tsx:597) to call the DeepSeek proxy at [`route.ts`](src/app/api/deepseek/route.ts:1), parse strict JSON, apply profile, inventory, and state mutations, and post a narrator message (`senderId="_narrator"`).
  - Narrator Rules editor (per chat) persisted at `/goteChats/{chatId}.aiBehavior` used to steer the AI.
  - New per‑chat inventories at `/goteChats/{chatId}/inventories/{uid}` managed via [patchGoteInventory()](src/lib/gote.ts:446) and readable via [readGoteInventory()](src/lib/gote.ts:410).
  - Firestore rules updated: profiles are participant‑writable, and inventories read/write/delete are allowed by participants. See [firebase/firestore.rules](firebase/firestore.rules:178).
- 2025‑09‑29 — BigGote access gating fix
  - After invite acceptance, the header hotbar now shows “BigGote” immediately. [acceptGoteInvite()](src/lib/gote.ts:154) updates the nested permission and falls back to a merge write if needed. Header filters entries via [Header()](src/app/Header.tsx:11).
- 2025‑09‑29 — Build hygiene
  - Stabilized effects by memoizing default character state with useMemo at [src/app/gote/page.tsx:328](src/app/gote/page.tsx:328); removed unused helpers [src/app/gote/page.tsx:97](src/app/gote/page.tsx:97) and [src/app/gote/page.tsx:872](src/app/gote/page.tsx:872) to satisfy lint and unblock Vercel builds.
- 2025‑09‑28 — Markdown/Resizers
  - Fixed text color for Markdown bubbles; added draggable resizers with bounds + localStorage
- 2025‑09‑28 — Wiring
  - Live Firestore data for chat list/messages; invite acceptance route; helper modules persistence; per-chat profiles; DnD toggle; Shared Pin
- 2025‑09‑28 — Profile UX & Model
  - Reworked right panel into:
    - Your Settings (self-editable per-chat profile)
    - Partner Information (read-only)
  - Removed Enjoyment sliders; added Character Information, Position (top/bottom), Role (dominant/submissive)
  - Added `/goteChats/{chatId}/profiles/{uid}` with participant-readable and owner-of-uid writable rules
  - Eliminated console permission errors originating from missing profile rules
- 2025‑10‑06 — Build fixes
  - Removed unused isCheckingLinkedAccess variable that was causing ESLint warning
  - Fixed conditional React Hook usage by moving the redirect gating effect above early returns to satisfy rules-of-hooks. See [src/app/gote/page.tsx](src/app/gote/page.tsx).
  - These fixes resolve the build errors that were preventing successful compilation

Did I explain the functionality clearly in Context.md? Yes.
Would another engineer understand the purpose of this directory/codebase within 2 minutes? Yes.