# Bloomily — kids' session booking (demo)

A full-stack demo where parents browse and book sessions for their children, and staff see privacy-scoped rosters.

```bash
npm install
cp .env.example .env     # then set DATABASE_URL (a free Neon Postgres works great)
npm run dev              # API on :3001, web app on http://localhost:5173
```

Other scripts: `npm run typecheck`, `npm run build`, `npm start` (build + serve everything from :3001), `npm run db:reset` (wipe and re-create the demo data).

Requires Node 24 (native TypeScript type stripping, so there's no compile step for the server). Tables and demo data are created automatically on first run, and re-created if the demo schedule runs out.

## Stack

| Layer | Tech |
| --- | --- |
| Shared contracts | Zod schemas in `shared/schemas.ts`, used by server and client |
| Server | Express 5, Postgres (`pg`, Neon), real foreign keys, transactions with row locking |
| Client | React 19, React Router, Vite, lucide icons, hand-written CSS themed after bloomily.app (Parkinsans + Manrope, cream/orange palette) |

## Deploy to Vercel

One Vercel project serves both halves, like a classic Vite + Express setup:

- The Vite build (`client/dist`) is served as static files.
- `api/index.js` exports the Express app as a serverless function; `vercel.json` rewrites `/api/*` to it and everything else to `index.html` for React Router.

Steps:

1. Push the repo to GitHub and import it in Vercel.
2. Add a Neon Postgres database (Vercel → Storage → Neon, or neon.tech). The integration sets `DATABASE_URL` for you; if you create it by hand, add `DATABASE_URL` under Settings → Environment Variables.
3. Deploy. The first request creates the tables and demo data.

Notes:

- Function region is `iad1` (N. Virginia) to sit next to a `us-east-1` Neon database. Change `regions` in `vercel.json` if yours differs.
- Live "in class" counts are stored in the `presence` table because serverless instances share no memory.
- Demo session times are generated in Portland time (`America/Los_Angeles`) regardless of the server's timezone.
- Use a separate Neon branch for local development if you don't want local testing to touch the deployed data.
- The Parent/Staff switch is a demo-only identity header with no real login, so only put made-up data in this database.

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

Clients poll `GET /api/presence` every 5 s. Opening a session (the booking dialog or a staff roster) joins its "room" through heartbeats every 5 s, stored in Postgres. In demo mode a small simulated audience is added so the counters move with one browser open. Turn it off with `SIMULATE_PRESENCE=false`.

## Identity

This is a demo: the Parent/Staff switch sends `X-Role` / `X-Parent-Id` headers. Every route declares its required role in `defineRoute`, so swapping in real auth is a change in one place (`server/src/http.ts`).

## API docs

The **API & Schemas** tab is generated from `GET /api/meta`, which combines the route registry, the Zod schemas converted to JSON Schema, and Postgres introspection. It also lists every frontend component, and you can try GET endpoints inline.
