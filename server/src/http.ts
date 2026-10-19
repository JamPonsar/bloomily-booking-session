import { Router } from 'express';
import type { ErrorRequestHandler, Request, Response } from 'express';
import { z } from 'zod';
import { get } from './db.ts';

/* -------------------------------------------------------------------------- */
/*                                   Errors                                   */
/* -------------------------------------------------------------------------- */

export class HttpError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const notFound = (what: string) => new HttpError(404, 'NOT_FOUND', `${what} not found`);

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, fields: err.fields } });
    return;
  }
  if (err instanceof z.ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_';
      fields[key] ??= issue.message;
    }
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Please check the highlighted fields', fields } });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
    return;
  }
  if (err?.code === 'NO_DATABASE_URL') {
    res.status(503).json({ error: { code: 'DATABASE_NOT_CONFIGURED', message: err.message } });
    return;
  }
  if (err?.code === '23505') {
    res.status(409).json({ error: { code: 'CONFLICT', message: 'That record already exists' } });
    return;
  }
  if (err?.code === '23503') {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'A referenced record was not found' } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong on our side' } });
};

/* -------------------------------------------------------------------------- */
/*                                    Auth                                    */
/* -------------------------------------------------------------------------- */

/**
 * Demo-grade identity: the client sends `X-Role` (parent | staff) and, for
 * parents, `X-Parent-Id`. Swap this for real sessions/JWTs in production —
 * every route already declares the role it requires.
 */
export type Role = 'public' | 'parent' | 'staff';
export type AuthContext = { role: 'public' } | { role: 'staff' } | { role: 'parent'; parentId: string };

async function resolveAuth(req: Request): Promise<AuthContext> {
  const role = req.header('x-role');
  if (role === 'staff') return { role: 'staff' };
  if (role === 'parent') {
    const parentId = req.header('x-parent-id');
    if (parentId && (await get('SELECT 1 FROM parents WHERE id = ?', [parentId]))) return { role: 'parent', parentId };
  }
  return { role: 'public' };
}

/* -------------------------------------------------------------------------- */
/*                               Route registry                               */
/* -------------------------------------------------------------------------- */

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
type Schema = z.ZodType | undefined;
type In<T extends Schema> = T extends z.ZodType ? z.output<T> : undefined;
type Out<T extends Schema> = T extends z.ZodType ? z.input<T> : void;

export interface RouteMeta {
  method: Method;
  path: string;
  tag: string;
  summary: string;
  description?: string;
  auth: Role;
  status?: number;
  query?: z.ZodType;
  body?: z.ZodType;
  response?: z.ZodType;
}

export interface Ctx<TBody, TQuery, A extends Role> {
  body: TBody;
  query: TQuery;
  params: Record<string, string>;
  auth: A extends 'parent' ? { role: 'parent'; parentId: string } : A extends 'staff' ? { role: 'staff' } : AuthContext;
  req: Request;
  res: Response;
}

export const apiRouter = Router();
export const registry: RouteMeta[] = [];

/**
 * Registers an Express route AND records its metadata for GET /api/meta.
 * - Request bodies / queries are parsed with their Zod schema (400 on failure).
 * - Responses are parsed with the response schema, which strips any field not
 *   in the contract — the privacy guarantee for staff endpoints relies on this.
 */
export function defineRoute<A extends Role, B extends Schema = undefined, Q extends Schema = undefined, R extends Schema = undefined>(
  meta: { method: Method; path: string; tag: string; summary: string; description?: string; auth: A; status?: number; body?: B; query?: Q; response?: R },
  handler: (ctx: Ctx<In<B>, In<Q>, A>) => Out<R> | Promise<Out<R>>,
): void {
  registry.push(meta as RouteMeta);

  apiRouter[meta.method](meta.path, async (req, res) => {
    const auth = await resolveAuth(req);
    if (meta.auth !== 'public' && auth.role !== meta.auth) {
      throw auth.role === 'public'
        ? new HttpError(401, 'UNAUTHENTICATED', `Sign in as ${meta.auth} to use this endpoint`)
        : new HttpError(403, 'FORBIDDEN', `Only ${meta.auth} accounts can use this endpoint`);
    }

    const body = meta.body ? meta.body.parse(req.body ?? {}) : undefined;
    const query = meta.query ? meta.query.parse(req.query) : undefined;

    const result = await handler({ body, query, params: req.params as Record<string, string>, auth, req, res } as Ctx<In<B>, In<Q>, A>);

    const status = meta.status ?? 200;
    if (status === 204 || !meta.response) {
      res.status(status).end();
    } else {
      res.status(status).json(meta.response.parse(result));
    }
  });
}
