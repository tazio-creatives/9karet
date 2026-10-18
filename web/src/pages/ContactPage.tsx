import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { sendContactMessage, type ContactMessageInput } from '../api/contact';
import { ApiError } from '../api/client';
import { POLICY_ICONS } from './policies/PolicyIcons';
import styles from './ContactPage.module.css';

const EMPTY: ContactMessageInput = { name: '', email: '', phone: '', orderNumber: '', message: '', website: '' };

export function ContactPage() {
  useDocumentTitle('Contact Us');
  const [form, setForm] = useState<ContactMessageInput>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () =>
      sendContactMessage({
        ...form,
        phone: form.phone?.trim() || undefined,
        orderNumber: form.orderNumber?.trim() || undefined,
      }),
    onSuccess: () => {
      setForm(EMPTY);
      setFieldErrors({});
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fields) {
        setFieldErrors(Object.fromEntries(err.fields.map((f) => [f.path, f.message])));
      }
    },
  });

  function set<K extends keyof ContactMessageInput>(key: K, value: ContactMessageInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (fieldErrors[key]) setFieldErrors(({ [key]: _removed, ...rest }) => rest);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  const generalError =
    mutation.isError && !(mutation.error instanceof ApiError && mutation.error.fields)
      ? mutation.error instanceof ApiError
        ? mutation.error.message
        : 'Something went wrong. Please try again.'
      : null;

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">›</span>
          <span>Contact Us</span>
        </nav>
        <h1 className={styles.title}>Contact Us</h1>
        <div className={styles.divider} aria-hidden="true">
          <span />
          {POLICY_ICONS.gem}
          <span />
        </div>
        <p className={styles.subtitle}>
          Questions about a design, an order, sizing or care? Send us a message and our team will get back to you.
        </p>
      </header>

      <div className={styles.body}>
        <section className={styles.formCard}>
          {mutation.isSuccess ? (
            <div className={styles.success} role="status">
              <span className={styles.successIcon}>{POLICY_ICONS.verify}</span>
              <h2>Thank you — your message has been sent</h2>
              <p>
                We’ve received your message and emailed you a confirmation. Our customer-support team will reply to
                you as soon as possible.
              </p>
              <button type="button" className={styles.secondaryButton} onClick={() => mutation.reset()}>
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <h2 className={styles.formTitle}>Send us a message</h2>
              <div className={styles.grid}>
                <label className={styles.field}>
                  <span>
                    Full name <em>*</em>
                  </span>
                  <input
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    autoComplete="name"
                    maxLength={120}
                    required
                    aria-invalid={!!fieldErrors.name}
                  />
                  {fieldErrors.name && <small className={styles.fieldError}>{fieldErrors.name}</small>}
                </label>
                <label className={styles.field}>
                  <span>
                    Email <em>*</em>
                  </span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    autoComplete="email"
                    maxLength={200}
                    required
                    aria-invalid={!!fieldErrors.email}
                  />
                  {fieldErrors.email && <small className={styles.fieldError}>{fieldErrors.email}</small>}
                </label>
                <label className={styles.field}>
                  <span>Phone (optional)</span>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    autoComplete="tel"
                    maxLength={30}
                    aria-invalid={!!fieldErrors.phone}
                  />
                  {fieldErrors.phone && <small className={styles.fieldError}>{fieldErrors.phone}</small>}
                </label>
                <label className={styles.field}>
                  <span>Order number (optional)</span>
                  <input
                    value={form.orderNumber}
                    onChange={(e) => set('orderNumber', e.target.value)}
                    placeholder="e.g. BD-260816-49836EA2"
                    maxLength={60}
                  />
                </label>
              </div>
              <label className={styles.field}>
                <span>
                  Message <em>*</em>
                </span>
                <textarea
                  value={form.message}
                  onChange={(e) => set('message', e.target.value)}
                  rows={6}
                  maxLength={5000}
                  required
                  aria-invalid={!!fieldErrors.message}
                />
                {fieldErrors.message && <small className={styles.fieldError}>{fieldErrors.message}</small>}
              </label>

              {/* Honeypot — visually hidden and skipped by keyboard/screen
                  readers; only bots fill it in. */}
              <label className={styles.honeypot} aria-hidden="true">
                Website
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(e) => set('website', e.target.value)}
                />
              </label>

              {generalError && (
                <p className={styles.generalError} role="alert">
                  {generalError}
                </p>
              )}

              <button type="submit" className={styles.submit} disabled={mutation.isPending}>
                {mutation.isPending ? 'Sending…' : 'Send Message'}
              </button>
            </form>
          )}
        </section>

        <aside className={styles.side}>
          <div className={styles.sideCard}>
            <span className={styles.sideIcon}>{POLICY_ICONS.mail}</span>
            <h3>Email us</h3>
            <p>
              <a href="mailto:info@9karet.com">info@9karet.com</a>
            </p>
            <p className={styles.sideNote}>Please include your order number for order-related questions.</p>
          </div>
          <div className={styles.sideCard}>
            <span className={styles.sideIcon}>{POLICY_ICONS.map}</span>
            <h3>Registered office</h3>
            <p>
              9Karet
              <br />
              Goldbox Diamonds Private Limited
              <br />
              No 281/287, 39 1-3, Narsi Natha Street, Princess Dock, Mumbai – 400009, Maharashtra
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
