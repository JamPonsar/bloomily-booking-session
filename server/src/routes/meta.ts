import { z } from 'zod';
import type { ApiMeta, JsonSchema } from '../../../shared/schemas.ts';
import { db } from '../db.ts';
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

function describeTables(): ApiMeta['tables'] {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid").all() as Array<{ name: string }>;
  return tables.map(({ name }) => {
    const columns = (db.prepare(`PRAGMA table_info(${name})`).all() as Array<{ name: string; type: string; notnull: number; pk: number; dflt_value: string | null }>).map(
      (c) => ({ name: c.name, type: c.type, notNull: c.notnull === 1, primaryKey: c.pk > 0, defaultValue: c.dflt_value }),
    );
    const foreignKeys = (db.prepare(`PRAGMA foreign_key_list(${name})`).all() as Array<{ from: string; table: string; to: string; on_delete: string }>).map(
      (f) => ({ column: f.from, table: f.table, references: f.to, onDelete: f.on_delete }),
    );
    const indexes = (db.prepare(`PRAGMA index_list(${name})`).all() as Array<{ name: string; unique: number; partial: number; origin: string }>)
      .filter((i) => i.origin !== 'pk')
      .map((i) => ({
        name: i.name,
        unique: i.unique === 1,
        partial: i.partial === 1,
        columns: (db.prepare(`PRAGMA index_info(${i.name})`).all() as Array<{ name: string }>).map((c) => c.name),
      }));
    return { name, columns, foreignKeys, indexes };
  });
}

defineRoute(
  {
    method: 'get',
    path: '/meta',
    tag: 'Meta',
    summary: 'Describe this API',
    description: 'Generated at runtime from the route registry, the Zod schemas and SQLite introspection — the docs page can never drift from the code.',
    auth: 'public',
    response: z.custom<ApiMeta>(),
  },
  () => {
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
      tables: describeTables(),
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
