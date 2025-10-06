# Context

## Overview
- Admin-only Clients dashboard at `/clients` now has two tabs:
  - Planner: a day planner to schedule time slots and plan the day.
  - Requests: the original contact requests review dashboard with inline appointment scheduling (date/time/duration) that writes to the Day Planner.
- Access control: admin-only (`mercysquadrant@gmail.com`).

## Components
- Page
  - [src/app/clients/page.tsx](src/app/clients/page.tsx)
    - Client component; gates UI by admin email.
    - Tabs:
      - Planner: inline DayPlanner with quick-add, day grid (15-min slots), and item editor.
      - Requests: details from teach intro requests with Admin Notes, Progress Status, and Appointment scheduling (creates plannerDays item and sets progressStatus="scheduled").
- Day Planner UX
  - Quick-add row: Type, Start, Duration, Title, optional Client link (from teachIntros), Add.
  - Day grid: 6am–10pm, 15-min slots, colored blocks by type, click to edit.
  - Context menu: right-click an item to move ±30/±60 minutes, Edit Type, or Delete.
  - Edit panel: Type, Title, Start, Duration, Client link, Details; Delete/Save.

## Data Model
- Teach Intros (existing): `teachIntros/{introId}` (created by the lessons intro form)
  - Used by Requests tab and for Planner client linking.
  - Admin scheduling fields (set from Requests):
    - scheduled: { dayId, startMin, endMin, tz, plannerItemId?, createdAt? }
    - progressStatus transitions to "scheduled" upon scheduling.
- Planner (new, admin-only):
  - Day doc: `plannerDays/{YYYY-MM-DD}`
    - `{ id, date, tz, notes?, createdAt, updatedAt }`
  - Items subcollection: `plannerDays/{YYYY-MM-DD}/items/{itemId}`
    - `{ dayId, type, title, clientIntroId?, startMin, endMin, location?, details?, createdAt, updatedAt }`
  - Types:
    - APPOINTMENT (Client Appointment)
    - CHECKIN (Client Check In)
    - TASK
    - ADVERTIME
    - BREAK

## Security
- Teach Intros: unchanged (admin list/update, owner get, see [firebase/firestore.rules](firebase/firestore.rules)).
- Planner: admin-only read/list/write for both day docs and items (see [firebase/firestore.rules](firebase/firestore.rules)).

## Notes
- All UI is client-side with `onSnapshot` live updates.
- Time math stored in minutes-from-midnight for simple layout and conflict checks later.
- Color coding for readability; mobile-friendly layout with simple list editing.

## References
- Page: [src/app/clients/page.tsx](src/app/clients/page.tsx)
- Rules: [firebase/firestore.rules](firebase/firestore.rules)
- Teach request form: [src/app/teach/components/SchedulingForm.tsx](src/app/teach/components/SchedulingForm.tsx)
- Auth: [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)