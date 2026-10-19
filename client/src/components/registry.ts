/**
 * Catalogue of the frontend's building blocks, rendered on the API & Schemas page.
 * Keep it in sync when adding components.
 */
export interface ComponentDoc {
  name: string;
  file: string;
  kind: 'Page' | 'Component' | 'Hook' | 'Context' | 'Library';
  description: string;
  /** API endpoints this piece calls directly or via a hook. */
  apis?: string[];
}

export const COMPONENTS: ComponentDoc[] = [
  // Pages
  { kind: 'Page', name: 'SessionsPage', file: 'client/src/pages/SessionsPage.tsx', description: 'Home page. Lists upcoming sessions grouped by day with a "Happening now" section, category filters, search, live head-counts and the booking entry point. Staff see "View roster" instead of "Book".', apis: ['GET /api/sessions', 'GET /api/presence', 'GET /api/parents/me/bookings', 'GET /api/parents/me'] },
  { kind: 'Page', name: 'MyBookingsPage', file: 'client/src/pages/MyBookingsPage.tsx', description: "Parent's bookings in Upcoming / Past / Cancelled tabs, with add-to-calendar and cancel (with confirmation).", apis: ['GET /api/parents/me/bookings', 'PATCH /api/bookings/:bookingId'] },
  { kind: 'Page', name: 'ProfilePage', file: 'client/src/pages/ProfilePage.tsx', description: 'Edit parent details, see a "Payment plan: coming soon" card, add / edit / remove children, and a plain-language explanation of what is shared with staff.', apis: ['GET /api/parents/me', 'PUT /api/parents/me', 'DELETE /api/parents/me/children/:childId'] },
  { kind: 'Page', name: 'StaffPage', file: 'client/src/pages/StaffPage.tsx', description: 'Staff dashboard for a (generic demo) school: session sidebar and a live-refreshing privacy-scoped roster with a dietary prep summary. Staff can schedule new sessions.', apis: ['GET /api/sessions', 'GET /api/staff/sessions/:sessionId/roster', 'POST /api/sessions', 'POST /api/presence/heartbeat'] },
  { kind: 'Page', name: 'ApiDocsPage', file: 'client/src/pages/ApiDocsPage.tsx', description: 'This page. Renders endpoints, JSON Schemas and live database tables from GET /api/meta, plus this component catalogue. GET endpoints can be tried inline.', apis: ['GET /api/meta'] },

  // Components
  { kind: 'Component', name: 'BookingFlow', file: 'client/src/components/BookingFlow.tsx', description: 'Three-step booking dialog: choose an eligible child → review the data-sharing warning and give consent → animated confirmation with add-to-calendar. Joins the session presence room while open.', apis: ['GET /api/parents/me', 'GET /api/parents/me/bookings', 'POST /api/bookings', 'POST /api/presence/heartbeat'] },
  { kind: 'Component', name: 'SharingNotice', file: 'client/src/components/BookingFlow.tsx', description: 'The privacy warning inside BookingFlow. Shows the exact values staff see immediately (name, age, dietary restrictions) and explains that contact details, emergency contact and medical notes unlock after 24 hours.' },
  { kind: 'Component', name: 'CalendarGrid', file: 'client/src/components/CalendarGrid.tsx', description: 'Month calendar shared by Sessions and My bookings: colored event chips per day (dots on phones), month navigation, Today button and day selection.' },
  { kind: 'Component', name: 'ViewToggle · useViewMode', file: 'client/src/components/ViewToggle.tsx', description: 'List / Calendar switch; the choice is remembered in the browser.' },
  { kind: 'Component', name: 'SessionCard', file: 'client/src/components/SessionCard.tsx', description: 'One session tile: category, title, lead, time, room, age range, capacity bar, live count, price and the primary action.' },
  { kind: 'Component', name: 'LiveCount', file: 'client/src/components/LiveCount.tsx', description: 'Pulsing "N in class now" pill, shown only while a session is live. Animates when the polled number changes.' },
  { kind: 'Component', name: 'CapacityBar · SpotsPill', file: 'client/src/components/CapacityBar.tsx', description: 'Booked-of-capacity meter plus the Bloomily-style status pill ("5 open" in mint, amber when nearly full, "Full").' },
  { kind: 'Component', name: 'Logo · LogoMark', file: 'client/src/components/Logo.tsx', description: 'Bloomily-style petal mark and lowercase wordmark, used in the header, footer, staff sidebar and toasts.' },
  { kind: 'Component', name: 'ChildForm', file: 'client/src/components/ChildForm.tsx', description: 'Add/edit child form with per-field "Shared on booking" / "Shared 24 h after" badges and server-side validation messages.', apis: ['POST /api/parents/me/children', 'PUT /api/parents/me/children/:childId'] },
  { kind: 'Component', name: 'SessionForm', file: 'client/src/components/SessionForm.tsx', description: 'Staff form for scheduling a session; converts local date/time to ISO timestamps.', apis: ['POST /api/sessions'] },
  { kind: 'Component', name: 'TagInput', file: 'client/src/components/TagInput.tsx', description: 'Chip input for dietary restrictions with one-tap suggestions (Enter or comma to add, Backspace to remove).' },
  { kind: 'Component', name: 'PrivacyBadge', file: 'client/src/components/PrivacyBadge.tsx', description: 'Badge marking a field as shared on booking or shared 24 h after, plus DelayedShareNote, the callout that explains the 24-hour rule on the profile, booking and bookings pages.' },
  { kind: 'Component', name: 'Modal', file: 'client/src/components/Modal.tsx', description: 'Accessible dialog: portal, Esc/backdrop to close, body scroll lock, focus management.' },
  { kind: 'Component', name: 'ConfirmDialog', file: 'client/src/components/ConfirmDialog.tsx', description: '"Are you sure?" dialog with an async confirm action and loading state.' },
  { kind: 'Component', name: 'Avatar · Field · Input · Skeleton · EmptyState · Spinner', file: 'client/src/components/ui.tsx', description: 'Shared presentational primitives used across every page.' },
  { kind: 'Component', name: 'AppShell', file: 'client/src/App.tsx', description: 'Header with brand, role-aware navigation tabs and the Parent/Staff view switcher; hosts the routes.' },

  // Hooks & context
  { kind: 'Hook', name: 'useQuery / invalidate', file: 'client/src/hooks/useQuery.ts', description: 'Data fetching with loading/error state, optional polling (paused in background tabs) and key-prefix invalidation after mutations.' },
  { kind: 'Hook', name: 'usePresenceCounts', file: 'client/src/hooks/usePresence.ts', description: 'Polls live head-counts for every session every 5 seconds.', apis: ['GET /api/presence'] },
  { kind: 'Hook', name: 'useSessionRoom', file: 'client/src/hooks/usePresence.ts', description: 'Joins a session room while mounted: heartbeat every 5 s, leave on unmount or tab close (sendBeacon).', apis: ['POST /api/presence/heartbeat', 'POST /api/presence/leave'] },
  { kind: 'Context', name: 'AppProvider / useApp', file: 'client/src/context/AppContext.tsx', description: 'Holds the current view (parent or staff), persists it, and updates the auth headers the API client sends.' },
  { kind: 'Context', name: 'ToastProvider / useToast', file: 'client/src/context/ToastContext.tsx', description: 'Success/error toasts styled like the Bloomily phone notification (logo tile + bold message).' },

  // Libraries
  { kind: 'Library', name: 'api client', file: 'client/src/api/client.ts', description: 'Typed fetch wrapper for every endpoint. Adds auth headers and normalises errors into ApiRequestError (status, code, field messages).' },
  { kind: 'Library', name: 'format', file: 'client/src/lib/format.ts', description: 'Date/time, price, relative-time and age helpers built on Intl.' },
  { kind: 'Library', name: 'ics', file: 'client/src/lib/ics.ts', description: 'Generates and downloads an .ics calendar invite for a booked session.' },
  { kind: 'Library', name: 'shared/schemas', file: 'shared/schemas.ts', description: 'Zod schemas shared by client and server — the single source of truth for every object and its TypeScript type.' },
];
