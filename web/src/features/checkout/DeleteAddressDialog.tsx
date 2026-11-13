import { useEffect } from 'react';
import styles from './DeleteAddressDialog.module.css';

interface DeleteAddressDialogProps {
  onCancel: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

export function DeleteAddressDialog({ onCancel, onConfirm, isDeleting }: DeleteAddressDialogProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div className={styles.backdrop} onClick={onCancel}>
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-address-heading"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="delete-address-heading" className={styles.heading}>
          Delete this address?
        </h2>
        <p className={styles.message}>This address will be removed from your saved addresses.</p>
        <div className={styles.actions}>
          <button type="button" className={styles.cancelButton} onClick={onCancel} disabled={isDeleting}>
            Cancel
          </button>
          <button type="button" className={styles.deleteButton} onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting…' : 'Delete Address'}
          </button>
        </div>
      </div>
    </div>
  );
}
