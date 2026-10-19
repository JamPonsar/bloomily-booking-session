import { useEffect, useRef, useState } from 'react';

/**
 * Pulsing "N in class now" pill (live sessions only) fed by the presence poller.
 * Briefly highlights when the number changes so live updates are noticeable.
 */
export function LiveCount({ count, live }: { count: number | undefined; live: boolean }) {
  const [bump, setBump] = useState(false);
  const prev = useRef(count);

  useEffect(() => {
    if (prev.current !== undefined && count !== prev.current) {
      setBump(true);
      const t = window.setTimeout(() => setBump(false), 600);
      prev.current = count;
      return () => window.clearTimeout(t);
    }
    prev.current = count;
  }, [count]);

  if (!live) return null;
  const n = count ?? 0;
  return (
    <span className={`live-pill ${live ? 'is-live' : ''} ${bump ? 'bump' : ''}`} title="Updates every few seconds">
      <span className="live-dot" aria-hidden />
      <strong>{n}</strong>&nbsp;in class now
    </span>
  );
}
