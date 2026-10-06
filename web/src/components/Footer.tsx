import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

// Desktop never renders this (Footer.module.css hides it above 767px) — the
// mobile accordion spec calls for a plus/minus glyph specifically, not a
// rotating chevron: the vertical stroke is simply omitted once open, so
// "plus" and "minus" are the same element with one line conditionally shown.
function PlusMinusIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={styles.colIcon}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="4" y1="12" x2="20" y2="12" />
      {!open && <line x1="12" y1="4" x2="12" y2="20" />}
    </svg>
  );
}

const COLUMNS: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: 'Shop',
    links: [
      { label: 'Rings', to: '/rings' },
      { label: 'Earrings', to: '/earrings' },
      { label: 'Necklaces', to: '/necklaces' },
      { label: 'Bangles', to: '/bangles' },
      { label: 'Bracelets', to: '/bracelets' },
      { label: 'Pendants', to: '/pendants' },
      { label: 'Gifts', to: '/gifts' },
    ],
  },
  {
    title: 'Customer Care',
    links: [
      { label: 'Contact Us', to: '/contact' },
      { label: 'Care Guide', to: '/care-guide' },
    ],
  },
  {
    title: 'About Us',
    links: [
      { label: 'Our Story', to: '/our-story' },
      { label: 'Why Box Diamonds', to: '/why-box-diamonds' },
      { label: 'Blog', to: '/blog' },
      { label: 'Sustainability', to: '/sustainability' },
    ],
  },
  {
    title: 'Policies',
    links: [
      { label: 'Privacy Policy', to: '/privacy-policy' },
      { label: 'Terms & Conditions', to: '/terms' },
      { label: 'Return & Refund Policy', to: '/refund-policy' },
      { label: 'Shipping Policy', to: '/shipping-policy' },
    ],
  },
];

export function Footer() {
  // Collapsed by default, and only one group open at a time — only matters
  // below 767px (Footer.module.css forces every group open above that,
  // ignoring this state entirely), so desktop keeps showing all links at
  // once as before.
  const [openSection, setOpenSection] = useState<string | null>(null);
  function toggleSection(title: string) {
    setOpenSection((prev) => (prev === title ? null : title));
  }

  return (
    <footer className={styles.footer}>
      <div className={styles.top}>
        <div className={styles.brandCol}>
          <img src="/images/logo-white.png" alt="Box Diamonds" className={styles.logo} />
          <p className={styles.tagline}>
            Shop certified natural diamond jewellery online — fine diamond jewellery delivered across India. Because
            every precious moment deserves a perfect sparkle.
          </p>
          <div className={styles.social}>
            <SocialIcon label="Instagram">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
            </SocialIcon>
            <SocialIcon label="Facebook">
              <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v6h3v-6h3l1-3h-4v-2c0-.6.4-1 1-1z" />
            </SocialIcon>
            <SocialIcon label="Pinterest">
              <circle cx="12" cy="12" r="9" />
              <path d="M9.5 17c1-3 1.5-5 1.5-6.5a2 2 0 1 1 4 .3c0 1.2-.8 3.2-1.2 4.2-.4 1 .2 1.8 1.2 1.8 1.5 0 2.6-1.9 2.6-4.4 0-2.3-1.7-4-4.3-4-3 0-4.7 2.1-4.7 4.4 0 .8.3 1.6.6 2" />
            </SocialIcon>
            <SocialIcon label="YouTube">
              <rect x="3" y="6" width="18" height="12" rx="3" />
              <path d="M11 10l4 2-4 2v-4z" fill="currentColor" stroke="none" />
            </SocialIcon>
          </div>
        </div>

        {COLUMNS.map((col) => {
          const isOpen = openSection === col.title;
          return (
            <div key={col.title} className={styles.col}>
              <button
                type="button"
                className={styles.colTitleButton}
                aria-expanded={isOpen}
                onClick={() => toggleSection(col.title)}
              >
                <span className={styles.colTitle}>{col.title}</span>
                <PlusMinusIcon open={isOpen} />
              </button>
              <ul className={isOpen ? `${styles.linkList} ${styles.linkListOpen}` : styles.linkList}>
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className={styles.link}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className={styles.bottom}>
        <p className={styles.copy}>
          © {new Date().getFullYear()} BOX DIAMONDS — Certified Natural Diamond Jewellery. All rights reserved.
        </p>
        <p className={styles.secure}>100% Secure Payments</p>
      </div>
    </footer>
  );
}

function SocialIcon({ label, children }: { label: string; children: ReactNode }) {
  return (
    <a href="#" className={styles.socialIcon} aria-label={label} onClick={(e) => e.preventDefault()}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        {children}
      </svg>
    </a>
  );
}
