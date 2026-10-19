import type { Session } from '../../../shared/schemas';

const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
const short = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const dateTime = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export const formatTime = (iso: string) => time.format(new Date(iso));
export const formatTimeRange = (start: string, end: string) => `${formatTime(start)} – ${formatTime(end)}`;
export const formatShortDate = (iso: string) => short.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatPrice = (cents: number) => (cents === 0 ? 'Free' : `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`);

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Today", "Tomorrow" or "Saturday, Oct 24". */
export function dayLabel(iso: string): string {
  const diff = Math.round((startOfDay(new Date(iso)) - startOfDay(new Date())) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return weekday.format(new Date(iso));
}

export const dayKey = (iso: string) => new Date(startOfDay(new Date(iso))).toISOString();

export function isLive(s: Pick<Session, 'startsAt' | 'endsAt'>, now = Date.now()): boolean {
  return new Date(s.startsAt).getTime() <= now && now < new Date(s.endsAt).getTime();
}

export function isPast(s: Pick<Session, 'endsAt'>, now = Date.now()): boolean {
  return new Date(s.endsAt).getTime() <= now;
}

/** "in 3 hours", "in 2 days", "started 20 min ago". */
export function relative(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const abs = Math.abs(ms);
  if (abs < 3_600_000) return rtf.format(Math.round(ms / 60_000), 'minute');
  if (abs < 86_400_000) return rtf.format(Math.round(ms / 3_600_000), 'hour');
  return rtf.format(Math.round(ms / 86_400_000), 'day');
}

export const initials = (name: string) =>
  name.replace(/^(Ms|Mr|Mrs|Dr|Coach|Chef)\.?\s+/i, '').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

export const plural = (n: number, word: string, many = word === 'child' ? 'children' : `${word}s`) => `${n} ${n === 1 ? word : many}`;

/** Whole years old on a given date. Mirrors the server's ageOn(). */
export function ageOn(dateOfBirth: string, on: Date = new Date()): number {
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  let age = on.getFullYear() - dob.getFullYear();
  if (on.getMonth() < dob.getMonth() || (on.getMonth() === dob.getMonth() && on.getDate() < dob.getDate())) age--;
  return age;
}

/** Local calendar-day key ("2026-10-24") for grouping events on a calendar. */
export function localDateKey(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/** Compact time for calendar chips: "4:15p", "9a". */
export function compactTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes();
  return `${h}${m ? `:${String(m).padStart(2, '0')}` : ''}${d.getHours() < 12 ? 'a' : 'p'}`;
}

/** "Saturday, October 24" for a calendar-day key. */
export function longDayLabel(key: string): string {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${key}T00:00:00`));
}
