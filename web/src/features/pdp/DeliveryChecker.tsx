import { useState, type FormEvent } from 'react';
import { usePincodeCheck } from '../../hooks/usePincodeCheck';
import styles from './DeliveryChecker.module.css';

// Says only whether we deliver to the pincode — no delivery timeframe, since
// most pieces are made to order and the timeline varies per order.
export function DeliveryChecker() {
  const [pincode, setPincode] = useState('');
  const { state, check, reset } = usePincodeCheck();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void check(pincode);
  }

  const result = state.status === 'done' ? state.result : null;

  return (
    <div className={styles.card}>
      <form className={styles.row} onSubmit={handleSubmit}>
        <div className={styles.inputWrap}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className={styles.inputIcon}
            aria-hidden="true"
          >
            <path d="M12 21s7-6.3 7-11.5A7 7 0 0 0 5 9.5C5 14.7 12 21 12 21z" />
            <circle cx="12" cy="9.5" r="2.5" />
          </svg>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="Enter pincode for delivery estimate"
            className={styles.input}
            value={pincode}
            onChange={(e) => {
              setPincode(e.target.value.replace(/\D/g, ''));
              reset();
            }}
            aria-label="Pincode"
            aria-invalid={state.status === 'invalid'}
          />
        </div>
        <button type="submit" className={styles.checkButton} disabled={state.status === 'checking'}>
          {state.status === 'checking' ? 'Checking…' : 'Check'}
        </button>
      </form>
      {state.status === 'invalid' && <p className={styles.error}>Please enter a valid 6-digit pincode.</p>}
      {state.status === 'error' && <p className={styles.error}>{state.message}</p>}
      {result?.serviceable === true && <p className={styles.success}>Delivery available to {result.pincode}.</p>}
      {result?.serviceable === false && (
        <p className={styles.error}>
          Sorry, we don't deliver to {result.pincode} yet. Please try another pincode or contact us for help.
        </p>
      )}
      {result?.serviceable === null && (
        <p className={styles.success}>
          We couldn't check delivery to {result.pincode} right now. Please try again in a moment.
        </p>
      )}
    </div>
  );
}
