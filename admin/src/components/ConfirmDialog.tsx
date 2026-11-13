import { Modal } from './Modal';
import sharedStyles from '../styles/shared.module.css';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Centered modal replacement for window.confirm(...) — every admin page that
// gates a destructive mutation behind a confirmation uses this instead, so
// the dialog matches the rest of the design system instead of the browser
// chrome default.
export function ConfirmDialog({
  title = 'Please confirm',
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className={styles.message}>{message}</p>
      <div className={styles.actions}>
        <button type="button" className={sharedStyles.button} onClick={onCancel} disabled={isPending}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={danger ? sharedStyles.buttonDanger : sharedStyles.buttonPrimary}
          onClick={onConfirm}
          disabled={isPending}
        >
          {isPending ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
