import { useEffect } from 'react';
import styles from './Toast.module.css';

interface ToastProps {
  message: string;
  variant?: 'error' | 'success';
  onDismiss: () => void;
}

export function Toast({ message, variant = 'error', onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className={styles.container}>
      <div className={variant === 'error' ? styles.toastError : styles.toastSuccess} role="alert">
        <span className={styles.message}>{message}</span>
        <button type="button" className={styles.close} onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      </div>
    </div>
  );
}
