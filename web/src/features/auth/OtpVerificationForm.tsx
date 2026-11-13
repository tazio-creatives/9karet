import { useEffect, useRef, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowRightIcon, SpinnerIcon } from './AuthIcons';
import styles from './OtpVerificationForm.module.css';
import sharedStyles from './AuthShared.module.css';

interface OtpVerificationFormProps {
  mobile: string;
  otp: string;
  otpLength: number;
  onOtpChange: (_value: string) => void;
  onSubmit: (_e: FormEvent) => void;
  onChangeNumber: () => void;
  onResend: () => void;
  isSubmitting: boolean;
  isResending: boolean;
  apiError: string | null;
  resendSecondsLeft: number;
}

function formatMobile(mobile: string) {
  return `+91 ${mobile.slice(0, 5)} ${mobile.slice(5)}`;
}

function formatCountdown(seconds: number) {
  return `00:${String(Math.max(0, seconds)).padStart(2, '0')}`;
}

// Purely presentational — verifyOtp()/resend are called by AuthModal, this
// component only owns the OTP-box focus/paste/backspace UI mechanics.
export function OtpVerificationForm({
  mobile,
  otp,
  otpLength,
  onOtpChange,
  onSubmit,
  onChangeNumber,
  onResend,
  isSubmitting,
  isResending,
  apiError,
  resendSecondsLeft,
}: OtpVerificationFormProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const boxRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus the step heading once, right after the OTP is sent and this step
  // mounts — screen-reader users get an immediate cue the step changed.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (apiError) errorRef.current?.focus();
  }, [apiError]);

  // Internal representation is always exactly otpLength chars once any digit
  // is set, using ' ' for empty slots — a plain collapsed string can't
  // represent "digit typed into box 3 while 0-2 are still empty" (clicking
  // straight into a box, not just sequential auto-advance typing), which an
  // earlier version of this got wrong by stripping spaces on every change.
  function setDigit(index: number, digit: string) {
    const padded = otp.padEnd(otpLength, ' ').split('');
    padded[index] = digit || ' ';
    onOtpChange(padded.join(''));
  }

  function digitAt(index: number) {
    const char = otp[index];
    return char && char !== ' ' ? char : '';
  }

  function handleChange(index: number, rawValue: string) {
    const digit = rawValue.replace(/\D/g, '').slice(-1);
    setDigit(index, digit);
    if (digit && index < otpLength - 1) {
      boxRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digitAt(index)) return; // let onChange handle clearing this box
      if (index > 0) {
        e.preventDefault();
        setDigit(index - 1, '');
        boxRefs.current[index - 1]?.focus();
      }
      return;
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      boxRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < otpLength - 1) {
      e.preventDefault();
      boxRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, otpLength);
    if (!pasted) return;
    e.preventDefault();
    onOtpChange(pasted.padEnd(otpLength, ' '));
    const focusIndex = Math.min(pasted.length, otpLength - 1);
    requestAnimationFrame(() => boxRefs.current[focusIndex]?.focus());
  }

  const isComplete = otp.length === otpLength && !otp.includes(' ');

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <p className={styles.eyebrow}>Verify Your Number</p>
      <h1 className={styles.heading} ref={headingRef} tabIndex={-1}>
        Enter verification code
      </h1>
      <p className={styles.description}>
        We&rsquo;ve sent a {otpLength}-digit code to <strong>{formatMobile(mobile)}</strong>.{' '}
        <button type="button" className={styles.changeNumber} onClick={onChangeNumber}>
          Change number
        </button>
      </p>

      <div className={styles.boxRow} role="group" aria-label="Verification code">
        {Array.from({ length: otpLength }, (_, index) => (
          <input
            key={index}
            ref={(el) => {
              boxRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            className={`${styles.box} ${digitAt(index) ? styles.boxFilled : ''} ${apiError ? styles.boxError : ''}`}
            value={digitAt(index)}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            autoFocus={index === 0}
            aria-label={`Digit ${index + 1} of ${otpLength}`}
            aria-invalid={!!apiError}
          />
        ))}
      </div>

      {apiError && (
        <p ref={errorRef} className={styles.apiError} role="alert" aria-live="assertive" tabIndex={-1}>
          {apiError}
        </p>
      )}

      <button type="submit" className={styles.submit} disabled={!isComplete || isSubmitting}>
        {isSubmitting ? (
          <>
            <span className={sharedStyles.spinIcon}>
              <SpinnerIcon />
            </span>
            <span>Verifying…</span>
          </>
        ) : (
          <>
            <span>Verify &amp; Continue</span>
            <ArrowRightIcon />
          </>
        )}
      </button>

      <p className={styles.resendRow} aria-live="polite">
        Didn&rsquo;t receive the code?{' '}
        {resendSecondsLeft > 0 ? (
          <span className={styles.resendCountdown}>Resend OTP in {formatCountdown(resendSecondsLeft)}</span>
        ) : (
          <button type="button" className={styles.resendButton} onClick={onResend} disabled={isResending}>
            {isResending ? 'Resending…' : 'Resend OTP'}
          </button>
        )}
      </p>
    </form>
  );
}
