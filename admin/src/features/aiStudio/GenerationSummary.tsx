import { manifestSummary } from './generationRules';
import styles from './GenerationSummary.module.css';

// The "Images to generate" box shown before generation starts. Always six
// images; the Rose Gold switch only changes how they split.
export function GenerationSummary({ generateRoseGold }: { generateRoseGold: boolean }) {
  const lines = manifestSummary(generateRoseGold);
  return (
    <div className={styles.summary} aria-live="polite">
      <p className={styles.total}>Images to generate: 6</p>
      <ul className={styles.list}>
        {lines.map((line) => (
          <li key={line.label} className={line.included ? styles.included : styles.excluded}>
            <span aria-hidden="true">{line.included ? '✓' : '✕'}</span> {line.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
