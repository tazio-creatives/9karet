import { useState, type FormEvent } from 'react';
import { ShieldCheckIcon, ArrowRightIcon, ErrorIcon, SpinnerIcon, GemOrnamentIcon } from './AuthIcons';
import styles from './PhoneNumberForm.module.css';
import sharedStyles from './AuthShared.module.css';

interface ProfileDetailsFormProps {
  fullName: string;
  email: string;
  onFullNameChange: (_value: string) => void;
  onEmailChange: (_value: string) => void;
  onSubmit: (_e: FormEvent) => void;
  isSubmitting: boolean;
  apiError: string | null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Shown right after OTP verification for a new registration — or any
// existing customer still missing their name or email — so every account
// has both before it's used. Both fields are mandatory. Purely
// presentational; AuthModal owns the save call. Reuses PhoneNumberForm's
// styles so the three steps read as one flow.
export function ProfileDetailsForm({
  fullName,
  email,
  onFullNameChange,
  onEmailChange,
  onSubmit,
  isSubmitting,
  apiError,
}: ProfileDetailsFormProps) {
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const nameValid = fullName.trim().length >= 2;
  const emailValid = EMAIL_PATTERN.test(email.trim());
  const showNameError = attemptedSubmit && !nameValid;
  const showEmailError = attemptedSubmit && !emailValid;

  function handleSubmit(e: FormEvent) {
    setAttemptedSubmit(true);
    if (!nameValid || !emailValid) {
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
      <p className={styles.eyebrow}>Almost done</p>
      <h1 className={styles.heading}>Complete your profile</h1>
      <p className={styles.supportRow}>
        <ShieldCheckIcon />
        <span>Your number is verified. Add your name and email so we can send your order updates.</span>
      </p>

      <label className={styles.label} htmlFor="profile-full-name">
        Full name
      </label>
      <div className={`${styles.mobileRow} ${showNameError ? styles.mobileRowError : ''}`}>
        <input
          id="profile-full-name"
          type="text"
          autoComplete="name"
          className={styles.input}
          value={fullName}
          onChange={(e) => onFullNameChange(e.target.value)}
          placeholder="Enter your full name"
          maxLength={120}
          aria-invalid={showNameError}
          aria-describedby={showNameError ? 'profile-name-error' : undefined}
          autoFocus
          required
        />
      </div>
      {showNameError && (
        <p id="profile-name-error" className={styles.fieldError} role="alert">
          <ErrorIcon />
          <span>Please enter your full name.</span>
        </p>
      )}

      <label className={styles.label} htmlFor="profile-email" style={{ marginTop: 'var(--space-4)' }}>
        Email address
      </label>
      <div className={`${styles.mobileRow} ${showEmailError ? styles.mobileRowError : ''}`}>
        <input
          id="profile-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          className={styles.input}
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="you@example.com"
          maxLength={200}
          aria-invalid={showEmailError}
          aria-describedby={showEmailError ? 'profile-email-error' : undefined}
          required
        />
      </div>
      {showEmailError && (
        <p id="profile-email-error" className={styles.fieldError} role="alert">
          <ErrorIcon />
          <span>Please enter a valid email address.</span>
        </p>
      )}

      {apiError && (
        <p className={styles.apiError} role="alert" aria-live="assertive">
          {apiError}
        </p>
      )}

      <button type="submit" className={styles.submit} disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <span className={sharedStyles.spinIcon}>
              <SpinnerIcon />
            </span>
            <span>Saving…</span>
          </>
        ) : (
          <>
            <span>Save &amp; continue</span>
            <ArrowRightIcon />
          </>
        )}
      </button>
    </form>
  );
}
