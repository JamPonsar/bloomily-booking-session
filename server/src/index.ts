import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HttpError, apiRouter, errorHandler } from './http.ts';
// Each module registers its routes on apiRouter as a side effect.
import './routes/sessions.ts';
import './routes/parents.ts';
import './routes/bookings.ts';
import './routes/staff.ts';
import './routes/presence.ts';
import './routes/meta.ts';

const PORT = Number(process.env.PORT ?? 3001);
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use('/api', apiRouter);
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'No such endpoint — see GET /api/meta')));
app.use(errorHandler);

// In production, serve the built client from the same origin.
const dist = fileURLToPath(new URL('../../client/dist', import.meta.url));
if (process.env.NODE_ENV === 'production' && existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(`${dist}/index.html`));
}

app.listen(PORT, () => console.log(`[api] listening on http://localhost:${PORT}`));
