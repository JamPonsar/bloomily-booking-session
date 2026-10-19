# Bloomily — kids' session booking (demo)

A full-stack demo where parents browse and book sessions for their children, and staff see privacy-scoped rosters.

```bash
npm install
npm run dev        # API on :3001, web app on http://localhost:5173
```

Other scripts: `npm run typecheck`, `npm run build`, `npm start` (build + serve everything from :3001), `npm run db:reset` (wipe and re-seed demo data on next start).

Requires Node ≥ 22.13 (uses the built-in `node:sqlite` and native TypeScript type stripping, so there's no compile step for the server).

## Stack

| Layer | Tech |
| --- | --- |
| Shared contracts | Zod schemas in `shared/schemas.ts`, used by server and client |
| Server | Express 5, SQLite (`node:sqlite`), real foreign keys, transactions |
| Client | React 19, React Router, Vite, lucide icons, hand-written CSS themed after bloomily.app (Parkinsans + Manrope, cream/orange palette) |

## Data model

```
parents 1──* children      children.parent_id  → parents.id   (cascade)
parents 1──* bookings      bookings.parent_id  → parents.id
children 1──* bookings     bookings.child_id   → children.id
sessions 1──* bookings     bookings.session_id → sessions.id
UNIQUE (session_id, child_id) WHERE status = 'confirmed'
```

## Privacy

Booking requires `consentToShare: true`, which the UI collects after showing the parent exactly what staff will see and when.

- **Immediately:** child's name, age (on the session date) and dietary restrictions.
- **24 hours after the booking:** the parent's name, email, phone and address, the emergency contact and the child's medical notes.

The roster query blanks the locked columns in SQL until the booking is 24 hours old (`CASE WHEN b.created_at <= cutoff`), so they never leave the database early. The response is then parsed through `StaffSessionRoster`, which strips anything else. The rule is explained in the booking review step, the confirmation, My bookings and the bottom of Profile.

## Live counts

Clients poll `GET /api/presence` every 3 s. Opening a session (the booking dialog or a staff roster) joins its "room" through heartbeats every 5 s. In demo mode a small simulated audience is added so the counters move with one browser open. Turn it off with `SIMULATE_PRESENCE=false`.

## Identity

This is a demo: the Parent/Staff switch sends `X-Role` / `X-Parent-Id` headers. Every route declares its required role in `defineRoute`, so swapping in real auth is a change in one place (`server/src/http.ts`).

## API docs

The **API & Schemas** tab is generated from `GET /api/meta`, which combines the route registry, the Zod schemas converted to JSON Schema, and SQLite introspection. It also lists every frontend component, and you can try GET endpoints inline.
