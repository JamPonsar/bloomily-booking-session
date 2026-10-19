import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { SessionCategory } from '../../../shared/schemas';
import { compactTime, localDateKey } from '../lib/format';

export interface CalendarEvent {
  id: string;
  startsAt: string;
  label: string;
  category: SessionCategory;
}

interface Props {
  events: CalendarEvent[];
  /** Selected day as a local "YYYY-MM-DD" key. */
  selectedKey: string;
  onSelectDay: (key: string) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_CHIPS = 3;

/**
 * Month grid. Each day shows its first few events as colored chips (dots on phones);
 * clicking a day selects it so the page can list that day's details underneath.
 */
export function CalendarGrid({ events, selectedKey, onSelectDay }: Props) {
  const [month, setMonth] = useState(() => {
    const d = new Date(`${selectedKey}T00:00:00`);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const key = localDateKey(e.startsAt);
    byDay.set(key, [...(byDay.get(key) ?? []), e]);
  }

  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay());
  const weeks = Math.ceil((month.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  const todayKey = localDateKey(new Date());
  const shift = (by: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + by, 1));
  const title = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month);

  return (
    <div className="cal">
      <div className="cal-head">
        <h2 className="cal-title">{title}</h2>
        <div className="cal-nav">
          <button className="btn btn-ghost btn-sm" onClick={() => { setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); onSelectDay(todayKey); }}>Today</button>
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="cal-grid" role="grid" aria-label={title}>
        {WEEKDAYS.map((d) => <div key={d} className="cal-dow" role="columnheader">{d}</div>)}
        {cells.map((d) => {
          const key = localDateKey(d);
          const list = byDay.get(key) ?? [];
          const outside = d.getMonth() !== month.getMonth();
          const weekend = d.getDay() === 0 || d.getDay() === 6;
          return (
            <button key={key} role="gridcell" aria-selected={key === selectedKey}
              aria-label={`${d.toDateString()}, ${list.length} ${list.length === 1 ? 'event' : 'events'}`}
              className={`cal-cell ${outside ? 'outside' : ''} ${weekend ? 'weekend' : ''} ${key === todayKey ? 'today' : ''} ${key === selectedKey ? 'selected' : ''}`}
              onClick={() => onSelectDay(key)}>
              <span className="cal-num">{d.getDate()}</span>
              <span className="cal-chips">
                {list.slice(0, MAX_CHIPS).map((e) => (
                  <span key={e.id} className={`cal-chip cat-${e.category}`}><b>{compactTime(e.startsAt)}</b> {e.label}</span>
                ))}
                {list.length > MAX_CHIPS && <span className="cal-more">+{list.length - MAX_CHIPS} more</span>}
              </span>
              {list.length > 0 && (
                <span className="cal-dots" aria-hidden>
                  {list.slice(0, 4).map((e) => <i key={e.id} className={`cat-${e.category}`} />)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
