import { Booking, CreateBookingInput, UpdateBookingInput } from '../../../shared/schemas.ts';
import { get, run, transaction } from '../db.ts';
import { HttpError, defineRoute, notFound } from '../http.ts';
import { newId } from '../ids.ts';
import { ageOn, getOwnChild, getSession, toBooking } from '../repo.ts';

defineRoute(
  {
    method: 'post',
    path: '/bookings',
    tag: 'Bookings',
    summary: 'Book a child into a session',
    description:
      'Requires consentToShare=true. Runs in a transaction and rejects with 409 when the session is full, has ended, or the child is already booked; 422 when the child is outside the age range. On success, staff immediately see the child\'s name, age and dietary restrictions. The parent\'s contact details, address, emergency contact and the child\'s medical notes become visible to staff 24 hours after the booking is made.',
    auth: 'parent',
    status: 201,
    body: CreateBookingInput,
    response: Booking,
  },
  ({ auth, body }) =>
    transaction(async () => {
      // Lock the session row so two parents can't take the last spot at the same moment.
      await get('SELECT id FROM sessions WHERE id = ? FOR UPDATE', [body.sessionId]);
      const child = await getOwnChild(auth.parentId, body.childId);
      const session = await getSession(body.sessionId);

      if (new Date(session.endsAt) <= new Date()) throw new HttpError(409, 'SESSION_ENDED', 'This session has already ended');
      if (session.spotsLeft <= 0) throw new HttpError(409, 'SESSION_FULL', 'Sorry — this session just filled up');

      const age = ageOn(child.dateOfBirth, new Date(session.startsAt));
      if (age < session.minAge || age > session.maxAge) {
        throw new HttpError(422, 'AGE_OUT_OF_RANGE', `${child.firstName} will be ${age}; this session is for ages ${session.minAge}–${session.maxAge}`);
      }

      const existing = await get("SELECT 1 FROM bookings WHERE session_id = ? AND child_id = ? AND status = 'confirmed'", [session.id, child.id]);
      if (existing) throw new HttpError(409, 'ALREADY_BOOKED', `${child.firstName} is already booked into this session`);

      const id = newId('bkg');
      const now = new Date().toISOString();
      await run(`
        INSERT INTO bookings (id, session_id, child_id, parent_id, status, consent_shared_at, created_at)
        VALUES (?, ?, ?, ?, 'confirmed', ?, ?)`, [id, session.id, child.id, auth.parentId, now, now]);
      return toBooking((await get('SELECT * FROM bookings WHERE id = ?', [id]))!);
    }),
);

defineRoute(
  {
    method: 'patch',
    path: '/bookings/:bookingId',
    tag: 'Bookings',
    summary: 'Cancel a booking',
    description: 'Parents can only cancel their own bookings. The spot is released immediately.',
    auth: 'parent',
    body: UpdateBookingInput,
    response: Booking,
  },
  async ({ auth, params }) => {
    const row = await get('SELECT * FROM bookings WHERE id = ? AND parent_id = ?', [params.bookingId, auth.parentId]);
    if (!row) throw notFound('Booking');
    if (row.status === 'cancelled') throw new HttpError(409, 'ALREADY_CANCELLED', 'This booking is already cancelled');
    await run("UPDATE bookings SET status = 'cancelled', cancelled_at = ? WHERE id = ?", [new Date().toISOString(), params.bookingId]);
    return toBooking((await get('SELECT * FROM bookings WHERE id = ?', [params.bookingId]))!);
  },
);
