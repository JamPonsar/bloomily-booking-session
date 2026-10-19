import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HttpError, apiRouter, errorHandler } from './http.ts';
import { ready } from './db.ts';
// Each module registers its routes on apiRouter as a side effect.
import './routes/sessions.ts';
import './routes/parents.ts';
import './routes/bookings.ts';
import './routes/staff.ts';
import './routes/presence.ts';
import './routes/meta.ts';

/**
 * The Express app, without a listener. server/src/index.ts serves it locally and
 * api/index.js hands it to Vercel as a serverless function.
 */
export const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
// First request on a fresh instance creates the tables / demo data if needed.
app.use('/api', async (_req, _res, next) => {
  await ready();
  next();
});
app.use('/api', apiRouter);
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'No such endpoint — see GET /api/meta')));
app.use(errorHandler);

// `npm start` serves the built client from the same origin (Vercel serves it statically instead).
const dist = fileURLToPath(new URL('../../client/dist', import.meta.url));
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL && existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(`${dist}/index.html`));
}

export default app;
