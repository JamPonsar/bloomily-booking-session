import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CalendarHeart, CalendarPlus, MapPin, XCircle } from 'lucide-react';
import type { ParentBooking } from '../../../shared/schemas';
import { ApiRequestError, api } from '../api/client';
import { CalendarGrid } from '../components/CalendarGrid';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DelayedShareNote } from '../components/PrivacyBadge';
import { ViewToggle, useViewMode } from '../components/ViewToggle';
import { Avatar, EmptyState, Skeleton } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { invalidate, useQuery } from '../hooks/useQuery';
import { CATEGORIES } from '../lib/categories';
import { formatShortDate, formatTimeRange, isLive, isPast, localDateKey, longDayLabel, relative } from '../lib/format';
import { downloadIcs } from '../lib/ics';

type Tab = 'upcoming' | 'past' | 'cancelled';

/** Parent's bookings as a list (Upcoming / Past / Cancelled) or on a month calendar. */
export function MyBookingsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [view, setView] = useViewMode();
  const [selectedDay, setSelectedDay] = useState(() => localDateKey(new Date()));
  const [cancelling, setCancelling] = useState<ParentBooking | null>(null);
  const { data, loading, error } = useQuery('bookings', api.listMyBookings);
  const profile = useQuery('profile', api.getProfile);

  const all = data ?? [];
  const buckets: Record<Tab, ParentBooking[]> = {
    upcoming: all.filter((b) => b.status === 'confirmed' && !isPast(b.session)).reverse(),
    past: all.filter((b) => b.status === 'confirmed' && isPast(b.session)),
    cancelled: all.filter((b) => b.status === 'cancelled'),
  };
  const list = buckets[tab];
  // One column per child (including children with no bookings in this tab yet).
  const columns = (profile.data?.children ?? []).map((c) => ({ child: c, items: list.filter((b) => b.childId === c.id) }));
  const known = new Set(columns.map((c) => c.child.id));
  const orphans = list.filter((b) => !known.has(b.childId));
  const confirmed = all.filter((b) => b.status === 'confirmed');
  const dayBookings = confirmed.filter((b) => localDateKey(b.session.startsAt) === selectedDay).sort((a, b) => a.session.startsAt.localeCompare(b.session.startsAt));

  const cancel = async () => {
    if (!cancelling) return;
    try {
      await api.cancelBooking(cancelling.id);
      toast(`${cancelling.child.firstName}'s spot in ${cancelling.session.title} was released`);
      invalidate('bookings', 'sessions', 'roster');
    } catch (e) {
      toast(e instanceof ApiRequestError ? e.message : 'Could not cancel booking', 'error');
    }
  };

  const row = (b: ParentBooking) => {
    const { Icon } = CATEGORIES[b.session.category];
    const live = isLive(b.session);
    const upcoming = b.status === 'confirmed' && !isPast(b.session);
    return (
      <article key={b.id} className={`booking-row cat-${b.session.category} ${b.status === 'cancelled' ? 'is-cancelled' : ''}`}>
        <div className="booking-date">
          <span className="booking-month">{new Date(b.session.startsAt).toLocaleString(undefined, { month: 'short' })}</span>
          <span className="booking-day">{new Date(b.session.startsAt).getDate()}</span>
        </div>
        <div className="booking-main">
          <div className="booking-title"><Icon size={16} /> {b.session.title}</div>
          <div className="booking-meta">
            <span><CalendarClock size={13} /> {formatShortDate(b.session.startsAt)}, {formatTimeRange(b.session.startsAt, b.session.endsAt)}</span>
            <span><MapPin size={13} /> {b.session.location}</span>
          </div>
          <div className="booking-for">
            For <strong>{b.child.firstName}</strong> · with {b.session.instructorName}
            {upcoming && <span className={`when ${live ? 'when-live' : ''}`}>{live ? 'Happening now' : relative(b.session.startsAt)}</span>}
            {b.status === 'cancelled' && b.cancelledAt && <span className="when">Cancelled {relative(b.cancelledAt)}</span>}
          </div>
        </div>
        {upcoming && (
          <div className="booking-actions">
            <button className="icon-btn" title="Add to calendar" aria-label="Add to calendar" onClick={() => downloadIcs(b.session, b.child.firstName)}><CalendarPlus size={18} /></button>
            {!live && <button className="btn btn-ghost btn-sm danger-text" onClick={() => setCancelling(b)}><XCircle size={15} /> Cancel</button>}
          </div>
        )}
      </article>
    );
  };

  return (
    <div className={`page ${view === 'calendar' ? 'narrow' : ''}`}>
      <header className="page-header">
        <div>
          <h1>My bookings</h1>
          <p className="muted">Everything your family has coming up, one column per child.</p>
        </div>
        <Link to="/" className="btn btn-primary">Browse sessions</Link>
      </header>

      <div className="bookings-toolbar">
        {view === 'list' ? (
          <div className="segmented" role="tablist">
            {(['upcoming', 'past', 'cancelled'] as Tab[]).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
                {t[0].toUpperCase() + t.slice(1)} <span className="count">{buckets[t].length}</span>
              </button>
            ))}
          </div>
        ) : <span />}
        <ViewToggle mode={view} onChange={setView} />
      </div>

      {error && <div className="alert alert-error">{error.message}</div>}
      {loading && !data ? (
        <div className="stack"><Skeleton height={110} count={3} /></div>
      ) : view === 'calendar' ? (
        <>
          <CalendarGrid selectedKey={selectedDay} onSelectDay={setSelectedDay}
            events={confirmed.map((b) => ({ id: b.id, startsAt: b.session.startsAt, label: `${b.child.firstName} · ${b.session.title}`, category: b.session.category }))} />
          <section className="day-group">
            <h2 className="day-heading">{longDayLabel(selectedDay)} <span className="muted small">· {dayBookings.length} booking{dayBookings.length === 1 ? '' : 's'}</span></h2>
            {dayBookings.length === 0 ? <p className="muted">No bookings this day.</p> : <div className="stack">{dayBookings.map(row)}</div>}
          </section>
        </>
      ) : list.length === 0 ? (
        <EmptyState icon={<CalendarHeart size={26} />} title={tab === 'upcoming' ? 'Nothing booked yet' : `No ${tab} bookings`}
          action={tab === 'upcoming' ? <Link to="/" className="btn btn-primary">Find a session</Link> : undefined}>
          {tab === 'upcoming' ? 'When you book a session it will show up here.' : null}
        </EmptyState>
      ) : (
        <div className="child-columns">
          {columns.map(({ child, items }) => (
            <section key={child.id} className="child-col" aria-label={`${child.firstName}'s bookings`}>
              <header className="child-col-head">
                <Avatar name={`${child.firstName} ${child.lastName}`} tone="peach" size={40} />
                <div>
                  <h2>{child.firstName}</h2>
                  <span className="muted small">Age {child.age} · {items.length} {tab} booking{items.length === 1 ? '' : 's'}</span>
                </div>
              </header>
              {items.length === 0
                ? <p className="muted small child-col-empty">No {tab} bookings for {child.firstName}.</p>
                : <div className="stack">{items.map(row)}</div>}
            </section>
          ))}
          {orphans.length > 0 && (
            <section className="child-col">
              <header className="child-col-head"><div><h2>Other</h2></div></header>
              <div className="stack">{orphans.map(row)}</div>
            </section>
          )}
        </div>
      )}

      <DelayedShareNote className="page-end" />

      <ConfirmDialog open={!!cancelling} onClose={() => setCancelling(null)} onConfirm={cancel} title="Cancel this booking?" confirmLabel="Cancel booking">
        {cancelling && <p>{cancelling.child.firstName}'s spot in <strong>{cancelling.session.title}</strong> on {formatShortDate(cancelling.session.startsAt)} will be released to other families.</p>}
      </ConfirmDialog>
    </div>
  );
}
