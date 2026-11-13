import type { Address, AddressType } from '../../api/types';
import styles from './DeliveryAddressCard.module.css';

interface DeliveryAddressCardProps {
  address: Address;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  // Deleting the only saved address would leave checkout with nothing to
  // ship to — the action is disabled rather than allowed and immediately
  // demanding a new one.
  canDelete: boolean;
}

const TYPE_LABEL: Record<AddressType, string> = { HOME: 'Home', OFFICE: 'Office', OTHER: 'Other' };

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

// One saved address, selectable via a real radio input (native keyboard/
// screen-reader support, and clicking anywhere on the card selects it via
// the wrapping <label>). Selection state is never color-only — the radio
// itself plus the "Delivering Here" text both carry it, per the
// accessibility requirement that color alone never be the only signal.
export function DeliveryAddressCard({
  address,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault,
  canDelete,
}: DeliveryAddressCardProps) {
  const addressSummary = [address.addressLine, address.building, address.landmark].filter(Boolean).join(', ');

  return (
    <label className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}>
      <input
        type="radio"
        name="checkout-delivery-address"
        className={styles.radio}
        checked={isSelected}
        onChange={onSelect}
        aria-label={`Deliver to ${address.name}, ${TYPE_LABEL[address.type]} address, ${address.city} ${address.pincode}`}
      />
      <div className={styles.body}>
        <div className={styles.topRow}>
          <span className={styles.name}>{address.name}</span>
          <span className={styles.typeBadge}>{TYPE_LABEL[address.type]}</span>
          {address.isDefault && <span className={styles.defaultBadge}>Default</span>}
        </div>
        <p className={styles.line}>{address.mobileNumber}</p>
        <p className={styles.line}>{addressSummary}</p>
        <p className={styles.line}>
          {address.city}, {address.state} - {address.pincode}
        </p>

        {isSelected && (
          <p className={styles.deliveringHere}>
            <CheckIcon />
            Delivering Here
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.actionButton}
            aria-label={`Edit ${TYPE_LABEL[address.type]} address for ${address.name}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit();
            }}
          >
            Edit
          </button>
          {!address.isDefault && (
            <button
              type="button"
              className={styles.actionButton}
              aria-label={`Set ${TYPE_LABEL[address.type]} address for ${address.name} as default`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSetDefault();
              }}
            >
              Set as Default
            </button>
          )}
          <button
            type="button"
            className={`${styles.actionButton} ${styles.deleteAction}`}
            aria-label={`Delete ${TYPE_LABEL[address.type]} address for ${address.name}`}
            disabled={!canDelete}
            title={canDelete ? undefined : 'Add another address before deleting this one'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (canDelete) onDelete();
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </label>
  );
}
