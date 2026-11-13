import { useQuery } from '@tanstack/react-query';
import { fetchActiveRepriceJobs } from '../../api/pricingRules';
import { ProgressBar } from '../../components/ProgressBar';
import styles from './pricing.module.css';

const TRIGGER_LABEL: Record<string, string> = {
  RULE_CREATED: 'New rule activated',
  RULE_UPDATED: 'Rule updated',
  RULE_ACTIVATED: 'Rule activated',
  RULE_DISABLED: 'Rule disabled',
  RULE_EXPIRED: 'Rule expired',
  RULE_DELETED: 'Rule deleted',
  OVERRIDE_BULK: 'Bulk override change',
  MANUAL: 'Manual repricing',
};

// Mounted once in PricingLayout so progress is visible from every tab, not
// just wherever the rule that triggered it happens to be. Polls every 2s
// while anything is QUEUED/RUNNING, every 8s otherwise (so a job started
// from another admin's tab still shows up here reasonably promptly without
// hammering the API when nothing is happening).
export function RepriceProgressBanner() {
  const { data } = useQuery({
    queryKey: ['pricing-active-reprice-jobs'],
    queryFn: fetchActiveRepriceJobs,
    refetchInterval: (query) => ((query.state.data?.jobs.length ?? 0) > 0 ? 2000 : 8000),
  });

  const jobs = data?.jobs ?? [];
  if (jobs.length === 0) return null;

  return (
    <div className={styles.repriceBanner}>
      {jobs.map((job) => (
        <div key={job.id} className={styles.repriceBannerRow}>
          <div className={styles.repriceBannerText}>
            <strong>Recalculating prices</strong>
            <span>
              {job.ruleNameSnapshot ?? TRIGGER_LABEL[job.trigger] ?? 'Pricing update'}
              {job.status === 'QUEUED' ? ' — starting…' : ''}
            </span>
          </div>
          <div className={styles.repriceBannerBar}>
            <ProgressBar completed={job.processedCount} total={job.totalCount || 1} />
          </div>
        </div>
      ))}
    </div>
  );
}
