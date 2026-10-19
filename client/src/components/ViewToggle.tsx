import { useState } from 'react';
import { CalendarDays, List } from 'lucide-react';

export type ViewMode = 'list' | 'calendar';
const KEY = 'bloomily.viewMode';

/** List/calendar preference, remembered per browser. */
export function useViewMode(): [ViewMode, (m: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(() => {
    try { return localStorage.getItem(KEY) === 'calendar' ? 'calendar' : 'list'; } catch { return 'list'; }
  });
  return [mode, (m) => {
    setMode(m);
    try { localStorage.setItem(KEY, m); } catch { /* storage unavailable */ }
  }];
}

export function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="view-toggle" role="radiogroup" aria-label="View as">
      <button role="radio" aria-checked={mode === 'list'} className={mode === 'list' ? 'active' : ''} onClick={() => onChange('list')}><List size={16} /> List</button>
      <button role="radio" aria-checked={mode === 'calendar'} className={mode === 'calendar' ? 'active' : ''} onClick={() => onChange('calendar')}><CalendarDays size={16} /> Calendar</button>
    </div>
  );
}
