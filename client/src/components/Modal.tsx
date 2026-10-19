import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Hide the × button (e.g. while a request is in flight). */
  dismissable?: boolean;
}

/** Accessible dialog: portal, Esc / backdrop to close, scroll lock, initial focus. */
export function Modal({ open, onClose, title, children, size = 'md', dismissable = true }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismissable && closeRef.current();
    window.addEventListener('keydown', onKey);
    requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>('[autofocus], input, select, textarea, button:not(.modal-close)')?.focus();
    });
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      prevFocus?.focus?.();
    };
  }, [open, dismissable]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && dismissable && onClose()}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" ref={panelRef}>
        {(title || dismissable) && (
          <div className="modal-header">
            {title && <h2 className="modal-title">{title}</h2>}
            {dismissable && (
              <button className="icon-btn modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
