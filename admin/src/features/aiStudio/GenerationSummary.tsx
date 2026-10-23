import type { CustomerCategory, JewelleryType } from '../../api/aiStudio';
import {
  manifestSummary,
  catalogueViewLabels,
  presenterIdentityLabel,
  formatCustomerCategory,
} from './generationRules';
import styles from './GenerationSummary.module.css';

function formatType(type: string) {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

interface GenerationSummaryProps {
  generateRoseGold: boolean;
  customerCategory: CustomerCategory | '';
  jewelleryType: JewelleryType | '';
  hasPresenter: boolean;
}

// The "Images to generate" box shown before generation starts. Always six
// images. Rose Gold changes only the metal split, the customer category only
// the presenter, the jewellery category only the catalogue views.
export function GenerationSummary({ generateRoseGold, customerCategory, jewelleryType, hasPresenter }: GenerationSummaryProps) {
  const lines = manifestSummary(generateRoseGold, customerCategory);
  return (
    <div className={styles.summary} aria-live="polite">
      <dl className={styles.config}>
        <dt>Customer Category</dt>
        <dd>{customerCategory ? formatCustomerCategory(customerCategory) : '—'}</dd>
        <dt>Jewellery Category</dt>
        <dd>{jewelleryType ? formatType(jewelleryType) : '—'}</dd>
        <dt>Generate Rose Gold</dt>
        <dd>{generateRoseGold ? 'On' : 'Off'}</dd>
      </dl>
      <p className={styles.total}>Images to Generate: 6</p>
      <ul className={styles.list}>
        {lines.map((line) => (
          <li key={line.label} className={line.included ? styles.included : styles.excluded}>
            <span aria-hidden="true">{line.included ? '✓' : '✕'}</span> {line.label}
          </li>
        ))}
      </ul>
      <p className={styles.detail}>
        Catalogue views: {catalogueViewLabels(jewelleryType, generateRoseGold).join(', ')}
        {generateRoseGold && ' — each in yellow and rose gold'}
      </p>
      <p className={styles.detail}>Presenter: {presenterIdentityLabel(jewelleryType, customerCategory, hasPresenter)}</p>
    </div>
  );
}
