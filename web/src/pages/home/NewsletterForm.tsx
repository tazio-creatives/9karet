import { useState, type FormEvent } from 'react';
import styles from './NewsletterForm.module.css';

// UI only — no newsletter_subscribers table/endpoint exists in the approved
// schema (flagged rather than inventing one silently). Wiring this to a
// real backend is a decision for a future phase.
export function NewsletterForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return <p className={styles.success}>Thank you — you're on the list.</p>;
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <input type="email" required placeholder="Your email address" className={styles.input} />
      <button type="submit" className={styles.button}>
        Subscribe
      </button>
    </form>
  );
}
