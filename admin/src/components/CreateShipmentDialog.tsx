import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from './Modal';
import { fetchShippingProviders, type CreateShipmentInput } from '../api/shipping';
import sharedStyles from '../styles/shared.module.css';
import styles from './ConfirmDialog.module.css';
import localStyles from './CreateShipmentDialog.module.css';

interface CreateShipmentDialogProps {
  isPending?: boolean;
  errorMessage?: string | null;
  onConfirm: (_input: CreateShipmentInput) => void;
  onCancel: () => void;
}

// Package weight/dimensions aren't captured anywhere in the product catalog
// — the courier needs them confirmed per shipment, so this is collected
// here, right before the shipment-creation call it feeds, along with which
// courier (Delhivery / Blue Dart) to book it with. Only
// reachable once the order is already Ready to Ship (a separate, earlier
// status-only action) — this dialog is what actually books the AWB.
export function CreateShipmentDialog({ isPending, errorMessage, onConfirm, onCancel }: CreateShipmentDialogProps) {
  const [weightGrams, setWeightGrams] = useState('');
  const [lengthCm, setLengthCm] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [providerChoice, setProviderChoice] = useState<string | null>(null);

  const { data: providersData, isLoading: isProvidersLoading } = useQuery({
    queryKey: ['admin-shipping-providers'],
    queryFn: fetchShippingProviders,
  });
  const providers = providersData?.providers ?? [];
  // Until the admin picks one, the server's default (SHIPPING_PROVIDER).
  const provider = providerChoice ?? providersData?.defaultProvider ?? '';

  const values = [weightGrams, lengthCm, widthCm, heightCm];
  const isValid = values.every((v) => v.trim() !== '' && Number(v) > 0) && provider !== '';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    onConfirm({
      weightGrams: Number(weightGrams),
      lengthCm: Number(lengthCm),
      widthCm: Number(widthCm),
      heightCm: Number(heightCm),
      provider,
    });
  }

  return (
    <Modal title="Create Shipment" onClose={onCancel}>
      <p className={styles.message}>
        Confirm the packed parcel's weight and dimensions — this creates the shipment (AWB) with the courier and
        cannot be undone.
      </p>
      <form onSubmit={handleSubmit}>
        <label className={sharedStyles.field}>
          Courier
          <select
            value={provider}
            onChange={(e) => setProviderChoice(e.target.value)}
            disabled={isPending || isProvidersLoading}
            required
          >
            {isProvidersLoading && <option value="">Loading…</option>}
            {!isProvidersLoading && providers.length === 0 && <option value="">No courier configured</option>}
            {providers.map((p) => (
              <option key={p.name} value={p.name}>
                {p.displayName}
              </option>
            ))}
          </select>
        </label>
        <div className={`${sharedStyles.formGrid2} ${localStyles.fields}`}>
          <label className={sharedStyles.field}>
            Weight (grams)
            <input
              type="number"
              min="1"
              step="1"
              value={weightGrams}
              onChange={(e) => setWeightGrams(e.target.value)}
              disabled={isPending}
              autoFocus
              required
            />
          </label>
          <label className={sharedStyles.field}>
            Length (cm)
            <input
              type="number"
              min="1"
              step="0.1"
              value={lengthCm}
              onChange={(e) => setLengthCm(e.target.value)}
              disabled={isPending}
              required
            />
          </label>
          <label className={sharedStyles.field}>
            Width (cm)
            <input
              type="number"
              min="1"
              step="0.1"
              value={widthCm}
              onChange={(e) => setWidthCm(e.target.value)}
              disabled={isPending}
              required
            />
          </label>
          <label className={sharedStyles.field}>
            Height (cm)
            <input
              type="number"
              min="1"
              step="0.1"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              disabled={isPending}
              required
            />
          </label>
        </div>

        {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}

        <div className={styles.actions}>
          <button type="button" className={sharedStyles.button} onClick={onCancel} disabled={isPending}>
            Cancel
          </button>
          <button type="submit" className={sharedStyles.buttonPrimary} disabled={!isValid || isPending}>
            {isPending ? 'Creating shipment…' : 'Confirm & Create Shipment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
