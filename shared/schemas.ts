/**
 * Single source of truth for every object that crosses the API boundary.
 *
 * The server validates request bodies and response payloads with these schemas,
 * the client imports the inferred types, and the API docs page renders them as
 * JSON Schema via GET /api/meta.
 */
import { z } from 'zod';

const Id = z.string().min(1).describe('Opaque, prefixed identifier (e.g. "ses_ab12cd34ef56")');
const Timestamp = z.iso.datetime().describe('ISO-8601 UTC timestamp');
const Name = z.string().trim().min(1, 'Required').max(60);

export const SESSION_CATEGORIES = ['art', 'music', 'stem', 'sports', 'nature', 'cooking'] as const;
export const SessionCategory = z.enum(SESSION_CATEGORIES).meta({
  id: 'SessionCategory',
  description: 'Broad theme used for filtering and color-coding sessions',
});

export const DietaryRestrictions = z
  .array(z.string().trim().min(1).max(40))
  .max(12)
  .describe('Free-form dietary needs and allergies, e.g. ["Vegetarian", "Nut allergy"]');

/* -------------------------------------------------------------------------- */
/*                                   Parent                                   */
/* -------------------------------------------------------------------------- */

export const ParentInput = z
  .object({
    firstName: Name,
    lastName: Name,
    email: z.email('Enter a valid email'),
    phone: z.string().trim().max(30).describe('Hidden from staff until a booking is 24 hours old'),
    address: z.string().trim().max(200).describe('Hidden from staff until a booking is 24 hours old'),
    emergencyContactName: z.string().trim().max(60),
    emergencyContactPhone: z.string().trim().max(30),
  })
  .meta({ id: 'ParentInput', description: 'Editable parent profile fields (PUT /parents/me)' });

export const Parent = ParentInput.extend({
  id: Id,
  createdAt: Timestamp,
  updatedAt: Timestamp,
}).meta({ id: 'Parent', description: 'A guardian account. One parent has many children and many bookings.' });

/* -------------------------------------------------------------------------- */
/*                                    Child                                   */
/* -------------------------------------------------------------------------- */

export const ChildInput = z
  .object({
    firstName: Name,
    lastName: Name,
    dateOfBirth: z.iso.date('Enter a valid date').describe('YYYY-MM-DD'),
    dietaryRestrictions: DietaryRestrictions,
    medicalNotes: z.string().trim().max(500).describe('Hidden from staff until a booking is 24 hours old'),
  })
  .meta({ id: 'ChildInput', description: 'Fields a parent provides when adding or editing a child' });

export const Child = ChildInput.extend({
  id: Id,
  parentId: Id.describe('FK → Parent.id'),
  age: z.number().int().describe('Derived from dateOfBirth at request time'),
  createdAt: Timestamp,
  updatedAt: Timestamp,
}).meta({ id: 'Child', description: 'A child belonging to exactly one parent' });

export const ParentProfile = Parent.extend({
  children: z.array(Child),
}).meta({ id: 'ParentProfile', description: 'A parent with their children embedded (GET /parents/me)' });

/* -------------------------------------------------------------------------- */
/*                                   Session                                  */
/* -------------------------------------------------------------------------- */

const sessionFields = {
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().max(500),
  instructorName: Name.describe('Staff member who runs the session'),
  category: SessionCategory,
  location: z.string().trim().min(1).max(80),
  startsAt: Timestamp,
  endsAt: Timestamp,
  capacity: z.number().int().min(1).max(100),
  minAge: z.number().int().min(0).max(18),
  maxAge: z.number().int().min(0).max(18),
  priceCents: z.number().int().min(0).describe('Price in cents (USD)'),
};

export const SessionInput = z
  .object(sessionFields)
  .refine((s) => new Date(s.endsAt) > new Date(s.startsAt), { message: 'End time must be after start time', path: ['endsAt'] })
  .refine((s) => s.maxAge >= s.minAge, { message: 'Max age must be ≥ min age', path: ['maxAge'] })
  .meta({ id: 'SessionInput', description: 'Fields staff provide to schedule a new session' });

export const Session = z
  .object({
    id: Id,
    ...sessionFields,
    bookedCount: z.number().int().describe('Confirmed bookings (derived from Booking rows)'),
    spotsLeft: z.number().int().describe('capacity − bookedCount'),
    createdAt: Timestamp,
  })
  .meta({ id: 'Session', description: 'A scheduled class. One session has many bookings.' });

/* -------------------------------------------------------------------------- */
/*                                   Booking                                  */
/* -------------------------------------------------------------------------- */

export const BookingStatus = z.enum(['confirmed', 'cancelled']).meta({ id: 'BookingStatus' });

export const Booking = z
  .object({
    id: Id,
    sessionId: Id.describe('FK → Session.id'),
    childId: Id.describe('FK → Child.id'),
    parentId: Id.describe('FK → Parent.id'),
    status: BookingStatus,
    consentSharedAt: Timestamp.describe('When the parent acknowledged the data-sharing notice'),
    createdAt: Timestamp,
    cancelledAt: Timestamp.nullable(),
  })
  .meta({ id: 'Booking', description: 'Joins a child to a session. Unique per (session, child) while confirmed.' });

export const CreateBookingInput = z
  .object({
    sessionId: Id,
    childId: Id,
    consentToShare: z.literal(true, 'You must acknowledge what will be shared with staff').describe(
      'Must be true — the parent acknowledged that the child\'s name, age and dietary restrictions are shared immediately, and that contact details, address, emergency contact and medical notes are shared once the booking is 24 hours old',
    ),
  })
  .meta({ id: 'CreateBookingInput', description: 'Request body for POST /bookings' });

export const UpdateBookingInput = z
  .object({ status: z.literal('cancelled') })
  .meta({ id: 'UpdateBookingInput', description: 'Bookings can only transition to cancelled' });

export const ParentBooking = Booking.extend({
  session: Session,
  child: Child.pick({ id: true, firstName: true, lastName: true }),
}).meta({ id: 'ParentBooking', description: "A booking as seen by its parent, with session and child summary" });

/* -------------------------------------------------------------------------- */
/*                         Staff-facing (privacy-scoped)                       */
/* -------------------------------------------------------------------------- */

/** How long after booking staff may see the family's full details. */
export const DETAILS_UNLOCK_HOURS = 24;

/**
 * What staff see for every booking from the moment it is made. Parsing through this
 * schema strips every other field, so even a buggy query can't leak more.
 */
export const StaffChildView = z
  .object({
    firstName: z.string(),
    lastName: z.string(),
    age: z.number().int().describe("Child's age on the day of the session"),
    dietaryRestrictions: DietaryRestrictions,
  })
  .meta({ id: 'StaffChildView', description: 'Always-shared child record: name, age and dietary needs' });

export const StaffFamilyDetails = z
  .object({
    parentName: z.string(),
    parentEmail: z.string(),
    parentPhone: z.string(),
    address: z.string(),
    emergencyContactName: z.string(),
    emergencyContactPhone: z.string(),
    medicalNotes: z.string(),
  })
  .meta({ id: 'StaffFamilyDetails', description: `Family details, only returned once the booking is ${DETAILS_UNLOCK_HOURS} hours old` });

export const StaffRosterEntry = z
  .object({
    bookingId: Id,
    bookedAt: Timestamp,
    child: StaffChildView,
    detailsUnlockAt: Timestamp.describe(`bookedAt + ${DETAILS_UNLOCK_HOURS} hours`),
    details: StaffFamilyDetails.nullable().describe('null until detailsUnlockAt has passed'),
  })
  .meta({ id: 'StaffRosterEntry', description: 'One line of a session roster' });

export const StaffSessionRoster = z
  .object({
    session: Session,
    roster: z.array(StaffRosterEntry),
    dietarySummary: z
      .array(z.object({ label: z.string(), count: z.number().int() }))
      .describe('Aggregated dietary needs across the roster, most common first'),
  })
  .meta({ id: 'StaffSessionRoster', description: 'Everything staff need to prepare for a session' });

/* -------------------------------------------------------------------------- */
/*                                  Presence                                  */
/* -------------------------------------------------------------------------- */

export const PresenceHeartbeat = z
  .object({
    sessionId: Id,
    clientId: z.string().min(8).max(64).describe('Random per-tab id generated by the client'),
  })
  .meta({ id: 'PresenceHeartbeat', description: 'Sent every few seconds while a user has a session open' });

export const PresenceCounts = z
  .object({
    counts: z.record(z.string(), z.number().int()).describe('sessionId → number of users currently in the session room'),
    updatedAt: Timestamp,
  })
  .meta({ id: 'PresenceCounts', description: 'Live head-count per session, polled by the client' });

/* -------------------------------------------------------------------------- */
/*                                   Errors                                   */
/* -------------------------------------------------------------------------- */

export const ApiError = z
  .object({
    error: z.object({
      code: z.string().describe('Machine-readable code, e.g. SESSION_FULL'),
      message: z.string().describe('Human-readable explanation, safe to show in UI'),
      fields: z.record(z.string(), z.string()).optional().describe('Per-field validation messages'),
    }),
  })
  .meta({ id: 'ApiError', description: 'Shape of every non-2xx response' });

export const SessionQuery = z.object({
  category: SessionCategory.optional(),
  upcoming: z.enum(['true', 'false']).optional().describe('When "true" (default), hide sessions that have ended'),
});

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export type SessionCategory = z.infer<typeof SessionCategory>;
export type ParentInput = z.infer<typeof ParentInput>;
export type Parent = z.infer<typeof Parent>;
export type ChildInput = z.infer<typeof ChildInput>;
export type Child = z.infer<typeof Child>;
export type ParentProfile = z.infer<typeof ParentProfile>;
export type SessionInput = z.infer<typeof SessionInput>;
export type Session = z.infer<typeof Session>;
export type Booking = z.infer<typeof Booking>;
export type BookingStatus = z.infer<typeof BookingStatus>;
export type CreateBookingInput = z.infer<typeof CreateBookingInput>;
export type ParentBooking = z.infer<typeof ParentBooking>;
export type StaffChildView = z.infer<typeof StaffChildView>;
export type StaffFamilyDetails = z.infer<typeof StaffFamilyDetails>;
export type StaffRosterEntry = z.infer<typeof StaffRosterEntry>;
export type StaffSessionRoster = z.infer<typeof StaffSessionRoster>;
export type PresenceCounts = z.infer<typeof PresenceCounts>;
export type ApiError = z.infer<typeof ApiError>;

/** Shape of GET /api/meta, consumed by the API docs page. */
export interface ApiMeta {
  endpoints: Array<{
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    tag: string;
    summary: string;
    description?: string;
    auth: 'public' | 'parent' | 'staff';
    status: number;
    query: JsonSchema | null;
    body: JsonSchema | null;
    response: JsonSchema | null;
  }>;
  schemas: Record<string, JsonSchema>;
  tables: Array<{
    name: string;
    columns: Array<{ name: string; type: string; notNull: boolean; primaryKey: boolean; defaultValue: string | null }>;
    foreignKeys: Array<{ column: string; table: string; references: string; onDelete: string }>;
    indexes: Array<{ name: string; unique: boolean; columns: string[]; partial: boolean }>;
  }>;
}

export interface JsonSchema {
  $ref?: string;
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  const?: unknown;
  format?: string;
  anyOf?: JsonSchema[];
  additionalProperties?: boolean | JsonSchema;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  maxItems?: number;
}
