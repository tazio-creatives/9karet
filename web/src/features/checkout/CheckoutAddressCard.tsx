import { useEffect, useRef, useState } from 'react';
import type { Address, AddressInput } from '../../api/types';
import { DeliveryAddressCard } from './DeliveryAddressCard';
import { AddressFormModal } from './AddressFormModal';
import { DeleteAddressDialog } from './DeleteAddressDialog';
import styles from './CheckoutAddressCard.module.css';

const VISIBLE_COUNT = 3;

interface CheckoutAddressCardProps {
  addresses: Address[];
  selectedAddressId: string | null;
  onSelectAddress: (_id: string) => void;
  onCreateAddress: (_input: AddressInput) => Promise<unknown>;
  onUpdateAddress: (_id: string, _input: Partial<AddressInput>) => Promise<unknown>;
  onDeleteAddress: (_id: string) => Promise<unknown>;
  onSetDefault: (_id: string) => void;
  isDeletingAddress: boolean;
  addressError: string | null;
  contactEmail: string;
  onContactEmailChange: (_value: string) => void;
  emailError?: string | null;
  deliveryNote: string;
  onDeliveryNoteChange: (_value: string) => void;
}

type FormModalState = { mode: 'add' } | { mode: 'edit'; address: Address } | null;

function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M12 21s7-6.3 7-11.5A7 7 0 0 0 5 9.5C5 14.7 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

// Delivery Address section — a list of the customer's saved addresses as
// selectable cards (DeliveryAddressCard), a modal for adding/editing
// (AddressFormModal, wrapping the shared AddressForm), and a confirmation
// dialog before deleting one. Contact email has no home on the Address
// entity itself (backend addresses table carries no email column) but
// checkout still requires one (checkoutSchema.contact.email) — kept here as
// a small field of its own since this is the only place in the checkout
// flow it can live, rather than inventing a whole new section for one field.
export function CheckoutAddressCard({
  addresses,
  selectedAddressId,
  onSelectAddress,
  onCreateAddress,
  onUpdateAddress,
  onDeleteAddress,
  onSetDefault,
  isDeletingAddress,
  addressError,
  contactEmail,
  onContactEmailChange,
  emailError,
  deliveryNote,
  onDeliveryNoteChange,
}: CheckoutAddressCardProps) {
  const [formModal, setFormModal] = useState<FormModalState>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const hasAutoOpenedRef = useRef(false);
  useEffect(() => {
    if (hasAutoOpenedRef.current) return;
    if (addresses.length === 0) {
      hasAutoOpenedRef.current = true;
      setFormModal({ mode: 'add' });
    }
  }, [addresses.length]);

  const visibleAddresses = showAll ? addresses : addresses.slice(0, VISIBLE_COUNT);
  const hasMore = addresses.length > VISIBLE_COUNT && !showAll;

  async function handleFormSubmit(input: AddressInput) {
    if (formModal?.mode === 'edit') {
      await onUpdateAddress(formModal.address.id, input);
    } else {
      await onCreateAddress(input);
    }
    setFormModal(null);
  }

  async function handleConfirmDelete() {
    if (!deleteTargetId) return;
    await onDeleteAddress(deleteTargetId);
    setDeleteTargetId(null);
  }

  return (
    <section className={styles.card}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>
          <PinIcon />
          Delivery Address
        </h2>
        <button type="button" className={styles.addButton} onClick={() => setFormModal({ mode: 'add' })}>
          <PlusIcon />
          Add New Address
        </button>
      </div>

      {addresses.length === 0 ? (
        <p className={styles.empty}>No saved addresses yet — add one to continue.</p>
      ) : (
        <div className={styles.list}>
          {visibleAddresses.map((address) => (
            <DeliveryAddressCard
              key={address.id}
              address={address}
              isSelected={address.id === selectedAddressId}
              onSelect={() => onSelectAddress(address.id)}
              onEdit={() => setFormModal({ mode: 'edit', address })}
              onDelete={() => setDeleteTargetId(address.id)}
              onSetDefault={() => onSetDefault(address.id)}
              canDelete={addresses.length > 1}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <button type="button" className={styles.viewAllButton} onClick={() => setShowAll(true)}>
          View all saved addresses ({addresses.length})
        </button>
      )}

      {addressError && (
        <p className={styles.error} role="alert">
          {addressError}
        </p>
      )}

      <label className={styles.field}>
        Contact Email
        <input
          type="email"
          className={emailError ? styles.invalid : undefined}
          value={contactEmail}
          placeholder="Email address"
          onChange={(e) => onContactEmailChange(e.target.value)}
        />
        {emailError && <span className={styles.fieldErrorText}>{emailError}</span>}
      </label>

      <label className={`${styles.field} ${styles.noteField}`}>
        Note for delivery (optional)
        <textarea
          value={deliveryNote}
          placeholder="E.g. Please call before delivery"
          rows={2}
          onChange={(e) => onDeliveryNoteChange(e.target.value)}
        />
      </label>

      {formModal && (
        <AddressFormModal
          mode={formModal.mode}
          initial={formModal.mode === 'edit' ? formModal.address : undefined}
          onSubmit={handleFormSubmit}
          onClose={() => setFormModal(null)}
        />
      )}

      {deleteTargetId && (
        <DeleteAddressDialog
          isDeleting={isDeletingAddress}
          onCancel={() => setDeleteTargetId(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </section>
  );
}
