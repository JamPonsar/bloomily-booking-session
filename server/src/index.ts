import { app } from './app.ts';
import { ready } from './db.ts';

const PORT = Number(process.env.PORT ?? 3001);

// Fail fast (with a clear message) if the database is unreachable, and seed before the first request.
await ready();
app.listen(PORT, () => console.log(`[api] listening on http://localhost:${PORT}`));
