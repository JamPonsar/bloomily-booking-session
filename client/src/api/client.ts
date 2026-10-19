/**
 * Typed wrapper around the REST API. Every UI action goes through here, so
 * auth headers, JSON handling and error normalisation live in one place.
 */
import type {
  ApiMeta, Booking, Child, ChildInput, CreateBookingInput, ParentBooking, ParentInput, ParentProfile,
  PresenceCounts, Session, SessionCategory, SessionInput, StaffSessionRoster,
} from '../../../shared/schemas';

export class ApiRequestError extends Error {
  status: number;
  code: string;
  fields: Record<string, string>;

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

let authHeaders: Record<string, string> = {};

/** Called by AppContext whenever the parent/staff view changes. */
export function setAuth(role: 'parent' | 'staff', parentId: string): void {
  authHeaders = role === 'parent' ? { 'X-Role': 'parent', 'X-Parent-Id': parentId } : { 'X-Role': 'staff' };
}

export function getAuthHeaders(): Record<string, string> {
  return { ...authHeaders };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { ...authHeaders, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiRequestError(0, 'NETWORK', "Can't reach the server. Is the API running?");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error ?? {};
    throw new ApiRequestError(res.status, e.code ?? 'UNKNOWN', e.message ?? `Request failed (${res.status})`, e.fields);
  }
  return data as T;
}

export const api = {
  // Sessions
  listSessions: (category?: SessionCategory) => request<Session[]>('GET', `/sessions${category ? `?category=${category}` : ''}`),
  getSession: (id: string) => request<Session>('GET', `/sessions/${id}`),
  createSession: (input: SessionInput) => request<Session>('POST', '/sessions', input),

  // Parent profile & children
  getProfile: () => request<ParentProfile>('GET', '/parents/me'),
  updateProfile: (input: ParentInput) => request<ParentProfile>('PUT', '/parents/me', input),
  addChild: (input: ChildInput) => request<Child>('POST', '/parents/me/children', input),
  updateChild: (id: string, input: ChildInput) => request<Child>('PUT', `/parents/me/children/${id}`, input),
  deleteChild: (id: string) => request<void>('DELETE', `/parents/me/children/${id}`),

  // Bookings
  listMyBookings: () => request<ParentBooking[]>('GET', '/parents/me/bookings'),
  createBooking: (input: CreateBookingInput) => request<Booking>('POST', '/bookings', input),
  cancelBooking: (id: string) => request<Booking>('PATCH', `/bookings/${id}`, { status: 'cancelled' }),

  // Staff
  getRoster: (sessionId: string) => request<StaffSessionRoster>('GET', `/staff/sessions/${sessionId}/roster`),

  // Presence
  getPresence: () => request<PresenceCounts>('GET', '/presence'),
  heartbeat: (sessionId: string, clientId: string) => request<{ sessionId: string; count: number }>('POST', '/presence/heartbeat', { sessionId, clientId }),
  leave: (sessionId: string, clientId: string) => {
    const blob = new Blob([JSON.stringify({ sessionId, clientId })], { type: 'application/json' });
    if (!navigator.sendBeacon?.('/api/presence/leave', blob)) void request('POST', '/presence/leave', { sessionId, clientId }).catch(() => {});
  },

  // Meta
  getMeta: () => request<ApiMeta>('GET', '/meta'),
  /** Raw GET used by the docs page "Try it" button. */
  rawGet: (path: string) => request<unknown>('GET', path.replace(/^\/api/, '')),
};
