import { useEffect, useRef } from 'react';
import { useAuthModal } from './AuthModalContext';
import styles from './SignInRequired.module.css';

interface SignInRequiredProps {
  message: string;
}

// Shown in place of a protected route's real content (Account, Checkout)
// while the visitor is signed out. Opens the login modal automatically on
// mount — same moment the old per-page redirect to /login used to fire —
// and stays behind it as a fallback with its own "Sign In" button in case
// the visitor dismisses the modal without completing it. Once ['me']
// resolves to a logged-in customer, the route's own auth check swaps this
// out for the real content — no navigation involved either way.
export function SignInRequired({ message }: SignInRequiredProps) {
  const { openLoginModal } = useAuthModal();
  const hasAutoOpened = useRef(false);

  useEffect(() => {
    if (hasAutoOpened.current) return;
    hasAutoOpened.current = true;
    openLoginModal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.container}>
      <span className={styles.icon} aria-hidden="true">
        <LockIcon />
      </span>
      <p className={styles.message}>{message}</p>
      <button type="button" className={styles.signInButton} onClick={openLoginModal}>
        Sign In
      </button>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" />
    </svg>
  );
}
