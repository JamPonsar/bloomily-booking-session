// Vercel serverless entry. vercel.json rewrites /api/* here; Express does the routing.
// The server is TypeScript, run directly by Node's built-in type stripping (Node 22.18+/24).
export { default } from '../server/src/app.ts';
