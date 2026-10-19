import { DETAILS_UNLOCK_HOURS, StaffSessionRoster } from '../../../shared/schemas.ts';
import { db } from '../db.ts';
import { defineRoute } from '../http.ts';
import { getSession, toStaffChildView } from '../repo.ts';

const UNLOCK_MS = DETAILS_UNLOCK_HOURS * 3_600_000;

defineRoute(
  {
    method: 'get',
    path: '/staff/sessions/:sessionId/roster',
    tag: 'Staff',
    summary: 'Get a session roster',
    description:
      `Staff only. Every confirmed booking shows the child's name, age on the session date and dietary restrictions straight away. ` +
      `Parent contact details, address, emergency contact and medical notes are only returned once the booking is ${DETAILS_UNLOCK_HOURS} hours old; before that \`details\` is null. ` +
      `The locked columns are blanked in SQL, so they never leave the database early, and the response schema strips anything else.`,
    auth: 'staff',
    response: StaffSessionRoster,
  },
  ({ params }) => {
    const session = getSession(params.sessionId);
    const cutoff = new Date(Date.now() - UNLOCK_MS).toISOString();
    // Sensitive columns are NULL unless the booking is old enough.
    const rows = db.prepare(`
      SELECT b.id AS booking_id, b.created_at AS booked_at,
             c.first_name, c.last_name, c.date_of_birth, c.dietary_restrictions,
             b.created_at <= ?1 AS unlocked,
             CASE WHEN b.created_at <= ?1 THEN p.first_name || ' ' || p.last_name END AS parent_name,
             CASE WHEN b.created_at <= ?1 THEN p.email END AS parent_email,
             CASE WHEN b.created_at <= ?1 THEN p.phone END AS parent_phone,
             CASE WHEN b.created_at <= ?1 THEN p.address END AS address,
             CASE WHEN b.created_at <= ?1 THEN p.emergency_contact_name END AS emergency_contact_name,
             CASE WHEN b.created_at <= ?1 THEN p.emergency_contact_phone END AS emergency_contact_phone,
             CASE WHEN b.created_at <= ?1 THEN c.medical_notes END AS medical_notes
      FROM bookings b
      JOIN children c ON c.id = b.child_id
      JOIN parents p ON p.id = b.parent_id
      WHERE b.session_id = ?2 AND b.status = 'confirmed'
      ORDER BY c.first_name, c.last_name`).all(cutoff, session.id) as Array<Record<string, unknown>>;

    const roster = rows.map((r) => ({
      bookingId: r.booking_id as string,
      bookedAt: r.booked_at as string,
      child: toStaffChildView(r as never, session.startsAt),
      detailsUnlockAt: new Date(new Date(r.booked_at as string).getTime() + UNLOCK_MS).toISOString(),
      details: r.unlocked
        ? {
            parentName: r.parent_name as string,
            parentEmail: r.parent_email as string,
            parentPhone: r.parent_phone as string,
            address: r.address as string,
            emergencyContactName: r.emergency_contact_name as string,
            emergencyContactPhone: r.emergency_contact_phone as string,
            medicalNotes: r.medical_notes as string,
          }
        : null,
    }));

    const tally = new Map<string, number>();
    for (const { child } of roster) for (const d of child.dietaryRestrictions) tally.set(d, (tally.get(d) ?? 0) + 1);
    const dietarySummary = [...tally].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    return { session, roster, dietarySummary };
  },
);
