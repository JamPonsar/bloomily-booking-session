import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { setAuth } from '../api/client';

export type ViewRole = 'parent' | 'staff';

/** The seeded demo parent. A real app would get this from its auth session. */
export const DEMO_PARENT_ID = 'par_demo';
const ROLE_KEY = 'bloomily.role';

interface AppState {
  role: ViewRole;
  setRole: (role: ViewRole) => void;
  parentId: string;
}

const AppContext = createContext<AppState | null>(null);

function readRole(): ViewRole {
  try {
    return localStorage.getItem(ROLE_KEY) === 'staff' ? 'staff' : 'parent';
  } catch {
    return 'parent';
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<ViewRole>(() => {
    const r = readRole();
    setAuth(r, DEMO_PARENT_ID);
    return r;
  });

  const value = useMemo<AppState>(() => ({
    role,
    parentId: DEMO_PARENT_ID,
    setRole: (next) => {
      setAuth(next, DEMO_PARENT_ID);
      try { localStorage.setItem(ROLE_KEY, next); } catch { /* storage unavailable */ }
      setRoleState(next);
    },
  }), [role]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
