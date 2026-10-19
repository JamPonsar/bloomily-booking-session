import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { BookOpenText, CalendarDays, ClipboardList, Code2, ShieldCheck, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { useApp } from './context/AppContext';
import type { ViewRole } from './context/AppContext';
import { ApiDocsPage } from './pages/ApiDocsPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SessionsPage } from './pages/SessionsPage';
import { StaffPage } from './pages/StaffPage';
import { EmptyState } from './components/ui';
import { Logo } from './components/Logo';

const NAV: Record<ViewRole, Array<{ to: string; label: string; icon: ReactNode }>> = {
  parent: [
    { to: '/', label: 'Sessions', icon: <CalendarDays size={16} /> },
    { to: '/bookings', label: 'My bookings', icon: <BookOpenText size={16} /> },
    { to: '/profile', label: 'Profile', icon: <UserRound size={16} /> },
    { to: '/docs', label: 'API & Schemas', icon: <Code2 size={16} /> },
  ],
  staff: [
    { to: '/staff', label: 'Rosters', icon: <ClipboardList size={16} /> },
    { to: '/', label: 'Sessions', icon: <CalendarDays size={16} /> },
    { to: '/docs', label: 'API & Schemas', icon: <Code2 size={16} /> },
  ],
};


/** Wraps role-specific pages so switching view shows a friendly nudge instead of an error. */
function RequireRole({ role, children }: { role: ViewRole; children: ReactNode }) {
  const app = useApp();
  if (app.role === role) return <>{children}</>;
  return (
    <div className="page narrow">
      <EmptyState icon={<ShieldCheck size={26} />} title={`This page is for ${role}s`}
        action={<button className="btn btn-primary" onClick={() => app.setRole(role)}>Switch to {role} view</button>}>
        You're currently in the {app.role} view.
      </EmptyState>
    </div>
  );
}

export function App() {
  const { role, setRole } = useApp();
  const navigate = useNavigate();

  const switchRole = (next: ViewRole) => {
    if (next === role) return;
    setRole(next);
    navigate(next === 'staff' ? '/staff' : '/');
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to={role === 'staff' ? '/staff' : '/'} className="brand" aria-label="Booking a session"><Logo label="Booking a session" /></NavLink>
          <nav className="nav">
            {NAV[role].map((n) => (
              <NavLink key={n.to} to={n.to} end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                {n.icon}<span>{n.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="role-switch" role="radiogroup" aria-label="View as">
            {(['parent', 'staff'] as ViewRole[]).map((r) => (
              <button key={r} role="radio" aria-checked={role === r} className={role === r ? 'active' : ''} onClick={() => switchRole(r)}>
                {r === 'parent' ? <UserRound size={14} /> : <ClipboardList size={14} />} {r === 'parent' ? 'Parent' : 'Staff'}
              </button>
            ))}
            <span className={`role-thumb ${role}`} aria-hidden />
          </div>
        </div>
      </header>

      <main key={role}>
        <Routes>
          <Route path="/" element={<SessionsPage />} />
          <Route path="/bookings" element={<RequireRole role="parent"><MyBookingsPage /></RequireRole>} />
          <Route path="/profile" element={<RequireRole role="parent"><ProfilePage /></RequireRole>} />
          <Route path="/staff" element={<RequireRole role="staff"><StaffPage /></RequireRole>} />
          <Route path="/docs" element={<ApiDocsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="footer">
        <Logo />
        <span>Staff see a child's name, age and dietary needs at first. Family details unlock 24 hours after booking.</span>
      </footer>
    </div>
  );
}
