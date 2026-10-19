import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarX2, Radio, Search, Sparkles } from 'lucide-react';
import { SESSION_CATEGORIES } from '../../../shared/schemas';
import type { Session, SessionCategory } from '../../../shared/schemas';
import { api } from '../api/client';
import { BookingFlow } from '../components/BookingFlow';
import { CalendarGrid } from '../components/CalendarGrid';
import { ViewToggle, useViewMode } from '../components/ViewToggle';
import { SessionCard } from '../components/SessionCard';
import { EmptyState, Skeleton } from '../components/ui';
import { useApp } from '../context/AppContext';
import { usePresenceCounts } from '../hooks/usePresence';
import { useQuery } from '../hooks/useQuery';
import { CATEGORIES } from '../lib/categories';
import { dayKey, dayLabel, isLive, localDateKey, longDayLabel } from '../lib/format';

/** Home page: browse upcoming sessions grouped by day, with live head-counts and booking. */
export function SessionsPage() {
  const { role } = useApp();
  const navigate = useNavigate();
  const [category, setCategory] = useState<SessionCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [booking, setBooking] = useState<Session | null>(null);
  const [view, setView] = useViewMode();
  const [selectedDay, setSelectedDay] = useState(() => localDateKey(new Date()));

  const sessions = useQuery('sessions', () => api.listSessions(), { intervalMs: 15000 });
  const myBookings = useQuery(`bookings:${role}`, api.listMyBookings, { enabled: role === 'parent' });
  const profile = useQuery(`profile:${role}`, api.getProfile, { enabled: role === 'parent' });
  const counts = usePresenceCounts();

  const bookedBySession = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const b of myBookings.data ?? []) {
      if (b.status !== 'confirmed') continue;
      map.set(b.sessionId, [...(map.get(b.sessionId) ?? []), b.child.firstName]);
    }
    return map;
  }, [myBookings.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (sessions.data ?? []).filter((s) =>
      (category === 'all' || s.category === category) &&
      (!q || `${s.title} ${s.instructorName} ${s.location}`.toLowerCase().includes(q)),
    );
  }, [sessions.data, category, search]);

  const live = filtered.filter((s) => isLive(s));
  const groups = useMemo(() => {
    const out = new Map<string, Session[]>();
    for (const s of filtered) {
      if (isLive(s)) continue;
      const k = dayKey(s.startsAt);
      out.set(k, [...(out.get(k) ?? []), s]);
    }
    return [...out];
  }, [filtered]);

  const daySessions = useMemo(() => filtered.filter((x) => localDateKey(x.startsAt) === selectedDay), [filtered, selectedDay]);
  const totalLive = Object.values(counts).reduce((a, b) => a + b, 0);
  const totalBooked = (sessions.data ?? []).reduce((a, s) => a + s.bookedCount, 0);
  const totalSpots = (sessions.data ?? []).reduce((a, s) => a + s.spotsLeft, 0);
  const onAction = (s: Session) => (role === 'staff' ? navigate(`/staff?session=${s.id}`) : setBooking(s));

  const card = (s: Session) => (
    <SessionCard key={s.id} session={s} liveCount={counts[s.id]} bookedChildren={bookedBySession.get(s.id)} mode={role} onAction={onAction} />
  );

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-sun" aria-hidden />
        <div className="hero-cloud hero-cloud-1" aria-hidden />
        <div className="hero-cloud hero-cloud-2" aria-hidden />
        <p className="eyebrow"><Sparkles size={14} /> {role === 'staff' ? 'Staff view' : profile.data ? `Welcome back, ${profile.data.firstName}` : 'Welcome'}</p>
        {role === 'staff' ? (
          <h1>Sessions, rosters and snacks,<br /><Underlined>the way your team preps.</Underlined></h1>
        ) : (
          <h1>Classes, camps and clubs,<br /><Underlined>the way your family books.</Underlined></h1>
        )}
        <p className="hero-sub">
          {role === 'staff'
            ? `${totalBooked} children are booked across ${sessions.data?.length ?? 0} upcoming sessions.`
            : 'Pick a session, choose your child, and see exactly what staff will know before you confirm.'}
        </p>
        <a href="#sessions" className="btn btn-cta">{role === 'staff' ? 'See today’s sessions' : 'Browse sessions'} <ArrowRight size={18} /></a>

        <div className="hero-stats">
          <div className="stat"><span className="stat-label">Upcoming</span><span className="stat-num">{sessions.data?.length ?? '–'}</span><span className="stat-hint">sessions open to book</span></div>
          <div className="stat"><span className="stat-label">Here now</span><span className="stat-num">{totalLive}</span><span className="stat-hint good"><span className="live-dot" /> people online right now</span></div>
          <div className="stat"><span className="stat-label">Spots</span><span className="stat-num">{totalSpots}</span><span className="stat-hint">still open this week</span></div>
        </div>
      </section>

      <div className="toolbar" id="sessions">
        <div className="chips" role="tablist" aria-label="Filter by category">
          <button role="tab" aria-selected={category === 'all'} className={`chip ${category === 'all' ? 'active' : ''}`} onClick={() => setCategory('all')}>All</button>
          {SESSION_CATEGORIES.map((c) => {
            const { Icon, label } = CATEGORIES[c];
            return (
              <button key={c} role="tab" aria-selected={category === c} className={`chip cat-${c} ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>
                <Icon size={14} /> {label}
              </button>
            );
          })}
        </div>
        <ViewToggle mode={view} onChange={setView} />
        <label className="search">
          <Search size={16} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sessions, leads, rooms…" aria-label="Search sessions" />
        </label>
      </div>

      {sessions.error && <div className="alert alert-error">{sessions.error.message}</div>}

      {sessions.loading && !sessions.data ? (
        <div className="grid"><Skeleton height={340} count={6} /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<CalendarX2 size={26} />} title="No sessions match">Try a different category or clear your search.</EmptyState>
      ) : (
        <>
          {view === 'calendar' ? (
            <>
              <CalendarGrid selectedKey={selectedDay} onSelectDay={setSelectedDay}
                events={filtered.map((x) => ({ id: x.id, startsAt: x.startsAt, label: x.title, category: x.category }))} />
              <section className="day-group">
                <h2 className="day-heading">{longDayLabel(selectedDay)} <span className="muted small">· {daySessions.length} session{daySessions.length === 1 ? '' : 's'}</span></h2>
                {daySessions.length === 0
                  ? <p className="muted">Nothing scheduled this day. Pick another date on the calendar.</p>
                  : <div className="grid">{daySessions.map(card)}</div>}
              </section>
            </>
          ) : (
            <>
            {live.length > 0 && (
              <section className="day-group">
                <h2 className="day-heading live-heading"><Radio size={18} /> Happening now</h2>
                <div className="grid">{live.map(card)}</div>
              </section>
            )}
            {groups.map(([key, list]) => (
              <section key={key} className="day-group">
                <h2 className="day-heading">{dayLabel(list[0].startsAt)} <span className="muted small">· {list.length} session{list.length > 1 ? 's' : ''}</span></h2>
                <div className="grid">{list.map(card)}</div>
              </section>
            ))}
            </>
          )}
        </>
      )}

      <BookingFlow session={booking} onClose={() => setBooking(null)} />
    </div>
  );
}

/** Orange hand-drawn underline, as on bloomily.app headlines. */
function Underlined({ children }: { children: ReactNode }) {
  return (
    <span className="underlined">
      {children}
      <svg viewBox="0 0 400 14" preserveAspectRatio="none" aria-hidden><path d="M3 9 C 90 3, 210 2, 397 7" /></svg>
    </span>
  );
}
