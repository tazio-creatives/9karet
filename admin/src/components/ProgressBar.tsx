import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  completed: number;
  total: number;
  label?: string;
  tone?: 'accent' | 'success' | 'danger';
}

// Extracted from aiStudio/ReviewImportStep.tsx's inline progress bar (that
// one drove a client-side sequential loop; this one is meant to be driven
// by backend-job polling — see RepriceProgressBanner.tsx) into a reusable
// component, since Pricing Rule Management needed a second copy of it.
export function ProgressBar({ completed, total, label, tone = 'accent' }: ProgressBarProps) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className={styles.wrap}>
      <div className={styles.track}>
        <div className={`${styles.fill} ${styles[tone]}`} style={{ width: `${percent}%` }} />
      </div>
      <p className={styles.label}>{label ?? `${completed.toLocaleString('en-IN')} / ${total.toLocaleString('en-IN')} (${percent}%)`}</p>
    </div>
  );
}
