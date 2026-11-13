import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import { POLICY_ICONS, type PolicyIconName } from './PolicyIcons';
import styles from './PolicyDocLayout.module.css';

export interface PolicySection {
  id: string;
  title: string;
  icon: PolicyIconName;
  content: ReactNode;
}

// Card-based long-form policy layout (Return and Refund Policy): a cream
// hero, a sticky "On this page" index that tracks the section being read,
// an optional "At a glance" summary card, then one numbered card per
// section. Section bodies are plain p/ul/ol, styled generically here.
export function PolicyDocLayout({
  title,
  breadcrumbSection = 'Policies',
  subtitle,
  lastUpdated,
  glance,
  sections,
}: {
  title: string;
  // Middle breadcrumb crumb (Home › <this> › title).
  breadcrumbSection?: string;
  subtitle: ReactNode;
  lastUpdated: string;
  glance?: { heading: string; content: ReactNode };
  sections: PolicySection[];
}) {
  useDocumentTitle(title);
  const [activeId, setActiveId] = useState(sections[0]?.id ?? '');

  // Scroll-spy: the active index entry is the section crossing a thin band
  // ~20–30% down the viewport.
  useEffect(() => {
    const elements = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el != null);
    if (elements.length === 0 || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          // Two cards can straddle the line at once (one ending, the next
          // starting) — the one that started most recently is being read.
          visible.sort((a, b) => b.boundingClientRect.top - a.boundingClientRect.top);
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  // Deep links (e.g. /refund-policy#cancellation, where the retired
  // /cancellation-policy redirects) — the cards render after navigation,
  // so the browser's own hash jump has nothing to land on yet.
  const { hash } = useLocation();
  useEffect(() => {
    const id = hash.replace('#', '');
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }));
    setActiveId(id);
  }, [hash]);

  function jumpTo(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', `#${id}`);
    setActiveId(id);
  }

  const index = (
    <ol className={styles.tocList}>
      {sections.map((s, i) => (
        <li key={s.id}>
          <a
            href={`#${s.id}`}
            onClick={(e) => jumpTo(e, s.id)}
            className={s.id === activeId ? styles.tocLinkActive : styles.tocLink}
            aria-current={s.id === activeId ? 'location' : undefined}
          >
            <span className={styles.tocNumber}>{String(i + 1).padStart(2, '0')}</span>
            {s.title}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">›</span>
          <span>{breadcrumbSection}</span>
          <span aria-hidden="true">›</span>
          <span>{title}</span>
        </nav>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.divider} aria-hidden="true">
          <span />
          {POLICY_ICONS.gem}
          <span />
        </div>
        <p className={styles.subtitle}>{subtitle}</p>
        <p className={styles.lastUpdated}>Last Updated: {lastUpdated}</p>
      </header>

      <div className={styles.body}>
        <aside className={styles.toc} aria-label="On this page">
          <p className={styles.tocHeading}>On this page</p>
          {index}
        </aside>

        {/* Below the desktop breakpoint the sticky sidebar is replaced by a
            collapsible index above the content. */}
        <details className={styles.tocMobile}>
          <summary>On this page</summary>
          {index}
        </details>

        <div className={styles.main}>
          {glance && (
            <section className={styles.glance}>
              <span className={styles.glanceIcon}>{POLICY_ICONS.shield}</span>
              <div>
                <p className={styles.glanceEyebrow}>At a glance</p>
                <h2 className={styles.glanceHeading}>{glance.heading}</h2>
                <div className={styles.glanceContent}>{glance.content}</div>
              </div>
            </section>
          )}

          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className={styles.card}>
              <span className={styles.cardIcon}>{POLICY_ICONS[s.icon]}</span>
              <div className={styles.cardBody}>
                <h2 className={styles.cardTitle}>
                  <span className={styles.cardNumber}>{String(i + 1).padStart(2, '0')}</span>
                  {s.title}
                </h2>
                <div className={styles.cardContent}>{s.content}</div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
