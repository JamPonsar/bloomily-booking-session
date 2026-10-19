import { z } from 'zod';
import { Child, ChildInput, ParentBooking, ParentInput, ParentProfile } from '../../../shared/schemas.ts';
import { all, get, run } from '../db.ts';
import { HttpError, defineRoute } from '../http.ts';
import { newId } from '../ids.ts';
import { SESSION_SELECT, getOwnChild, getParent, listChildren, toBooking, toSession } from '../repo.ts';

defineRoute(
  {
    method: 'get',
    path: '/parents/me',
    tag: 'Parents',
    summary: 'Get my profile',
    description: 'The signed-in parent with all of their children embedded.',
    auth: 'parent',
    response: ParentProfile,
  },
  async ({ auth }) => ({ ...(await getParent(auth.parentId)), children: await listChildren(auth.parentId) }),
);

defineRoute(
  {
    method: 'put',
    path: '/parents/me',
    tag: 'Parents',
    summary: 'Update my profile',
    auth: 'parent',
    body: ParentInput,
    response: ParentProfile,
  },
  async ({ auth, body }) => {
    const clash = await get('SELECT 1 FROM parents WHERE email = ? AND id <> ?', [body.email, auth.parentId]);
    if (clash) throw new HttpError(409, 'EMAIL_TAKEN', 'Another account already uses that email', { email: 'Already in use' });
    await run(`
      UPDATE parents SET first_name = ?, last_name = ?, email = ?, phone = ?, address = ?,
        emergency_contact_name = ?, emergency_contact_phone = ?, updated_at = ?
      WHERE id = ?`, [
      body.firstName, body.lastName, body.email, body.phone, body.address,
      body.emergencyContactName, body.emergencyContactPhone, new Date().toISOString(), auth.parentId,
    ]);
    return { ...(await getParent(auth.parentId)), children: await listChildren(auth.parentId) };
  },
);

defineRoute(
  {
    method: 'post',
    path: '/parents/me/children',
    tag: 'Children',
    summary: 'Add a child',
    auth: 'parent',
    status: 201,
    body: ChildInput,
    response: Child,
  },
  async ({ auth, body }) => {
    const id = newId('chd');
    const now = new Date().toISOString();
    await run(`
      INSERT INTO children (id, parent_id, first_name, last_name, date_of_birth, dietary_restrictions, medical_notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id, auth.parentId, body.firstName, body.lastName, body.dateOfBirth, JSON.stringify(body.dietaryRestrictions), body.medicalNotes, now, now,
    ]);
    return getOwnChild(auth.parentId, id);
  },
);

defineRoute(
  {
    method: 'put',
    path: '/parents/me/children/:childId',
    tag: 'Children',
    summary: 'Update a child',
    auth: 'parent',
    body: ChildInput,
    response: Child,
  },
  async ({ auth, body, params }) => {
    await getOwnChild(auth.parentId, params.childId);
    await run(`
      UPDATE children SET first_name = ?, last_name = ?, date_of_birth = ?, dietary_restrictions = ?, medical_notes = ?, updated_at = ?
      WHERE id = ? AND parent_id = ?`, [
      body.firstName, body.lastName, body.dateOfBirth, JSON.stringify(body.dietaryRestrictions), body.medicalNotes,
      new Date().toISOString(), params.childId, auth.parentId,
    ]);
    return getOwnChild(auth.parentId, params.childId);
  },
);

defineRoute(
  {
    method: 'delete',
    path: '/parents/me/children/:childId',
    tag: 'Children',
    summary: 'Remove a child',
    description: 'Refused with 409 while the child has upcoming confirmed bookings, so staff rosters never silently change.',
    auth: 'parent',
    status: 204,
  },
  async ({ auth, params }) => {
    await getOwnChild(auth.parentId, params.childId);
    const row = await get<{ n: string }>(`
      SELECT COUNT(*) AS n FROM bookings b JOIN sessions s ON s.id = b.session_id
      WHERE b.child_id = ? AND b.status = 'confirmed' AND s.ends_at > ?`, [params.childId, new Date().toISOString()]);
    const upcoming = Number(row?.n ?? 0);
    if (upcoming > 0) {
      throw new HttpError(409, 'CHILD_HAS_BOOKINGS', `Cancel this child's ${upcoming} upcoming booking${upcoming > 1 ? 's' : ''} first`);
    }
    await run('DELETE FROM children WHERE id = ? AND parent_id = ?', [params.childId, auth.parentId]);
  },
);

defineRoute(
  {
    method: 'get',
    path: '/parents/me/bookings',
    tag: 'Bookings',
    summary: 'List my bookings',
    description: 'All bookings made by the signed-in parent (confirmed and cancelled), with session and child summary, newest session first.',
    auth: 'parent',
    response: z.array(ParentBooking),
  },
  async ({ auth }) => {
    const rows = await all(`
      SELECT b.*, c.first_name AS c_first, c.last_name AS c_last
      FROM bookings b JOIN children c ON c.id = b.child_id
      WHERE b.parent_id = ?`, [auth.parentId]);
    const sessions = new Map(
      (await all(`${SESSION_SELECT} WHERE s.id = ANY(?)`, [[...new Set(rows.map((r) => r.session_id as string))]])).map((r) => [r.id as string, toSession(r)]),
    );
    return rows
      .map((r) => ({
        ...toBooking(r),
        session: sessions.get(r.session_id as string)!,
        child: { id: r.child_id as string, firstName: r.c_first as string, lastName: r.c_last as string },
      }))
      .sort((a, b) => b.session.startsAt.localeCompare(a.session.startsAt));
  },
);
