import type { Session } from '../../../shared/schemas';

const stamp = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s: string) => s.replace(/[\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');

/** Downloads an .ics calendar file for a booked session. */
export function downloadIcs(session: Session, childName: string): void {
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bloomily//Booking//EN', 'BEGIN:VEVENT',
    `UID:${session.id}-${childName}@bloomily`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(session.startsAt)}`,
    `DTEND:${stamp(session.endsAt)}`,
    `SUMMARY:${esc(`${session.title} (${childName})`)}`,
    `LOCATION:${esc(session.location)}`,
    `DESCRIPTION:${esc(`With ${session.instructorName}. ${session.description}`)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${session.title.replace(/\W+/g, '-')}.ics` });
  a.click();
  URL.revokeObjectURL(url);
}
