import { z } from 'zod';
import { Session, SessionInput, SessionQuery } from '../../../shared/schemas.ts';
import { all, run } from '../db.ts';
import { defineRoute } from '../http.ts';
import { newId } from '../ids.ts';
import { SESSION_SELECT, getSession, toSession } from '../repo.ts';

defineRoute(
  {
    method: 'get',
    path: '/sessions',
    tag: 'Sessions',
    summary: 'List sessions',
    description: 'Returns sessions ordered by start time, each with its confirmed booking count and remaining spots. Ended sessions are hidden unless upcoming=false.',
    auth: 'public',
    query: SessionQuery,
    response: z.array(Session),
  },
  async ({ query }) => {
    const where: string[] = [];
    const args: string[] = [];
    if (query.upcoming !== 'false') {
      where.push('s.ends_at > ?');
      args.push(new Date().toISOString());
    }
    if (query.category) {
      where.push('s.category = ?');
      args.push(query.category);
    }
    const sql = `${SESSION_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY s.starts_at`;
    return (await all(sql, args)).map(toSession);
  },
);

defineRoute(
  {
    method: 'get',
    path: '/sessions/:sessionId',
    tag: 'Sessions',
    summary: 'Get one session',
    auth: 'public',
    response: Session,
  },
  ({ params }) => getSession(params.sessionId),
);

defineRoute(
  {
    method: 'post',
    path: '/sessions',
    tag: 'Sessions',
    summary: 'Schedule a new session',
    description: 'Staff only. Validates that the end is after the start and the age range is coherent.',
    auth: 'staff',
    status: 201,
    body: SessionInput,
    response: Session,
  },
  async ({ body }) => {
    const id = newId('ses');
    await run(`
      INSERT INTO sessions (id, title, description, instructor_name, category, location, starts_at, ends_at, capacity, min_age, max_age, price_cents, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id, body.title, body.description, body.instructorName, body.category, body.location,
      body.startsAt, body.endsAt, body.capacity, body.minAge, body.maxAge, body.priceCents, new Date().toISOString(),
    ]);
    return getSession(id);
  },
);
