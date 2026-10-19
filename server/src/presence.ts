import { db } from './db.ts';

const TTL_MS = 15_000;
const SIMULATE = process.env.SIMULATE_PRESENCE !== 'false';

/**
 * In-memory presence: sessionId → (clientId → last heartbeat). Real users are
 * counted from heartbeats. In demo mode a small simulated audience drifts up and
 * down so the live counters have something to show with a single browser open;
 * disable with SIMULATE_PRESENCE=false.
 */
class PresenceStore {
  private rooms = new Map<string, Map<string, number>>();
  private simulated = new Map<string, number>();

  heartbeat(sessionId: string, clientId: string): number {
    let room = this.rooms.get(sessionId);
    if (!room) this.rooms.set(sessionId, (room = new Map()));
    room.set(clientId, Date.now());
    return this.countFor(sessionId);
  }

  leave(sessionId: string, clientId: string): void {
    this.rooms.get(sessionId)?.delete(clientId);
  }

  counts(): Record<string, number> {
    this.prune();
    const out: Record<string, number> = {};
    for (const id of new Set([...this.rooms.keys(), ...this.simulated.keys()])) out[id] = this.countFor(id);
    return out;
  }

  private countFor(sessionId: string): number {
    return (this.rooms.get(sessionId)?.size ?? 0) + (this.simulated.get(sessionId) ?? 0);
  }

  private prune(): void {
    const cutoff = Date.now() - TTL_MS;
    for (const [id, room] of this.rooms) {
      for (const [client, seen] of room) if (seen < cutoff) room.delete(client);
      if (room.size === 0) this.rooms.delete(id);
    }
  }

  /** Random-walks each session's simulated audience toward a plausible target. */
  tickSimulation(): void {
    const now = new Date().toISOString();
    const rows = db.prepare(`
      SELECT s.id, s.starts_at, s.capacity,
        (SELECT COUNT(*) FROM bookings b WHERE b.session_id = s.id AND b.status = 'confirmed') AS booked
      FROM sessions s WHERE s.ends_at > ?`).all(now) as Array<{ id: string; starts_at: string; capacity: number; booked: number }>;

    const active = new Set<string>();
    for (const r of rows) {
      active.add(r.id);
      const live = r.starts_at <= now;
      // Live sessions: most booked kids are "in class". Upcoming: a few curious browsers.
      const target = live ? Math.max(1, Math.round(r.booked * 0.85)) : Math.min(4, Math.round(r.capacity / 5));
      const current = this.simulated.get(r.id) ?? Math.round(target * Math.random());
      const drift = Math.sign(target - current) * (Math.random() < 0.5 ? 1 : 0) + (Math.random() < 0.25 ? (Math.random() < 0.5 ? -1 : 1) : 0);
      this.simulated.set(r.id, Math.max(0, Math.min(r.capacity, current + drift)));
    }
    for (const id of this.simulated.keys()) if (!active.has(id)) this.simulated.delete(id);
  }
}

export const presence = new PresenceStore();

if (SIMULATE) {
  presence.tickSimulation();
  setInterval(() => presence.tickSimulation(), 4_000).unref();
}
