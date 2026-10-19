import type { Session } from '../../../shared/schemas';

/** Status pill in Bloomily's style: "5 open" (mint), "2 open" (amber), "Full" (amber-strong). */
export function SpotsPill({ session }: { session: Pick<Session, 'spotsLeft'> }) {
  const tone = session.spotsLeft === 0 ? 'full' : session.spotsLeft <= 2 ? 'low' : 'ok';
  return <span className={`pill pill-${tone}`}>{session.spotsLeft === 0 ? 'Full' : `${session.spotsLeft} open`}</span>;
}

/** Booked-vs-capacity meter that shifts color as a session fills. */
export function CapacityBar({ session }: { session: Pick<Session, 'bookedCount' | 'capacity' | 'spotsLeft'> }) {
  const pct = Math.min(100, Math.round((session.bookedCount / session.capacity) * 100));
  const tone = session.spotsLeft === 0 ? 'full' : session.spotsLeft <= 2 ? 'low' : 'ok';
  return (
    <div className="capacity">
      <div className="capacity-row">
        <span>{session.bookedCount} of {session.capacity} booked</span>
        <SpotsPill session={session} />
      </div>
      <div className="capacity-track" role="progressbar" aria-valuenow={session.bookedCount} aria-valuemin={0} aria-valuemax={session.capacity}>
        <div className={`capacity-fill capacity-fill-${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
