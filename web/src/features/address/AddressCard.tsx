import type { JSX } from 'react';
import type { Address, AddressType } from '../../api/types';
import styles from './AddressCard.module.css';

interface AddressCardProps {
  address: Address;
  selected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onChange?: () => void;
  onDelete?: () => void;
  onSetDefault?: () => void;
}

const TYPE_LABEL: Record<AddressType, string> = { HOME: 'Home', OFFICE: 'Office', OTHER: 'Other' };

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 11l8-7 8 7" />
      <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}

function OfficeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="3" width="10" height="18" />
      <rect x="14" y="9" width="6" height="12" />
      <path d="M7 7h.01M7 11h.01M7 15h.01M10 7h.01M10 11h.01M10 15h.01" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 21s7-6.3 7-11.5A7 7 0 0 0 5 9.5C5 14.7 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

const TYPE_ICON: Record<AddressType, () => JSX.Element> = { HOME: HomeIcon, OFFICE: OfficeIcon, OTHER: PinIcon };

export function AddressCard({ address, selected, onSelect, onEdit, onChange, onDelete, onSetDefault }: AddressCardProps) {
  const TypeIcon = TYPE_ICON[address.type];
  return (
    <div
      className={`${styles.card} ${selected ? styles.cardSelected : ''} ${onSelect ? styles.selectable : ''}`}
      onClick={onSelect}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <div className={styles.header}>
        <span className={styles.typeGroup}>
          {onSelect && <span className={selected ? styles.radioOn : styles.radioOff} aria-hidden="true" />}
          <span className={styles.typeIcon}>
            <TypeIcon />
          </span>
          <span className={styles.type}>{TYPE_LABEL[address.type]}</span>
          {address.isDefault && <span className={styles.defaultBadge}>Default</span>}
        </span>
        {(onEdit || onChange) && (
          <span className={styles.headerActions}>
            {onChange && (
              <button
                type="button"
                className={styles.changeLink}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange();
                }}
              >
                Change
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                className={styles.editLink}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
              >
                Edit
                <EditIcon />
              </button>
            )}
          </span>
        )}
      </div>
      <p className={styles.name}>{address.name}</p>
      <p className={styles.line}>{address.mobileNumber}</p>
      <p className={styles.line}>
        {address.addressLine}
        {address.building ? `, ${address.building}` : ''}
        {address.landmark ? `, ${address.landmark}` : ''}
      </p>
      <p className={styles.line}>
        {address.city}, {address.state} - {address.pincode}
      </p>

      {(onDelete || onSetDefault) && (
        <div className={styles.actions}>
          {onSetDefault && !address.isDefault && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onSetDefault(); }}>
              Set as Default
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
