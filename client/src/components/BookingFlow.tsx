import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CalendarClock, CalendarPlus, Check, Lock, MapPin, ShieldAlert, UserPlus } from 'lucide-react';
import type { Child, Session } from '../../../shared/schemas';
import { ApiRequestError, api } from '../api/client';
import { invalidate, useQuery } from '../hooks/useQuery';
import { useSessionRoom } from '../hooks/usePresence';
import { CATEGORIES } from '../lib/categories';
import { ageOn, formatShortDate, formatTimeRange } from '../lib/format';
import { downloadIcs } from '../lib/ics';
import { LiveCount } from './LiveCount';
import { DelayedShareNote } from './PrivacyBadge';
import { Modal } from './Modal';
import { Avatar, Spinner } from './ui';

type Step = 'child' | 'review' | 'success';

interface Props {
  session: Session | null;
  onClose: () => void;
}

/**
 * Three-step booking dialog:
 *   1. choose a child (ineligible children are shown but disabled, with the reason)
 *   2. review + data-sharing warning that must be acknowledged
 *   3. animated confirmation with add-to-calendar
 * While open, the user joins the session's presence room.
 */
export function BookingFlow({ session, onClose }: Props) {
  const open = session !== null;
  const [step, setStep] = useState<Step>('child');
  const [childId, setChildId] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const liveCount = useSessionRoom(session?.id ?? null);
  const profile = useQuery('profile', api.getProfile, { enabled: open });
  const bookings = useQuery('bookings', api.listMyBookings, { enabled: open });

  useEffect(() => {
    if (open) {
      setStep('child');
      setChildId(null);
      setConsent(false);
      setError(null);
    }
  }, [open, session?.id]);

  const children = profile.data?.children ?? [];
  const eligibility = useMemo(() => {
    const map = new Map<string, string | null>();
    if (!session) return map;
    for (const c of children) {
      const age = ageOn(c.dateOfBirth, new Date(session.startsAt));
      const booked = bookings.data?.some((b) => b.childId === c.id && b.sessionId === session.id && b.status === 'confirmed');
      map.set(c.id, booked ? 'Already booked' : age < session.minAge || age > session.maxAge ? `Will be ${age} — ages ${session.minAge}–${session.maxAge} only` : null);
    }
    return map;
  }, [children, bookings.data, session]);

  // Pre-select the only eligible child.
  useEffect(() => {
    if (childId) return;
    const eligible = children.filter((c) => !eligibility.get(c.id));
    if (eligible.length === 1) setChildId(eligible[0].id);
  }, [children, eligibility, childId]);

  if (!session) return null;
  const child = children.find((c) => c.id === childId) ?? null;
  const { Icon, label } = CATEGORIES[session.category];

  const confirm = async () => {
    if (!child) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createBooking({ sessionId: session.id, childId: child.id, consentToShare: true });
      setStep('success');
      invalidate('sessions', 'bookings', 'roster');
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Booking failed — please try again');
      if (e instanceof ApiRequestError && e.status === 409) invalidate('sessions', 'bookings');
    } finally {
      setSubmitting(false);
    }
  };

  const loading = profile.loading || bookings.loading;

  return (
    <Modal open={open} onClose={onClose} size="md" dismissable={!submitting}
      title={step === 'success' ? undefined : step === 'child' ? 'Who is joining?' : 'Review & confirm'}>
      {step !== 'success' && (
        <>
          <div className="booking-summary">
            <div className={`booking-summary-icon cat-${session.category}`}><Icon size={22} /></div>
            <div className="booking-summary-text">
              <div className="booking-summary-title">{session.title}</div>
              <div className="muted small">
                {label} · with {session.instructorName}
              </div>
              <div className="booking-summary-meta">
                <span><CalendarClock size={13} /> {formatShortDate(session.startsAt)}, {formatTimeRange(session.startsAt, session.endsAt)}</span>
                <span><MapPin size={13} /> {session.location}</span>
              </div>
            </div>
            <LiveCount count={liveCount ?? undefined} live={new Date(session.startsAt) <= new Date()} />
          </div>
          <Stepper step={step} />
        </>
      )}

      {step === 'child' && (
        <div className="modal-body">
          {loading ? (
            <div className="center-pad"><Spinner size={22} /></div>
          ) : children.length === 0 ? (
            <div className="empty compact">
              <div className="empty-icon"><UserPlus size={22} /></div>
              <h3>Add your child first</h3>
              <p className="muted">We need a few details about your child before you can book.</p>
              <Link to="/profile" className="btn btn-primary" onClick={onClose}>Go to profile</Link>
            </div>
          ) : (
            <div className="child-picker" role="radiogroup">
              {children.map((c) => {
                const reason = eligibility.get(c.id);
                const selected = c.id === childId;
                return (
                  <button key={c.id} type="button" role="radio" aria-checked={selected} disabled={!!reason}
                    className={`child-option ${selected ? 'selected' : ''}`} onClick={() => setChildId(c.id)}>
                    <Avatar name={`${c.firstName} ${c.lastName}`} tone="peach" size={42} />
                    <span className="child-option-text">
                      <strong>{c.firstName} {c.lastName}</strong>
                      <span className="muted small">{reason ?? `Age ${ageOn(c.dateOfBirth, new Date(session.startsAt))} on session day`}</span>
                    </span>
                    <span className="radio-dot">{selected && <Check size={14} />}</span>
                  </button>
                );
              })}
              <Link to="/profile" className="add-child-link" onClick={onClose}><UserPlus size={15} /> Add another child</Link>
            </div>
          )}
        </div>
      )}

      {step === 'review' && child && (
        <div className="modal-body">
          <SharingNotice child={child} session={session} />
          <label className={`consent ${consent ? 'checked' : ''}`}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I understand that <strong>{child.firstName}</strong>'s name, age and dietary restrictions are shared with staff now, and that my contact details, emergency contact and medical notes are shared 24 hours after booking.</span>
          </label>
          {error && <div className="alert alert-error"><AlertTriangle size={16} /> {error}</div>}
        </div>
      )}

      {step === 'success' && child && <Success session={session} child={child} onClose={onClose} />}

      {step === 'child' && children.length > 0 && (
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!child} onClick={() => setStep('review')}>Continue</button>
        </div>
      )}
      {step === 'review' && (
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setStep('child')} disabled={submitting}><ArrowLeft size={16} /> Back</button>
          <button className="btn btn-primary" disabled={!consent || submitting} onClick={confirm}>
            {submitting ? <><Spinner /> Booking…</> : 'Confirm booking'}
          </button>
        </div>
      )}
    </Modal>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: Array<[Step, string]> = [['child', 'Choose child'], ['review', 'Review & share']];
  const idx = steps.findIndex(([s]) => s === step);
  return (
    <ol className="stepper">
      {steps.map(([s, label], i) => (
        <li key={s} className={i < idx ? 'done' : i === idx ? 'active' : ''}>
          <span className="stepper-dot">{i < idx ? <Check size={12} /> : i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

/** The data-sharing warning: shows the exact values staff will receive vs. what stays private. */
export function SharingNotice({ child, session }: { child: Child; session: Session }) {
  return (
    <div className="sharing">
      <div className="sharing-head">
        <ShieldAlert size={20} />
        <div>
          <strong>This information will be shared with staff</strong>
          <p>So {session.instructorName.split(' ').slice(0, 2).join(' ')} and the team can prepare, they'll see the details below straight away.</p>
        </div>
      </div>
      <dl className="sharing-grid">
        <div><dt>Name</dt><dd>{child.firstName} {child.lastName}</dd></div>
        <div><dt>Age</dt><dd>{ageOn(child.dateOfBirth, new Date(session.startsAt))}</dd></div>
        <div className="span-2">
          <dt>Dietary restrictions</dt>
          <dd>
            {child.dietaryRestrictions.length
              ? <span className="tag-row">{child.dietaryRestrictions.map((d) => <span key={d} className="tag">{d}</span>)}</span>
              : <span className="muted">None listed</span>}
          </dd>
        </div>
      </dl>
      <div className="sharing-private">
        <Lock size={13} /> <span>Held back for now: your contact details, address, emergency contact and {child.firstName}'s medical notes.</span>
      </div>
      <DelayedShareNote className="in-sharing" />
    </div>
  );
}

function Success({ session, child, onClose }: { session: Session; child: Child; onClose: () => void }) {
  return (
    <div className="success">
      <div className="confetti" aria-hidden>
        {Array.from({ length: 18 }, (_, i) => <span key={i} style={{ ['--i' as string]: i }} />)}
      </div>
      <svg className="success-check" viewBox="0 0 52 52" aria-hidden>
        <circle cx="26" cy="26" r="24" />
        <path d="M15 27 l7 7 l15 -16" />
      </svg>
      <h2 className="success-title">You're all set!</h2>
      <p className="success-sub"><strong>{child.firstName}</strong> is booked into <strong>{session.title}</strong>.</p>

      <div className="success-details">
        <div><CalendarClock size={15} /> {formatShortDate(session.startsAt)} · {formatTimeRange(session.startsAt, session.endsAt)}</div>
        <div><MapPin size={15} /> {session.location}</div>
        <div><Lock size={15} /> Staff can see {child.firstName}'s name, age & dietary needs. Your contact details unlock for them in 24 hours.</div>
      </div>

      <div className="success-actions">
        <button className="btn btn-secondary" onClick={() => downloadIcs(session, child.firstName)}><CalendarPlus size={16} /> Add to calendar</button>
        <Link to="/bookings" className="btn btn-ghost" onClick={onClose}>View my bookings</Link>
        <button className="btn btn-primary" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
