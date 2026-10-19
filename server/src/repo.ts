/**
 * Row ↔ object mapping and shared queries. SQL stays snake_case; the API is camelCase.
 */
import type { Booking, Child, Parent, Session, StaffChildView } from '../../shared/schemas.ts';
import { all, get } from './db.ts';
import { notFound } from './http.ts';

type Row = Record<string, unknown>;

/** Whole years between dateOfBirth and `on` (defaults to now). */
export function ageOn(dateOfBirth: string, on: Date = new Date()): number {
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  let age = on.getFullYear() - dob.getFullYear();
  const beforeBirthday = on.getMonth() < dob.getMonth() || (on.getMonth() === dob.getMonth() && on.getDate() < dob.getDate());
  if (beforeBirthday) age--;
  return age;
}

export function toParent(r: Row): Parent {
  return {
    id: r.id as string,
    firstName: r.first_name as string,
    lastName: r.last_name as string,
    email: r.email as string,
    phone: r.phone as string,
    address: r.address as string,
    emergencyContactName: r.emergency_contact_name as string,
    emergencyContactPhone: r.emergency_contact_phone as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function toChild(r: Row): Child {
  return {
    id: r.id as string,
    parentId: r.parent_id as string,
    firstName: r.first_name as string,
    lastName: r.last_name as string,
    dateOfBirth: r.date_of_birth as string,
    age: ageOn(r.date_of_birth as string),
    dietaryRestrictions: JSON.parse(r.dietary_restrictions as string),
    medicalNotes: r.medical_notes as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function toSession(r: Row): Session {
  const bookedCount = Number(r.booked_count ?? 0);
  return {
    id: r.id as string,
    title: r.title as string,
    description: r.description as string,
    instructorName: r.instructor_name as string,
    category: r.category as Session['category'],
    location: r.location as string,
    startsAt: r.starts_at as string,
    endsAt: r.ends_at as string,
    capacity: Number(r.capacity),
    minAge: Number(r.min_age),
    maxAge: Number(r.max_age),
    priceCents: Number(r.price_cents),
    bookedCount,
    spotsLeft: Math.max(0, Number(r.capacity) - bookedCount),
    createdAt: r.created_at as string,
  };
}

export function toBooking(r: Row): Booking {
  return {
    id: r.id as string,
    sessionId: r.session_id as string,
    childId: r.child_id as string,
    parentId: r.parent_id as string,
    status: r.status as Booking['status'],
    consentSharedAt: r.consent_shared_at as string,
    createdAt: r.created_at as string,
    cancelledAt: (r.cancelled_at as string | null) ?? null,
  };
}

/**
 * Builds the privacy-scoped view of a child for staff. Deliberately takes only
 * the columns staff are allowed to see.
 */
export function toStaffChildView(r: { first_name: string; last_name: string; date_of_birth: string; dietary_restrictions: string }, sessionStartsAt: string): StaffChildView {
  return {
    firstName: r.first_name,
    lastName: r.last_name,
    age: ageOn(r.date_of_birth, new Date(sessionStartsAt)),
    dietaryRestrictions: JSON.parse(r.dietary_restrictions),
  };
}

/** Sessions joined with their live confirmed-booking count. */
export const SESSION_SELECT = `
  SELECT s.*, (SELECT COUNT(*) FROM bookings b WHERE b.session_id = s.id AND b.status = 'confirmed') AS booked_count
  FROM sessions s`;

export async function getSession(id: string): Promise<Session> {
  const row = await get(`${SESSION_SELECT} WHERE s.id = ?`, [id]);
  if (!row) throw notFound('Session');
  return toSession(row);
}

export async function getParent(id: string): Promise<Parent> {
  const row = await get('SELECT * FROM parents WHERE id = ?', [id]);
  if (!row) throw notFound('Parent');
  return toParent(row);
}

export async function listChildren(parentId: string): Promise<Child[]> {
  return (await all('SELECT * FROM children WHERE parent_id = ? ORDER BY date_of_birth', [parentId])).map(toChild);
}

/** Fetches a child only if it belongs to the given parent (prevents IDOR). */
export async function getOwnChild(parentId: string, childId: string): Promise<Child> {
  const row = await get('SELECT * FROM children WHERE id = ? AND parent_id = ?', [childId, parentId]);
  if (!row) throw notFound('Child');
  return toChild(row);
}
