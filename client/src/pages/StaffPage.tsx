import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarClock, ChevronDown, ClipboardList, Clock, MapPin, Phone, Plus, School, Search, Users, UtensilsCrossed } from 'lucide-react';
import { api } from '../api/client';
import { LiveCount } from '../components/LiveCount';
import { Modal } from '../components/Modal';
import { SessionForm } from '../components/SessionForm';
import { SpotsPill } from '../components/CapacityBar';
import { Avatar, EmptyState, Skeleton } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { usePresenceCounts, useSessionRoom } from '../hooks/usePresence';
import { invalidate, useQuery } from '../hooks/useQuery';
import { CATEGORIES } from '../lib/categories';
import { dayLabel, formatDateTime, formatTimeRange, isLive, plural, relative } from '../lib/format';

/** Demo school the staff view belongs to (generic, not a real institution). */
const SCHOOL = { name: 'Howell Road Elementary', tagline: 'Preschool – 5th grade · Enrichment programs' };

/** Staff dashboard for a school's enrichment programs: session sidebar + roster panel. */
export function StaffPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const sessions = useQuery('sessions', () => api.listSessions(), { intervalMs: 10000 });
  const counts = usePresenceCounts();

  const selectedId = params.get('session') ?? sessions.data?.[0]?.id ?? null;
  const roster = useQuery(`roster:${selectedId}`, () => api.getRoster(selectedId!), { enabled: !!selectedId, intervalMs: 5000 });
  const liveCount = useSessionRoom(selectedId);

  useEffect(() => {
    if (!params.get('session') && sessions.data?.[0]) setParams({ session: sessions.data[0].id }, { replace: true });
  }, [params, sessions.data, setParams]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (sessions.data ?? []).filter((s) => !q || `${s.title} ${s.instructorName}`.toLowerCase().includes(q));
  }, [sessions.data, search]);

  const totals = useMemo(() => {
    const list = sessions.data ?? [];
    const kids = list.reduce((a, s) => a + s.bookedCount, 0);
    const seats = list.reduce((a, s) => a + s.capacity, 0);
    return { sessions: list.length, kids, fill: seats ? Math.round((kids / seats) * 100) : 0 };
  }, [sessions.data]);

  const r = roster.data;
  const session = r?.session;
  const withNeeds = r?.roster.filter((e) => e.child.dietaryRestrictions.length > 0).length ?? 0;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Rosters</h1>
          <p className="muted">
            {sessions.data
              ? `${plural(totals.kids, 'booking')} across ${plural(totals.sessions, 'session')}, and ${totals.fill}% of seats are filled.`
              : 'Loading this week…'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> New session</button>
      </header>

      <div className="app-frame">
        <aside className="app-sidebar">
          <div className="org-chip">
            <span className="org-mark"><School size={20} /></span>
            <span className="org-text">
              <strong>{SCHOOL.name}</strong>
              <span>{SCHOOL.tagline}</span>
            </span>
          </div>
          <label className="search search-sm">
            <Search size={15} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a session" aria-label="Filter sessions" />
          </label>
          {sessions.loading && !sessions.data ? <Skeleton height={44} count={6} /> : (
            <ul className="side-list">
              {filtered.map((s) => {
                const { Icon } = CATEGORIES[s.category];
                return (
                  <li key={s.id}>
                    <button className={`side-item cat-${s.category} ${s.id === selectedId ? 'selected' : ''}`} onClick={() => setParams({ session: s.id })}>
                      <span className="side-icon"><Icon size={15} /></span>
                      <span className="side-text">
                        <strong>{s.title}</strong>
                        <span>{isLive(s) ? <span className="now-tag">Live</span> : dayLabel(s.startsAt)} · {formatTimeRange(s.startsAt, s.endsAt)}</span>
                      </span>
                      <span className="side-count">{s.bookedCount}/{s.capacity}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="app-main">
          {!selectedId ? (
            <EmptyState icon={<ClipboardList size={26} />} title="No sessions scheduled" />
          ) : roster.loading && !r ? (
            <Skeleton height={60} count={5} />
          ) : roster.error ? (
            <div className="alert alert-error">{roster.error.message}</div>
          ) : session && r ? (
            <>
              <div className="roster-head">
                <div>
                  <h2>{session.title}</h2>
                  <p className="roster-summary">
                    {r.roster.length === 0
                      ? 'No one is booked yet. Children will appear here as parents book.'
                      : `${plural(r.roster.length, 'child')} ${r.roster.length === 1 ? 'is' : 'are'} booked, and ${withNeeds === 0 ? 'nobody has' : `${withNeeds} ${withNeeds === 1 ? 'has' : 'have'}`} dietary needs.`}
                  </p>
                  <div className="roster-meta">
                    <span><CalendarClock size={14} /> {dayLabel(session.startsAt)}, {formatTimeRange(session.startsAt, session.endsAt)}</span>
                    <span><MapPin size={14} /> {session.location}</span>
                    <span><Users size={14} /> Ages {session.minAge}–{session.maxAge}</span>
                  </div>
                </div>
                <LiveCount count={liveCount ?? counts[session.id]} live={isLive(session)} />
              </div>

              <div className="tiles">
                <div className="tile"><span className="tile-label">Booked</span><span className="tile-num">{session.bookedCount} of {session.capacity}</span><span className="tile-hint">{session.instructorName}</span></div>
                <div className="tile"><span className="tile-label">Spots left</span><span className="tile-num">{session.spotsLeft}</span><span className={`tile-hint ${session.spotsLeft === 0 ? 'warn' : 'good'}`}>{session.spotsLeft === 0 ? 'Session is full' : 'Still open to book'}</span></div>
                <div className="tile"><span className="tile-label">Dietary needs</span><span className="tile-num">{withNeeds}</span><span className={`tile-hint ${withNeeds ? 'warn' : 'good'}`}>{withNeeds ? 'Check the list before snack' : 'Nothing to prep'}</span></div>
              </div>

              <div className="panel-grid">
                <div className="panel">
                  <div className="panel-head">Children <SpotsPill session={session} /></div>
                  {r.roster.length === 0 ? (
                    <p className="muted small panel-empty">Nobody yet.</p>
                  ) : (
                    <ul className="rows">
                      {r.roster.map((e) => (
                        <li key={e.bookingId} className="row-wrap">
                          <div className="row">
                            <Avatar name={`${e.child.firstName} ${e.child.lastName}`} tone="peach" size={32} />
                            <span className="row-main">
                              <strong>{e.child.firstName} {e.child.lastName}</strong>
                              <span>Age {e.child.age} · booked {formatDateTime(e.bookedAt)}</span>
                              {e.details ? (
                                <button className="detail-toggle" aria-expanded={open === e.bookingId} onClick={() => setOpen(open === e.bookingId ? null : e.bookingId)}>
                                  <Phone size={12} /> Family details <ChevronDown size={12} className={open === e.bookingId ? 'flip' : ''} />
                                </button>
                              ) : (
                                <span className="lock-note"><Clock size={12} /> Family details unlock {relative(e.detailsUnlockAt)}</span>
                              )}
                            </span>
                            <span className="tag-row row-tags">
                              {e.child.dietaryRestrictions.length
                                ? e.child.dietaryRestrictions.map((d) => <span key={d} className={`pill ${/allerg/i.test(d) ? 'pill-alert' : 'pill-neutral'}`}>{d}</span>)
                                : <span className="pill pill-ok">Ready</span>}
                            </span>
                          </div>
                          {e.details && open === e.bookingId && (
                            <dl className="details-grid">
                              <div><dt>Parent</dt><dd>{e.details.parentName}</dd></div>
                              <div><dt>Phone</dt><dd>{e.details.parentPhone || '—'}</dd></div>
                              <div><dt>Email</dt><dd>{e.details.parentEmail}</dd></div>
                              <div><dt>Address</dt><dd>{e.details.address || '—'}</dd></div>
                              <div><dt>Emergency contact</dt><dd>{e.details.emergencyContactName ? `${e.details.emergencyContactName} · ${e.details.emergencyContactPhone}` : '—'}</dd></div>
                              <div><dt>Medical notes</dt><dd>{e.details.medicalNotes || 'None'}</dd></div>
                            </dl>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="panel">
                  <div className="panel-head"><span><UtensilsCrossed size={15} /> Dietary prep</span></div>
                  {r.dietarySummary.length === 0 ? (
                    <p className="muted small panel-empty">No dietary restrictions on this roster.</p>
                  ) : (
                    <ul className="rows">
                      {r.dietarySummary.map((d) => (
                        <li key={d.label} className="row">
                          <span className="row-main"><strong>{d.label}</strong></span>
                          <span className="row-num">{plural(d.count, 'child')}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <p className="roster-privacy"><Clock size={14} /> Family details (parent contact, address, emergency contact, medical notes) appear 24 hours after each booking. Until then you only see name, age and dietary needs.</p>
            </>
          ) : null}
        </section>
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="Schedule a session" size="lg">
        <SessionForm onCancel={() => setCreating(false)} onSaved={(s) => {
          setCreating(false);
          toast(`"${s.title}" is now open for booking`);
          invalidate('sessions');
          setParams({ session: s.id });
        }} />
      </Modal>
    </div>
  );
}
