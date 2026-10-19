import { useState } from 'react';
import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { Spinner } from './ui';

interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

/** "Are you sure?" dialog that shows a spinner while the async action runs. */
export function ConfirmDialog({ open, title, children, confirmLabel, tone = 'danger', onConfirm, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" dismissable={!busy}>
      <div className="modal-body">{children}</div>
      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Keep it</button>
        <button className={`btn btn-${tone}`} onClick={confirm} disabled={busy}>{busy && <Spinner />} {confirmLabel}</button>
      </div>
    </Modal>
  );
}
