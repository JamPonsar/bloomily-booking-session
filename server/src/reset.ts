import { pool, resetDemoData } from './db.ts';

await resetDemoData();
console.log('Demo data wiped and re-created.');
await pool.end();
