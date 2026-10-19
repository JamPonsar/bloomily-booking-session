import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const path = process.env.DB_PATH ?? fileURLToPath(new URL('../../data/bloomily.db', import.meta.url));
for (const suffix of ['', '-wal', '-shm']) rmSync(path + suffix, { force: true });
console.log(`Removed ${path}. Demo data will be re-seeded on next server start.`);
