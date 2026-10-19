import { ArrowRight, CalendarClock, CheckCircle2, ClipboardList, MapPin, Users } from 'lucide-react';
import type { Session } from '../../../shared/schemas';
import { CATEGORIES } from '../lib/categories';
import { formatPrice, formatTimeRange, isLive } from '../lib/format';
import { CapacityBar } from './CapacityBar';
import { LiveCount } from './LiveCount';
import { Avatar } from './ui';

interface Props {
  session: Session;
  liveCount: number | undefined;
  /** Names of the signed-in parent's children already booked into this session. */
  bookedChildren?: string[];
  mode: 'parent' | 'staff';
  onAction: (session: Session) => void;
}

/** One session in the home-page list: when, who, where, ages, capacity, live count and the primary action. */
export function SessionCard({ session, liveCount, bookedChildren = [], mode, onAction }: Props) {
  const { Icon, label } = CATEGORIES[session.category];
  const live = isLive(session);
  const full = session.spotsLeft === 0;

  return (
    <article className={`session-card cat-${session.category} ${live ? 'session-live' : ''}`}>
      <div className="session-card-top">
        <span className="cat-tile"><Icon size={18} /></span>
        <span className="cat-label">{label}</span>
        <LiveCount count={liveCount} live={live} />
      </div>

      <div>
        <h3 className="session-title">{session.title}</h3>
        <p className="session-desc">{session.description}</p>
      </div>

      <ul className="session-meta">
        <li><CalendarClock size={15} /> {formatTimeRange(session.startsAt, session.endsAt)}{live && <span className="now-tag">Now</span>}</li>
        <li><MapPin size={15} /> {session.location}</li>
        <li><Users size={15} /> Ages {session.minAge}–{session.maxAge}</li>
      </ul>

      <div className="session-instructor">
        <Avatar name={session.instructorName} tone={session.category} size={28} />
        <span><span className="instructor-name">{session.instructorName}</span> <span className="muted small">· session lead</span></span>
      </div>

      <CapacityBar session={session} />

      <div className="session-card-footer">
        <span className="price">{formatPrice(session.priceCents)}</span>
        {mode === 'staff' ? (
          <button className="btn btn-dark" onClick={() => onAction(session)}>
            <ClipboardList size={16} /> View roster
          </button>
        ) : (
          <div className="footer-actions">
            {bookedChildren.length > 0 && (
              <span className="booked-tag"><CheckCircle2 size={14} /> {bookedChildren.join(' & ')}</span>
            )}
            <button className={`btn ${bookedChildren.length ? 'btn-dark' : 'btn-primary'}`} disabled={full} onClick={() => onAction(session)}>
              {full ? 'Full' : bookedChildren.length ? 'Book another' : <>Book <ArrowRight size={16} /></>}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
