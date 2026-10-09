import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './SizeGuide.module.css';

export type SizeGuideType = 'ring' | 'bangle';

// Indian ring sizes: [size, around the finger (mm), inside width (mm)].
const RING_ROWS: [number, string, string][] = [
  [6, '45.9', '14.6'], [7, '47.1', '15.0'], [8, '48.1', '15.3'], [9, '49.0', '15.6'], [10, '50.0', '15.9'],
  [11, '50.9', '16.2'], [12, '51.8', '16.5'], [13, '52.8', '16.8'], [14, '54.0', '17.2'], [15, '55.0', '17.5'],
  [16, '55.9', '17.8'], [17, '56.9', '18.1'], [18, '57.8', '18.4'], [19, '59.1', '18.8'], [20, '60.0', '19.1'],
  [21, '60.9', '19.4'], [22, '61.9', '19.7'], [23, '62.8', '20.0'], [24, '63.8', '20.3'], [25, '64.7', '20.6'],
  [26, '66.0', '21.0'], [27, '66.9', '21.3'], [28, '67.9', '21.6'], [29, '69.1', '22.0'], [30, '70.1', '22.3'],
];

// Indian anna bangle sizes: [anna size, inside diameter (mm)].
const BANGLE_ROWS: [string, string][] = [
  ['2-0', '50.8'], ['2-1', '52.4'], ['2-2', '54.0'], ['2-3', '55.6'], ['2-4', '57.2'], ['2-5', '58.7'],
  ['2-6', '60.3'], ['2-7', '61.9'], ['2-8', '63.5'], ['2-9', '65.1'], ['2-10', '66.7'], ['2-11', '68.3'],
];

// Product size labels are typed in admin as "2.4" or "2-4" (bangles) and
// "14" (rings) — normalise so the chart can highlight this product's sizes.
function normaliseLabel(label: string) {
  return label.trim().replace('.', '-');
}

function half<T>(rows: T[]): [T[], T[]] {
  const mid = Math.ceil(rows.length / 2);
  return [rows.slice(0, mid), rows.slice(mid)];
}

function RingGuide({ highlight }: { highlight: Set<string> }) {
  const [left, right] = half(RING_ROWS);
  const table = (rows: typeof RING_ROWS) => (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Indian size</th>
          <th>Around finger</th>
          <th>Inside width</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([size, around, width]) => (
          <tr key={size} className={highlight.has(String(size)) ? styles.hl : undefined}>
            <td>{size}</td>
            <td>{around}</td>
            <td>{width}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <>
      <p className={styles.sub}>Indian sizes · All measurements in millimetres (mm)</p>

      <section className={styles.card}>
        <h3>1. Measure your finger</h3>
        <div className={styles.step}>
          <svg className={styles.art} viewBox="0 0 120 130" aria-hidden="true">
            <rect x="22" y="6" width="76" height="118" rx="38" fill="#ecd3c1" stroke="#17383c" strokeWidth="2" />
            <rect x="12" y="52" width="96" height="22" fill="#f1e4c8" stroke="#a07a3b" strokeWidth="2" />
            <line x1="80" y1="48" x2="80" y2="78" stroke="#17383c" strokeWidth="2.5" />
          </svg>
          <ol className={styles.instructions}>
            <li>Wrap a thin paper strip snugly around your finger.</li>
            <li>Mark the overlap, then lay the strip flat.</li>
            <li>Measure from the start to the mark with a ruler.</li>
          </ol>
        </div>
        <div className={styles.strip}>
          <svg viewBox="0 0 400 70" aria-hidden="true">
            <rect x="2" y="4" width="380" height="20" fill="#f1e4c8" stroke="#a07a3b" strokeWidth="1.5" />
            <line x1="350" y1="0" x2="350" y2="28" stroke="#17383c" strokeWidth="2.5" />
            <line x1="2" y1="44" x2="350" y2="44" stroke="#17383c" strokeWidth="1.5" />
            <line x1="2" y1="37" x2="2" y2="51" stroke="#17383c" strokeWidth="1.5" />
            <line x1="350" y1="37" x2="350" y2="51" stroke="#17383c" strokeWidth="1.5" />
            <text x="176" y="66" textAnchor="middle" fontSize="12" fill="#4e5a5a">
              Length = circumference
            </text>
          </svg>
          <p className={styles.example}>
            Example: 54.0 mm
            <strong>Indian size 14</strong>
          </p>
        </div>
      </section>

      <section className={styles.card}>
        <h3>2. Or measure a ring that fits</h3>
        <div className={styles.step}>
          <svg className={styles.art} viewBox="0 0 120 100" aria-hidden="true">
            <ellipse cx="60" cy="50" rx="52" ry="42" fill="none" stroke="#b08a4a" strokeWidth="9" />
            <line x1="14" y1="50" x2="106" y2="50" stroke="#17383c" strokeWidth="2" />
            <line x1="14" y1="44" x2="14" y2="56" stroke="#17383c" strokeWidth="2" />
            <line x1="106" y1="44" x2="106" y2="56" stroke="#17383c" strokeWidth="2" />
          </svg>
          <ul className={styles.instructions}>
            <li>Measure across the centre, from inner edge to inner edge.</li>
            <li>This is the inside diameter — exclude the metal band.</li>
            <li>Example: 17.2 mm inside diameter = Indian size 14.</li>
          </ul>
        </div>
      </section>

      <div className={styles.tables}>
        {table(left)}
        {table(right)}
      </div>

      <ul className={styles.notes}>
        <li>Measure the intended finger; the ring must also pass over the knuckle.</li>
        <li>Repeat the measurement. Between sizes? Choose the larger size or contact us before ordering.</li>
        <li className={styles.fine}>Illustrations are not to scale. Do not measure against this screen image.</li>
      </ul>
    </>
  );
}

function BangleGuide({ highlight }: { highlight: Set<string> }) {
  const [left, right] = half(BANGLE_ROWS);
  const table = (rows: typeof BANGLE_ROWS) => (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Anna size</th>
          <th>Inside diameter</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([size, mm]) => (
          <tr key={size} className={highlight.has(size) ? styles.hl : undefined}>
            <td>{size}</td>
            <td>{mm} mm</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  const circle = (label: string, mm: string, r: number) => (
    <figure className={styles.circle}>
      <figcaption>{label}</figcaption>
      <svg viewBox="0 0 180 180" aria-hidden="true">
        <circle cx="90" cy="90" r={r} fill="none" stroke="#b08a4a" strokeWidth="12" />
        <line x1={90 - r + 7} y1="90" x2={90 + r - 7} y2="90" stroke="#17383c" strokeWidth="2" />
        <path d={`M${90 - r + 7} 90l8 -5v10zM${90 + r - 7} 90l-8 -5v10z`} fill="#17383c" />
        <text x="90" y="78" textAnchor="middle" fontSize="15" fill="#17383c">
          {mm} mm
        </text>
        <text x="90" y="108" textAnchor="middle" fontSize="11" fill="#4e5a5a">
          Inside diameter
        </text>
      </svg>
    </figure>
  );
  return (
    <>
      <p className={styles.sub}>Understanding Indian anna sizes · Round bangles</p>

      <div className={styles.anna}>
        <p className={styles.annaBig}>1 anna = 1/16 inch</p>
        <p>
          2-1 = 2 inches + 1 anna <span aria-hidden="true">|</span> 2-2 = 2 inches + 2 anna
        </p>
        <p className={styles.annaSmall}>&ldquo;2.1&rdquo; and &ldquo;2.2&rdquo; are size labels, not decimal-inch measurements.</p>
      </div>

      <div className={styles.circles}>
        {circle('2-1 / 2.1', '52.4', 72)}
        {circle('2-2 / 2.2', '54.0', 76)}
      </div>
      <p className={styles.centerNote}>
        Measure across the centre, from inner edge to inner edge.
        <br />
        Do not include the metal thickness.
      </p>

      <h3 className={styles.chartTitle}>Size comparison chart</h3>
      <div className={styles.tables}>
        {table(left)}
        {table(right)}
      </div>

      <ul className={styles.notes}>
        <li className={styles.strong}>2-2 is approximately 1.6 mm wider inside than 2-1.</li>
        <li>Use a round bangle that already fits and compare its inside diameter.</li>
        <li>For oval or opening bangles, the inside measurement differs — contact us if you are unsure of the fit.</li>
        <li className={styles.fine}>Illustrations are not to scale.</li>
      </ul>
    </>
  );
}

// Full size guide in a dialog over the page (portalled to <body> so the
// sticky product columns can't cover it). Highlights this product's sizes.
export function SizeGuide({
  type,
  sizeLabels,
  onClose,
}: {
  type: SizeGuideType;
  sizeLabels: string[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const highlight = new Set(sizeLabels.map(normaliseLabel));
  const title = type === 'ring' ? 'Ring Size Guide' : 'Bangle Size Guide';

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close size guide">
            ×
          </button>
        </div>
        <div className={styles.body}>
          {type === 'ring' ? <RingGuide highlight={highlight} /> : <BangleGuide highlight={highlight} />}
          {highlight.size > 0 && <p className={styles.legend}>Highlighted rows are the sizes available for this design.</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
