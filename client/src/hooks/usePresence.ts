import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useQuery } from './useQuery';

const CLIENT_ID_KEY = 'bloomily.clientId';

/** Stable random id for this browser tab, used to de-duplicate presence heartbeats. */
function getClientId(): string {
  try {
    let id = sessionStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** Polls GET /api/presence every 3 s and returns sessionId → live count. */
export function usePresenceCounts(): Record<string, number> {
  const { data } = useQuery('presence', api.getPresence, { intervalMs: 3000 });
  return data?.counts ?? {};
}

/**
 * Joins a session's presence room while `sessionId` is set: heartbeats every 5 s
 * and leaves on unmount / tab close. Returns the latest count from the server.
 */
export function useSessionRoom(sessionId: string | null): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const clientId = getClientId();
    let cancelled = false;
    const beat = () =>
      api.heartbeat(sessionId, clientId).then((r) => !cancelled && setCount(r.count)).catch(() => {});
    void beat();
    const timer = window.setInterval(beat, 5000);
    const onUnload = () => api.leave(sessionId, clientId);
    window.addEventListener('pagehide', onUnload);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('pagehide', onUnload);
      api.leave(sessionId, clientId);
      setCount(null);
    };
  }, [sessionId]);

  return count;
}
