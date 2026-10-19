/** Small presentational building blocks shared across pages. */
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { initials } from '../lib/format';

export function Avatar({ name, tone = 'sage', size = 36 }: { name: string; tone?: string; size?: number }) {
  return (
    <span className={`avatar avatar-${tone}`} style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <Loader2 size={size} className="spin" aria-label="Loading" />;
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ height = 180, count = 3 }: { height?: number; count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => <div key={i} className="skeleton" style={{ height }} />)}
    </>
  );
}

interface FieldProps { label: string; error?: string; hint?: ReactNode; children: ReactNode; className?: string }

export function Field({ label, error, hint, children, className = '' }: FieldProps) {
  return (
    <label className={`field ${error ? 'field-error' : ''} ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-msg">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input className="input" {...p} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className="input" rows={3} {...p} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select className="input" {...p} />;
