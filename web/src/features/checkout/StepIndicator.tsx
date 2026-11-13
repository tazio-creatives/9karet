import styles from './StepIndicator.module.css';

const STEPS: { step: 1 | 2 | 3; label: string }[] = [
  { step: 1, label: 'Bag' },
  { step: 2, label: 'Checkout' },
  { step: 3, label: 'Payment' },
];

export function StepIndicator({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  return (
    <div className={styles.indicator}>
      {STEPS.map(({ step, label }, i) => (
        <div className={styles.stepWrap} key={step}>
          <div className={styles.step}>
            <span
              className={
                step < currentStep
                  ? styles.circleDone
                  : step === currentStep
                    ? styles.circleActive
                    : styles.circle
              }
            >
              {step < currentStep ? '✓' : step}
            </span>
            <span className={step === currentStep ? styles.labelActive : styles.label}>{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <span className={step < currentStep ? styles.lineDone : styles.line} aria-hidden="true" />
          )}
        </div>
      ))}
    </div>
  );
}
