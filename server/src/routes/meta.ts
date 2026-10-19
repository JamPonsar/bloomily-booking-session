import { z } from 'zod';
import type { ApiMeta, JsonSchema } from '../../../shared/schemas.ts';
import { all } from '../db.ts';
import { defineRoute, registry } from '../http.ts';

/** Converts a Zod schema to readable JSON Schema: named schemas become refs, noisy regexes are dropped. */
function toJson(schema: z.ZodType | undefined): JsonSchema | null {
  if (!schema) return null;
  const id = z.globalRegistry.get(schema)?.id;
  if (id) return { $ref: `#/schemas/${id}` };
  const { $schema, $defs, ...rest } = z.toJSONSchema(schema, { unrepresentable: 'any', io: 'input' }) as Record<string, unknown>;
  return clean(rest) as JsonSchema;
}

function clean(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(clean);
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === 'pattern' && 'format' in node) continue;
    if (k === '$ref' && typeof v === 'string') out[k] = `#/schemas/${v.split('/').pop()}`;
    else out[k] = clean(v);
  }
  return out;
}

const TABLES = ['parents', 'children', 'sessions', 'bookings', 'presence'];

/** Reads the live Postgres catalog so the docs show the real columns, keys and indexes. */
async function describeTables(): Promise<ApiMeta['tables']> {
  return Promise.all(TABLES.map(async (name) => {
    const [cols, pks, fks, idx] = await Promise.all([
      all<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }>(
        `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = ? ORDER BY ordinal_position`, [name]),
      all<{ attname: string }>(
        `SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
         WHERE i.indrelid = ?::regclass AND i.indisprimary`, [name]),
      all<{ col: string; ftable: string; fcol: string; delete_rule: string }>(
        `SELECT kcu.column_name AS col, ccu.table_name AS ftable, ccu.column_name AS fcol, rc.delete_rule
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
         JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
         JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
         WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' AND tc.table_name = ?`, [name]),
      all<{ indexname: string; indexdef: string }>(
        `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = ? AND indexname NOT LIKE '%\_pkey'`, [name]),
    ]);
    const primary = new Set(pks.map((p) => p.attname));
    return {
      name,
      columns: cols.map((c) => ({
        name: c.column_name,
        type: c.data_type.toUpperCase(),
        notNull: c.is_nullable === 'NO',
        primaryKey: primary.has(c.column_name),
        defaultValue: c.column_default,
      })),
      foreignKeys: fks.map((f) => ({ column: f.col, table: f.ftable, references: f.fcol, onDelete: f.delete_rule })),
      indexes: idx.map((i) => ({
        name: i.indexname,
        unique: /CREATE UNIQUE/.test(i.indexdef),
        partial: /\sWHERE\s/.test(i.indexdef),
        columns: (/\(([^)]+)\)/.exec(i.indexdef)?.[1] ?? '').split(',').map((c) => c.trim()),
      })),
    };
  }));
}

defineRoute(
  {
    method: 'get',
    path: '/meta',
    tag: 'Meta',
    summary: 'Describe this API',
    description: 'Generated at runtime from the route registry, the Zod schemas and the Postgres catalog — the docs page can never drift from the code.',
    auth: 'public',
    response: z.custom<ApiMeta>(),
  },
  async () => {
    const { schemas } = z.toJSONSchema(z.globalRegistry, { unrepresentable: 'any', io: 'input', uri: (id) => `#/schemas/${id}` }) as { schemas: Record<string, unknown> };
    const cleaned = Object.fromEntries(Object.entries(schemas).map(([k, v]) => {
      const { $schema, $id, ...rest } = v as Record<string, unknown>;
      return [k, clean(rest)];
    })) as Record<string, JsonSchema>;

    return {
      endpoints: registry.map((r) => ({
        method: r.method.toUpperCase() as ApiMeta['endpoints'][number]['method'],
        path: `/api${r.path}`,
        tag: r.tag,
        summary: r.summary,
        description: r.description,
        auth: r.auth,
        status: r.status ?? 200,
        query: toJson(r.query),
        body: toJson(r.body),
        response: r.status === 204 ? null : toJson(r.response),
      })),
      schemas: cleaned,
      tables: await describeTables(),
    };
  },
);

defineRoute(
  {
    method: 'get',
    path: '/health',
    tag: 'Meta',
    summary: 'Health check',
    auth: 'public',
    response: z.object({ ok: z.literal(true), time: z.string() }),
  },
  () => ({ ok: true as const, time: new Date().toISOString() }),
);
