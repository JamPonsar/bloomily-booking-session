import { Fragment, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, Database, Key, Link2, Lock, Play, Puzzle, Server, Shapes } from 'lucide-react';
import type { ApiMeta, JsonSchema } from '../../../shared/schemas';
import { api, getAuthHeaders } from '../api/client';
import { COMPONENTS } from '../components/registry';
import { Skeleton, Spinner } from '../components/ui';
import { useApp } from '../context/AppContext';
import { useQuery } from '../hooks/useQuery';

type Endpoint = ApiMeta['endpoints'][number];
const CORE_SCHEMAS = ['Parent', 'Child', 'Session', 'Booking'];
const refName = (ref: string) => ref.split('/').pop()!;

/** Reference page generated from GET /api/meta: endpoints, schemas, database tables and UI components. */
export function ApiDocsPage() {
  const { data: meta, loading, error } = useQuery('meta', api.getMeta);

  const tags = useMemo(() => {
    const m = new Map<string, Endpoint[]>();
    for (const e of meta?.endpoints ?? []) m.set(e.tag, [...(m.get(e.tag) ?? []), e]);
    return [...m];
  }, [meta]);

  const schemaNames = useMemo(() => {
    const names = Object.keys(meta?.schemas ?? {});
    return [...CORE_SCHEMAS.filter((n) => names.includes(n)), ...names.filter((n) => !CORE_SCHEMAS.includes(n))];
  }, [meta]);

  return (
    <div className="page docs">
      <header className="page-header">
        <div>
          <h1>API & Schemas</h1>
          <p className="muted">Generated live from the server's route registry, Zod schemas and Postgres catalog. It can't drift out of date.</p>
        </div>
      </header>

      <div className="docs-layout">
        <nav className="docs-nav">
          <a href="#overview"><Server size={15} /> Overview</a>
          <a href="#relations"><Link2 size={15} /> Relationships</a>
          <a href="#endpoints"><Play size={15} /> Endpoints</a>
          {tags.map(([t]) => <a key={t} className="sub" href={`#tag-${t}`}>{t}</a>)}
          <a href="#schemas"><Shapes size={15} /> Schemas</a>
          <a href="#database"><Database size={15} /> Database</a>
          <a href="#components"><Puzzle size={15} /> Components</a>
        </nav>

        <div className="docs-main">
          {error && <div className="alert alert-error">{error.message}</div>}

          <section id="overview" className="card docs-section">
            <h2>Overview</h2>
            <div className="overview-grid">
              <div><h4>Base URL</h4><code>/api</code><p className="muted small">JSON in, JSON out. The Vite dev server proxies to Express on :3001.</p></div>
              <div><h4>Identity (demo)</h4><code>X-Role: parent | staff</code><br /><code>X-Parent-Id: par_demo</code><p className="muted small">Set automatically by the view switcher. Each route declares the role it requires.</p></div>
              <div><h4>Errors</h4><code>{'{ error: { code, message, fields? } }'}</code><p className="muted small">400 validation · 401/403 auth · 404 · 409 conflict (full, duplicate) · 422 age range.</p></div>
              <div><h4>Privacy guarantee</h4><p className="small">Staff always get <a href="#schema-StaffChildView">StaffChildView</a>. Family details (<a href="#schema-StaffFamilyDetails">StaffFamilyDetails</a>) stay <code>null</code> until the booking is 24 hours old, and are blanked in SQL before then.</p></div>
            </div>
          </section>

          <section id="relations" className="card docs-section">
            <h2>Relationships</h2>
            <ErDiagram />
          </section>

          <section id="endpoints" className="docs-section">
            <h2 className="section-title">Endpoints <span className="muted small">{meta?.endpoints.length ?? ''}</span></h2>
            {loading && !meta ? <Skeleton height={56} count={6} /> : tags.map(([tag, list]) => (
              <div key={tag} id={`tag-${tag}`} className="endpoint-group">
                <h3>{tag}</h3>
                {list.map((e) => <EndpointRow key={e.method + e.path} e={e} />)}
              </div>
            ))}
          </section>

          <section id="schemas" className="docs-section">
            <h2 className="section-title">Schemas</h2>
            <p className="muted small">The four core objects come first. Request/response shapes follow.</p>
            {loading && !meta ? <Skeleton height={200} count={2} /> : (
              <div className="schema-grid">
                {schemaNames.map((n) => <SchemaCard key={n} name={n} schema={meta!.schemas[n]} core={CORE_SCHEMAS.includes(n)} />)}
              </div>
            )}
          </section>

          <section id="database" className="docs-section">
            <h2 className="section-title">Database tables</h2>
            <p className="muted small">Read from Postgres at request time (<code>information_schema</code> and <code>pg_indexes</code>).</p>
            <div className="schema-grid">
              {meta?.tables.map((t) => <TableCard key={t.name} table={t} />)}
            </div>
          </section>

          <section id="components" className="docs-section">
            <h2 className="section-title">Frontend components</h2>
            {(['Page', 'Component', 'Hook', 'Context', 'Library'] as const).map((kind) => (
              <div key={kind} className="component-group">
                <h3>{kind === 'Library' ? 'Libraries' : `${kind}s`}</h3>
                <div className="component-grid">
                  {COMPONENTS.filter((c) => c.kind === kind).map((c) => (
                    <div key={c.name} className="component-card">
                      <div className="component-name">{c.name}</div>
                      <code className="component-file">{c.file}</code>
                      <p>{c.description}</p>
                      {c.apis && <div className="component-apis">{c.apis.map((a) => <span key={a} className="api-chip"><Method m={a.split(' ')[0]} />{a.split(' ')[1]}</span>)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}

function Method({ m }: { m: string }) {
  return <span className={`method method-${m.toLowerCase()}`}>{m}</span>;
}

function EndpointRow({ e }: { e: Endpoint }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`endpoint ${open ? 'open' : ''}`}>
      <button className="endpoint-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Method m={e.method} />
        <code className="endpoint-path">{e.path}</code>
        <span className="endpoint-summary">{e.summary}</span>
        {e.auth !== 'public' && <span className={`auth-chip auth-${e.auth}`}><Lock size={11} /> {e.auth}</span>}
        <ChevronDown size={16} className="chev" />
      </button>
      {open && (
        <div className="endpoint-body">
          {e.description && <p>{e.description}</p>}
          <div className="endpoint-io">
            {e.query && <div><h5>Query</h5><SchemaView schema={e.query} /></div>}
            {e.body && <div><h5>Request body</h5><SchemaView schema={e.body} /></div>}
            <div><h5>Response <span className="status">{e.status}</span></h5>{e.response ? <SchemaView schema={e.response} /> : <span className="muted small">No content</span>}</div>
          </div>
          {e.method === 'GET' && <TryIt e={e} />}
        </div>
      )}
    </div>
  );
}

function TryIt({ e }: { e: Endpoint }) {
  const { role } = useApp();
  const params = [...e.path.matchAll(/:(\w+)/g)].map((m) => m[1]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ ok: boolean; body: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    const path = e.path.replace(/:(\w+)/g, (_, k) => encodeURIComponent(values[k] ?? ''));
    try {
      setResult({ ok: true, body: JSON.stringify(await api.rawGet(path), null, 2) });
    } catch (err) {
      setResult({ ok: false, body: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tryit">
      <div className="tryit-bar">
        {params.map((p) => (
          <input key={p} className="input input-sm" placeholder={p} value={values[p] ?? ''} onChange={(ev) => setValues({ ...values, [p]: ev.target.value })} />
        ))}
        <button className="btn btn-secondary btn-sm" onClick={run} disabled={busy || params.some((p) => !values[p])}>{busy ? <Spinner /> : <Play size={14} />} Try it</button>
        <span className="muted tiny">as <strong>{role}</strong> · {Object.entries(getAuthHeaders()).map(([k, v]) => `${k}: ${v}`).join(', ')}</span>
      </div>
      {result && <pre className={`tryit-out ${result.ok ? '' : 'err'}`}>{result.body.length > 6000 ? `${result.body.slice(0, 6000)}\n…` : result.body}</pre>}
    </div>
  );
}

/** Compact renderer for a JSON Schema node: refs link to the schema card, objects expand to a field table. */
function SchemaView({ schema }: { schema: JsonSchema }) {
  if (schema.$ref) return <a className="ref" href={`#schema-${refName(schema.$ref)}`}>{refName(schema.$ref)}</a>;
  if (schema.type === 'array' && schema.items) return <span className="type">Array&lt;<SchemaView schema={schema.items} />&gt;</span>;
  if (schema.type === 'object' && schema.properties) return <FieldTable schema={schema} />;
  return <span className="type">{typeLabel(schema)}</span>;
}

function typeLabel(s: JsonSchema): ReactNode {
  if (s.$ref) return <a className="ref" href={`#schema-${refName(s.$ref)}`}>{refName(s.$ref)}</a>;
  if (s.anyOf) return s.anyOf.map((x, i) => <Fragment key={i}>{i > 0 && ' | '}{typeLabel(x)}</Fragment>);
  if (s.const !== undefined) return <code>{JSON.stringify(s.const)}</code>;
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(' | ');
  if (s.type === 'array') return <>Array&lt;{s.items ? typeLabel(s.items) : 'any'}&gt;</>;
  if (s.type === 'object' && s.additionalProperties && typeof s.additionalProperties === 'object') return <>Record&lt;string, {typeLabel(s.additionalProperties)}&gt;</>;
  const t = Array.isArray(s.type) ? s.type.join(' | ') : s.type ?? 'any';
  return s.format ? `${t} (${s.format})` : t;
}

function constraints(s: JsonSchema): string {
  const c: string[] = [];
  if (s.minLength !== undefined) c.push(`min ${s.minLength} chars`);
  if (s.maxLength !== undefined) c.push(`max ${s.maxLength} chars`);
  if (s.minimum !== undefined) c.push(`≥ ${s.minimum}`);
  if (s.maximum !== undefined && s.maximum < 9e15) c.push(`≤ ${s.maximum}`);
  if (s.maxItems !== undefined) c.push(`max ${s.maxItems} items`);
  return c.join(', ');
}

function FieldTable({ schema }: { schema: JsonSchema }) {
  const req = new Set(schema.required ?? []);
  return (
    <table className="field-table">
      <tbody>
        {Object.entries(schema.properties ?? {}).map(([name, s]) => (
          <tr key={name}>
            <td className="fname">{name}{!req.has(name) && <span className="opt">?</span>}</td>
            <td className="ftype">{s.type === 'object' && s.properties ? <FieldTable schema={s} /> : typeLabel(s)}</td>
            <td className="fdesc">{[s.description, constraints(s)].filter(Boolean).join(' · ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SchemaCard({ name, schema, core }: { name: string; schema: JsonSchema; core: boolean }) {
  return (
    <div id={`schema-${name}`} className={`schema-card ${core ? 'core' : ''}`}>
      <div className="schema-card-head">
        <h3>{name}</h3>
        {core && <span className="core-chip">core</span>}
      </div>
      {schema.description && <p className="muted small">{schema.description}</p>}
      {schema.properties ? <FieldTable schema={schema} /> : <div className="type">{typeLabel(schema)}</div>}
    </div>
  );
}

function TableCard({ table }: { table: ApiMeta['tables'][number] }) {
  const fk = new Map(table.foreignKeys.map((f) => [f.column, f]));
  return (
    <div className="schema-card">
      <div className="schema-card-head"><h3><Database size={15} /> {table.name}</h3></div>
      <table className="field-table">
        <tbody>
          {table.columns.map((c) => (
            <tr key={c.name}>
              <td className="fname">{c.primaryKey && <Key size={11} className="pk" />}{c.name}</td>
              <td className="ftype">{c.type}{c.notNull ? '' : ' NULL'}</td>
              <td className="fdesc">
                {fk.has(c.name) && <span className="fk">→ {fk.get(c.name)!.table}.{fk.get(c.name)!.references} <span className="muted">({fk.get(c.name)!.onDelete.toLowerCase()})</span></span>}
                {c.defaultValue && <span className="muted"> default {c.defaultValue}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {table.indexes.length > 0 && (
        <div className="indexes">
          {table.indexes.map((i) => (
            <span key={i.name} className="index-chip" title={i.name}>{i.unique ? 'UNIQUE ' : ''}({i.columns.join(', ')}){i.partial ? ' WHERE status = confirmed' : ''}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Hand-laid entity-relationship diagram of the four core tables. */
function ErDiagram() {
  const box = (x: number, y: number, title: string, rows: string[], tone: string) => (
    <g transform={`translate(${x},${y})`}>
      <rect width="190" height={34 + rows.length * 20} rx="12" className={`er-box er-${tone}`} />
      <text x="16" y="23" className="er-title">{title}</text>
      {rows.map((r, i) => <text key={r} x="16" y={50 + i * 20} className={`er-row ${r.startsWith('🔑') || r.includes('→') ? 'er-key' : ''}`}>{r}</text>)}
    </g>
  );
  return (
    <div className="er-wrap">
      <svg viewBox="0 0 760 330" className="er" role="img" aria-label="Parent has many Children and Bookings; Session has many Bookings; Child has many Bookings">
        <defs>
          <marker id="many" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="12" markerHeight="12" orient="auto"><path d="M0 0 L11 6 L0 12 M11 0 L11 12" className="er-mark" /></marker>
        </defs>
        <path d="M200 70 H 285" className="er-line" markerEnd="url(#many)" />
        <path d="M105 150 V 230 H 285" className="er-line" markerEnd="url(#many)" />
        <path d="M380 150 V 210" className="er-line" markerEnd="url(#many)" />
        <path d="M570 255 H 485" className="er-line" markerEnd="url(#many)" />
        <text x="206" y="58" className="er-label">1 ─ many</text>
        <text x="115" y="222" className="er-label">1 ─ many</text>
        <text x="390" y="185" className="er-label">1 ─ many</text>
        <text x="506" y="245" className="er-label">many ─ 1</text>
        {box(10, 30, 'Parent', ['🔑 id', 'email (unique)', 'phone · address', 'emergency contact'], 'sage')}
        {box(290, 30, 'Child', ['🔑 id', 'parentId → Parent', 'dateOfBirth', 'dietaryRestrictions'], 'peach')}
        {box(290, 215, 'Booking', ['🔑 id', 'sessionId → Session', 'childId → Child', 'parentId → Parent'], 'lav')}
        {box(570, 200, 'Session', ['🔑 id', 'instructorName', 'startsAt · endsAt', 'capacity · ages'], 'sky')}
      </svg>
    </div>
  );
}
