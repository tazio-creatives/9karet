import styles from './PlaceholderPage.module.css';

// Reused for routes whose real implementation lands in a later phase
// (Cart/Wishlist: Phase 9, Account/Login: Phase 3's OTP flow needs its own
// UI phase) — keeps the site navigable now without faking those features.
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>{title}</h1>
      <p className={styles.body}>This page is coming soon.</p>
    </div>
  );
}
