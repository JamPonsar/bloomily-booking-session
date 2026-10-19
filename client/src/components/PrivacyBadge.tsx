import { Clock, Share2 } from 'lucide-react';

/**
 * Marks a profile field by when staff can see it: right away on booking, or only
 * once the booking is 24 hours old.
 */
export function PrivacyBadge({ shared }: { shared: boolean }) {
  return shared ? (
    <span className="privacy-badge shared" title="Shared with session staff as soon as you book"><Share2 size={11} /> Shared on booking</span>
  ) : (
    <span className="privacy-badge private" title="Shared with session staff 24 hours after you book"><Clock size={11} /> Shared 24 h after</span>
  );
}

/** Callout explaining the 24-hour rule; used on the profile, booking and bookings pages. */
export function DelayedShareNote({ className = '' }: { className?: string }) {
  return (
    <div className={`delay-note ${className}`}>
      <Clock size={18} />
      <p>
        <strong>Good to know:</strong> 24 hours after you book, session staff can also see your contact details, address,
        emergency contact and your child's medical notes, so they can reach you and care for your child.
        Until then they only see your child's name, age and dietary restrictions.
      </p>
    </div>
  );
}
