import styles from './PlpSkeleton.module.css';

// Shown by PLPPage/CollectionPage while they resolve the category or
// collection (before ProductListing itself can mount) — shaped like
// ProductListing's own layout so the transition into its real skeleton
// grid (and then real products) doesn't jump around.
export function PlpSkeleton() {
  return (
    <div className={styles.page} aria-busy="true">
      <div className={styles.crumb} />
      <div className={styles.heading} />
      <div className={styles.layout}>
        <div className={styles.sidebar} />
        <div className={styles.results}>
          <div className={styles.toolbar} />
          <div className={styles.grid}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={styles.card} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
