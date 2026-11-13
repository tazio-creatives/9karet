import { useEffect } from 'react';
import type { Address, AddressInput } from '../../api/types';
import { AddressForm } from '../address/AddressForm';
import styles from './AddressFormModal.module.css';

interface AddressFormModalProps {
  mode: 'add' | 'edit';
  initial?: Address;
  onSubmit: (input: AddressInput) => Promise<unknown>;
  onClose: () => void;
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}

// Desktop: centered modal. Mobile (<=700px, see AddressFormModal.module.css):
// full-width bottom sheet anchored to the viewport bottom — same responsive
// pattern as AuthModal, so Add/Edit Address matches the sign-in dialog's
// established behavior rather than introducing a new one.
export function AddressFormModal({ mode, initial, onSubmit, onClose }: AddressFormModalProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'edit' ? 'Edit Address' : 'Add New Address'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>{mode === 'edit' ? 'Edit Address' : 'Add New Address'}</h2>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <AddressForm
          bare
          initial={initial}
          onSubmit={onSubmit}
          onCancel={onClose}
          submitLabel={mode === 'edit' ? 'Update Address' : 'Save Address'}
        />
      </div>
    </div>
  );
}
