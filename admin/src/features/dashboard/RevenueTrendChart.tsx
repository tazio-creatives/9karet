import { formatPrice } from '../../utils/formatPrice';
import styles from './RevenueTrendChart.module.css';

interface RevenueTrendChartProps {
  data: { day: string; revenue: number }[];
}

// Minimal inline SVG bar chart — no charting library dependency, consistent
// with the rest of the codebase's hand-drawn-icon approach to avoid pulling
// in a heavy dep for a single 14-bar sparkline.
export function RevenueTrendChart({ data }: RevenueTrendChartProps) {
  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div className={styles.chart}>
      {data.map((d) => {
        const heightPct = Math.max((d.revenue / max) * 100, d.revenue > 0 ? 4 : 1.5);
        const label = new Date(d.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        return (
          <div key={d.day} className={styles.barCol} title={`${label}: ${formatPrice(d.revenue)}`}>
            <div className={styles.barTrack}>
              <div className={styles.bar} style={{ height: `${heightPct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
