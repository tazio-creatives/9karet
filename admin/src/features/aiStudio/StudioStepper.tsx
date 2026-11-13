import type { StudioJobStatus } from '../../api/aiStudio';
import styles from './StudioStepper.module.css';

const STEPS = [
  { label: 'Upload', statuses: ['draft', 'uploading'] },
  { label: 'Analyse & Confirm', statuses: ['analysing'] },
  { label: 'Choose Presenter', statuses: [] as string[] },
  { label: 'Generate', statuses: ['generating'] },
  { label: 'Review & Import', statuses: ['review_ready', 'partially_failed', 'importing', 'completed'] },
] as const;

// Ring skips the "Choose Presenter" step entirely — generation starts
// immediately once the category is confirmed (no pose choice, no extra
// confirmation screen), so that dot never applies to a Ring job.
const RING_STEPS = STEPS.filter((step) => step.label !== 'Choose Presenter');

interface StudioStepperProps {
  status: StudioJobStatus | null;
  confirmSubStep: 'analyse' | 'measurements' | 'presenter' | 'prompts';
  generateCount: number;
  isRing?: boolean;
}

export function StudioStepper({ status, confirmSubStep, generateCount, isRing }: StudioStepperProps) {
  const steps = isRing ? RING_STEPS : STEPS;
  const generateStepIndex = steps.findIndex((s) => s.label === 'Generate');

  let activeIndex = 0;
  if (!status) {
    activeIndex = 0;
  } else if (status === 'failed' || status === 'cancelled') {
    activeIndex = -1;
  } else if (status === 'awaiting_confirmation') {
    activeIndex = isRing || confirmSubStep === 'analyse' ? 1 : 2;
  } else {
    activeIndex = steps.findIndex((s) => (s.statuses as readonly string[]).includes(status));
  }

  return (
    <ol className={styles.stepper}>
      {steps.map((step, i) => {
        const isDone = activeIndex > i || status === 'completed';
        const isActive = activeIndex === i && status !== 'completed';
        const label = i === generateStepIndex ? `Generate ${generateCount} Image${generateCount === 1 ? '' : 's'}` : step.label;
        return (
          <li key={step.label} className={styles.step}>
            <span className={isActive ? styles.dotActive : isDone ? styles.dotDone : styles.dot}>{i + 1}</span>
            <span className={isActive ? styles.labelActive : styles.label}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
