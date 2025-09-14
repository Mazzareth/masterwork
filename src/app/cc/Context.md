# Context

## Overview
- CC is the client-facing area where linked clients can chat with artists.
- Access is granted if either:
  - The user has explicit CC permission, or
  - The user has at least one linked chat summary under `/users/{uid}/sites/cc/chats` (invite acceptance flow).
- This keeps CC hidden from unrelated users while allowing invited clients to access without granting global `cc=true`.

## Behavior
- If not signed in: prompts for Google Sign-In and link back to Home.
- If checking linked access: shows a loading state while probing for `/users/{uid}/sites/cc/chats` existence.
- If signed in but unauthorized: shows "Not authorized" and link back to Home.
- If authorized: renders placeholder content (to be replaced by dashboard/chat UI).

## Dependencies
- Uses Auth context: [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)
- Firestore client: checks `/users/{uid}/sites/cc/chats` existence for linked-access gating in [page.tsx](src/app/cc/page.tsx)

## Notes
- Linting/Type safety: avoids `any` (uses concrete types or `unknown`), escapes apostrophes in JSX text to satisfy `react/no-unescaped-entities`, and includes correct React Hook dependencies.
- Chat summaries are typed and spread safely without `any` in [src/app/cc/page.tsx](src/app/cc/page.tsx).
- useSearchParams must be within a Suspense boundary for App Router CSR bailouts. The link accept page wraps its inner component with Suspense in [src/app/cc/link/page.tsx](src/app/cc/link/page.tsx).