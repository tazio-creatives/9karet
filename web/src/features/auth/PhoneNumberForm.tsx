import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthSecurityMessage } from './AuthSecurityMessage';
import { ShieldCheckIcon, ChevronDownIcon, ArrowRightIcon, ErrorIcon, SpinnerIcon, GemOrnamentIcon } from './AuthIcons';
import styles from './PhoneNumberForm.module.css';
import sharedStyles from './AuthShared.module.css';

interface PhoneNumberFormProps {
  mobile: string;
  onMobileChange: (_value: string) => void;
  onSubmit: (_e: FormEvent) => void;
  isSubmitting: boolean;
  apiError: string | null;
}

const MOBILE_PATTERN = /^[6-9]\d{9}$/;

// Purely presentational (owns only local input-touched state for validation
// timing) — sendOtp() itself is called by AuthModal, per the "keep API calls
// out of visual components" requirement.
export function PhoneNumberForm({ mobile, onMobileChange, onSubmit, isSubmitting, apiError }: PhoneNumberFormProps) {
  const [touched, setTouched] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const isValid = MOBILE_PATTERN.test(mobile);
  const showValidationError = (touched || attemptedSubmit) && mobile.length > 0 && !isValid;

  function handleSubmit(e: FormEvent) {
    setAttemptedSubmit(true);
    if (!isValid) {
      e.preventDefault();
      return;
    }
    onSubmit(e);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <span className={styles.ornament} aria-hidden="true">
        <GemOrnamentIcon />
      </span>
      <p className={styles.eyebrow}>Welcome Back</p>
      <h1 className={styles.heading}>Sign in to your account</h1>
      <p className={styles.supportRow}>
        <ShieldCheckIcon />
        <span>Enter your mobile number and we&rsquo;ll send you a secure one-time code.</span>
      </p>

      <label className={styles.label} htmlFor="mobile-number">
        Mobile number
      </label>
      <div className={`${styles.mobileRow} ${showValidationError ? styles.mobileRowError : ''}`}>
        <span className={styles.flag} aria-hidden="true">
          🇮🇳
        </span>
        <span className={styles.prefix}>+91</span>
        <ChevronDownIcon />
        <span className={styles.divider} aria-hidden="true" />
        <input
          id="mobile-number"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          className={styles.input}
          value={mobile}
          onChange={(e) => onMobileChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
          onBlur={() => setTouched(true)}
          placeholder="Enter 10-digit mobile number"
          maxLength={10}
          aria-invalid={showValidationError}
          aria-describedby={showValidationError ? 'mobile-error' : undefined}
          autoFocus
          required
        />
      </div>
      {showValidationError && (
        <p id="mobile-error" className={styles.fieldError} role="alert">
          <ErrorIcon />
          <span>Enter a valid 10-digit mobile number.</span>
        </p>
      )}

      {apiError && (
        <p className={styles.apiError} role="alert" aria-live="assertive">
          {apiError}
        </p>
      )}

      <button type="submit" className={styles.submit} disabled={!isValid || isSubmitting}>
        {isSubmitting ? (
          <>
            <span className={sharedStyles.spinIcon}>
              <SpinnerIcon />
            </span>
            <span>Sending OTP…</span>
          </>
        ) : (
          <>
            <span>Continue with OTP</span>
            <ArrowRightIcon />
          </>
        )}
      </button>

      <AuthSecurityMessage />

      <div className={styles.divider2}>
        <span className={styles.dividerGem} aria-hidden="true">
          <GemOrnamentIcon />
        </span>
        <span>New to BOX DIAMONDS?</span>
      </div>
      <p className={styles.newCustomer}>Your account will be created automatically after verification.</p>

      <p className={styles.terms}>
        By continuing, you agree to our{' '}
        <Link to="/terms" className={styles.termsLink}>
          Terms &amp; Conditions
        </Link>{' '}
        and{' '}
        <Link to="/privacy-policy" className={styles.termsLink}>
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}
