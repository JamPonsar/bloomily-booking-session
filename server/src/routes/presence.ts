import { z } from 'zod';
import { PresenceCounts, PresenceHeartbeat } from '../../../shared/schemas.ts';
import { defineRoute } from '../http.ts';
import { presence } from '../presence.ts';

defineRoute(
  {
    method: 'get',
    path: '/presence',
    tag: 'Presence',
    summary: 'Live head-count per session',
    description: 'Polled by the client every few seconds. Counts users whose heartbeat for a session arrived within the last 15 s (plus a simulated audience in demo mode).',
    auth: 'public',
    response: PresenceCounts,
  },
  () => ({ counts: presence.counts(), updatedAt: new Date().toISOString() }),
);

defineRoute(
  {
    method: 'post',
    path: '/presence/heartbeat',
    tag: 'Presence',
    summary: 'Join / stay in a session room',
    description: 'Send every ~5 s while a session is open on screen. Returns the updated count for that session.',
    auth: 'public',
    body: PresenceHeartbeat,
    response: z.object({ sessionId: z.string(), count: z.number().int() }),
  },
  ({ body }) => ({ sessionId: body.sessionId, count: presence.heartbeat(body.sessionId, body.clientId) }),
);

defineRoute(
  {
    method: 'post',
    path: '/presence/leave',
    tag: 'Presence',
    summary: 'Leave a session room',
    description: 'Called when a session is closed (also safe to send via navigator.sendBeacon on tab close).',
    auth: 'public',
    status: 204,
    body: PresenceHeartbeat,
  },
  ({ body }) => presence.leave(body.sessionId, body.clientId),
);
