import { useRef, useState, type FormEvent } from 'react';
import type { Address, AddressInput, AddressType } from '../../api/types';
import { ApiError } from '../../api/client';
import { PINCODE_PATTERN, usePincodeCheck } from '../../hooks/usePincodeCheck';
import styles from './AddressForm.module.css';

interface AddressFormProps {
  initial?: Address;
  onSubmit: (input: AddressInput) => Promise<unknown>;
  onCancel?: () => void;
  submitLabel?: string;
  // Drops the form's own boxed border/background/padding — used when a
  // caller (CheckoutPage's AddressFormModal) already provides that framing
  // via its own dialog surface, so the form doesn't render as a box-in-a-box.
  bare?: boolean;
}

const TYPES: AddressType[] = ['HOME', 'OFFICE', 'OTHER'];

export function AddressForm({ initial, onSubmit, onCancel, submitLabel = 'Save Address', bare = false }: AddressFormProps) {
  const [type, setType] = useState<AddressType>(initial?.type ?? 'HOME');
  const [name, setName] = useState(initial?.name ?? '');
  const [mobileNumber, setMobileNumber] = useState(initial?.mobileNumber ?? '');
  const [addressLine, setAddressLine] = useState(initial?.addressLine ?? '');
  const [building, setBuilding] = useState(initial?.building ?? '');
  const [landmark, setLandmark] = useState(initial?.landmark ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [state, setState] = useState(initial?.state ?? '');
  // Older saved addresses can carry stray characters (e.g. "673019`") —
  // keep digits only so editing one saves a clean pincode.
  const [pincode, setPincode] = useState((initial?.pincode ?? '').replace(/\D/g, '').slice(0, 6));
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pincodeCheck = usePincodeCheck();
  const pincodeResult = pincodeCheck.state.status === 'done' ? pincodeCheck.state.result : null;

  // Last city/state we prefilled — lets a new pincode replace our own
  // earlier prefill without ever overwriting what the customer typed.
  const autofilled = useRef({ city: '', state: '' });

  // Checks delivery (and prefills City/State) as soon as a full pincode is
  // typed; the Check button re-runs it on demand. Informational only —
  // saving is never blocked.
  async function runPincodeCheck(code: string) {
    const result = await pincodeCheck.check(code);
    if (!result) return;
    if (result.city) {
      const next = result.city;
      const previous = autofilled.current.city;
      setCity((current) => (current.trim() === '' || current === previous ? next : current));
      autofilled.current.city = next;
    }
    if (result.state) {
      const next = result.state;
      const previous = autofilled.current.state;
      setState((current) => (current.trim() === '' || current === previous ? next : current));
      autofilled.current.state = next;
    }
  }

  function handlePincodeChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setPincode(digits);
    if (PINCODE_PATTERN.test(digits)) void runPincodeCheck(digits);
    else pincodeCheck.reset();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        type,
        name,
        mobileNumber,
        addressLine,
        building: building || null,
        landmark: landmark || null,
        city,
        state,
        pincode,
        country: 'India',
        isDefault,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save address.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={`${styles.form} ${bare ? styles.formBare : ''}`} onSubmit={handleSubmit}>
      <div className={styles.typeRow}>
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className={`${styles.typePill} ${type === t ? styles.typePillActive : ''}`}
            onClick={() => setType(t)}
          >
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className={styles.grid}>
        <label className={styles.field}>
          Full Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className={styles.field}>
          Mobile Number
          <input value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} required />
        </label>
      </div>

      <div className={styles.grid}>
        <label className={styles.field}>
          House / Flat / Building (optional)
          <input value={building} onChange={(e) => setBuilding(e.target.value)} />
        </label>
        <label className={styles.field}>
          Street / Area
          <input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} required />
        </label>
      </div>

      <label className={styles.field}>
        Landmark (optional)
        <input value={landmark} onChange={(e) => setLandmark(e.target.value)} />
      </label>

      <div className={styles.grid3}>
        <label className={styles.field}>
          PIN Code
          <span className={styles.pincodeRow}>
            <input
              value={pincode}
              onChange={(e) => handlePincodeChange(e.target.value)}
              inputMode="numeric"
              required
            />
            <button
              type="button"
              className={styles.pincodeCheck}
              onClick={() => void runPincodeCheck(pincode)}
              disabled={pincodeCheck.state.status === 'checking'}
            >
              {pincodeCheck.state.status === 'checking' ? 'Checking…' : 'Check'}
            </button>
          </span>
        </label>
        <label className={styles.field}>
          City
          <input value={city} onChange={(e) => setCity(e.target.value)} required />
        </label>
        <label className={styles.field}>
          State
          <input value={state} onChange={(e) => setState(e.target.value)} required />
        </label>
      </div>

      {pincodeCheck.state.status === 'invalid' && (
        <p className={styles.pincodeBad}>Please enter a valid 6-digit pincode.</p>
      )}
      {pincodeCheck.state.status === 'error' && <p className={styles.pincodeBad}>{pincodeCheck.state.message}</p>}
      {pincodeResult?.serviceable === true && (
        <p className={styles.pincodeOk}>✓ We deliver to {pincodeResult.pincode}.</p>
      )}
      {pincodeResult?.serviceable === false && (
        <p className={styles.pincodeBad}>
          Sorry, we don't deliver to {pincodeResult.pincode} yet. Please use another address or contact us for help.
        </p>
      )}
      {pincodeResult?.serviceable === null && (
        <p className={styles.pincodeNote}>We couldn't check delivery to {pincodeResult.pincode} right now.</p>
      )}

      <label className={styles.defaultCheckboxRow}>
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        Make this my default address
      </label>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className={styles.cancel} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
