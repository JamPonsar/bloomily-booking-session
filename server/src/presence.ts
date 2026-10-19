import { all, run } from './db.ts';

const TTL_MS = 15_000;
const SIMULATE = process.env.SIMULATE_PRESENCE !== 'false';

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * A small simulated audience so the live counters have something to show with one browser open.
 * It is a pure function of (session, time) — no server memory — so every serverless instance agrees.
 * Live sessions: most booked kids are "in class". Upcoming: a few curious browsers.
 * Disable with SIMULATE_PRESENCE=false.
 */
function simulated(s: { id: string; startsAt: string; capacity: number; booked: number }, now: Date): number {
  if (!SIMULATE) return 0;
  const live = s.startsAt <= now.toISOString();
  const target = live ? Math.max(1, Math.round(s.booked * 0.85)) : Math.min(4, Math.round(s.capacity / 5));
  const steady = (hash(s.id) % 3) - 1;                                  // fixed per session: −1, 0 or +1
  const wobble = (hash(`${s.id}:${Math.floor(now.getTime() / 5000)}`) % 3) - 1; // changes every 5 s
  return Math.max(0, Math.min(s.capacity, target + steady + wobble));
}

/**
 * Presence lives in Postgres (table `presence`), because serverless instances share no memory.
 * Real users are counted from heartbeats seen in the last 15 s.
 */
export const presence = {
  async heartbeat(sessionId: string, clientId: string): Promise<number> {
    const now = Date.now();
    await run(
      `INSERT INTO presence (session_id, client_id, seen_at) VALUES (?, ?, ?)
       ON CONFLICT (session_id, client_id) DO UPDATE SET seen_at = EXCLUDED.seen_at`,
      [sessionId, clientId, new Date(now).toISOString()],
    );
    await run('DELETE FROM presence WHERE seen_at < ?', [new Date(now - 60_000).toISOString()]);
    return (await this.counts())[sessionId] ?? 0;
  },

  async leave(sessionId: string, clientId: string): Promise<void> {
    await run('DELETE FROM presence WHERE session_id = ? AND client_id = ?', [sessionId, clientId]);
  },

  /** sessionId → people currently in that session's room, for every session that hasn't ended. */
  async counts(): Promise<Record<string, number>> {
    const now = new Date();
    const rows = await all<{ id: string; starts_at: string; capacity: number; booked: string; viewers: string }>(`
      SELECT s.id, s.starts_at, s.capacity,
        (SELECT COUNT(*) FROM bookings b WHERE b.session_id = s.id AND b.status = 'confirmed') AS booked,
        (SELECT COUNT(*) FROM presence p WHERE p.session_id = s.id AND p.seen_at > ?) AS viewers
      FROM sessions s WHERE s.ends_at > ?`, [new Date(now.getTime() - TTL_MS).toISOString(), now.toISOString()]);
    const out: Record<string, number> = {};
    for (const r of rows) {
      out[r.id] = Number(r.viewers) + simulated({ id: r.id, startsAt: r.starts_at, capacity: Number(r.capacity), booked: Number(r.booked) }, now);
    }
    return out;
  },
};
