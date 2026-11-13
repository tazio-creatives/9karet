import { LockIcon } from './AuthIcons';
import styles from './AuthSecurityMessage.module.css';

export function AuthSecurityMessage() {
  return (
    <p className={styles.message}>
      <LockIcon />
      <span>Your number is secure and never shared.</span>
    </p>
  );
}
