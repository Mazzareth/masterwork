# Context

## Overview
- Placeholder page for the CC route.
- Enforces authentication and per-user permissions (cc = true) before rendering content.

## Behavior
- If not signed in: prompts for Google Sign-In and link back to Home.
- If signed in but unauthorized: shows "Not authorized" and link back to Home.
- If authorized: renders placeholder content with a back link.

## Dependencies
- Uses Auth context: [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)