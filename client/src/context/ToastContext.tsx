import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { LogoMark } from '../components/Logo';

type Tone = 'success' | 'error';
interface Toast { id: number; tone: Tone; message: string }

const ToastContext = createContext<((message: string, tone?: Tone) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  const push = useCallback((message: string, tone: Tone = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, tone, message }]);
    window.setTimeout(() => dismiss(id), 4200);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <span className="toast-icon">{t.tone === 'success' ? <LogoMark size={20} /> : <AlertCircle size={18} />}</span>
            <span className="toast-text">
              <strong>{t.message}</strong>
              <span>{t.tone === 'success' ? 'Bloomily · just now' : 'Something needs your attention'}</span>
            </span>
            <button className="icon-btn" onClick={() => dismiss(t.id)} aria-label="Dismiss"><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
