import { useState, type ReactNode } from 'react';
import { useHead } from '../seo/head';
import { breadcrumbJsonLd, organizationJsonLd } from '../seo/jsonLd';
import styles from './RetailPartnerPage.module.css';

// "Retail Partnership Program" landing page (/retail-partner) — the shop-in-
// shop counter offer for jewellery stores. Static content; every figure in
// the tables and the calculator comes from the one profit rule below, so
// the numbers can't drift apart.

const LAKH = 100_000;
const INVESTMENT = 50 * LAKH;
const SLAB_LIMIT = 20 * LAKH; // monthly sales up to this share at 25%, above it at 30%
const SLAB1_SHARE = 0.25;
const SLAB2_SHARE = 0.3;
const PHONE_DISPLAY = '+91 73042 94849';
const PHONE = '917304294849';
const EMAIL = 'partner@boxdiamonds.com';
const APPLY_TEXT =
  'Hi Box Diamonds, I would like to become a Retail Partner.\n\nName:\nPhone:\nStore name and city:\nStore type (jewellery store / mall / premium retail):\nApprox. footfall and counter location:';
const WHATSAPP_URL = `https://wa.me/${PHONE}?text=${encodeURIComponent(APPLY_TEXT)}`;
const EMAIL_URL = `mailto:${EMAIL}?subject=${encodeURIComponent('Retail Partner enquiry')}&body=${encodeURIComponent(APPLY_TEXT)}`;

function partnerShare(sales: number, margin: number) {
  return SLAB1_SHARE * Math.min(sales, SLAB_LIMIT) * margin + SLAB2_SHARE * Math.max(0, sales - SLAB_LIMIT) * margin;
}

// Monthly sales needed for a given monthly partner share (inverse of above).
function salesForShare(share: number, margin: number) {
  const slab1Max = SLAB1_SHARE * SLAB_LIMIT * margin;
  return share <= slab1Max ? share / (SLAB1_SHARE * margin) : SLAB_LIMIT + (share - slab1Max) / (SLAB2_SHARE * margin);
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const lakh = (n: number) => `₹${(n / LAKH).toLocaleString('en-IN')} Lakh`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/* ---------- small building blocks ---------- */

function Eyebrow({ children, center }: { children: ReactNode; center?: boolean }) {
  return <p className={`${styles.eyebrow} ${center ? styles.eyebrowCenter : ''}`}>{children}</p>;
}

function Checklist({ items }: { items: string[] }) {
  return (
    <ul className={styles.checklist}>
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}

const ICON = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ICONS: Record<string, ReactNode> = {
  growth: (
    <svg viewBox="0 0 24 24" {...ICON}>
      <path d="M4 16l5-5 4 4 7-7" />
      <path d="M15 8h5v5" />
    </svg>
  ),
  drop: (
    <svg viewBox="0 0 24 24" {...ICON}>
      <path d="M12 3.5c3 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2.5-6 5.5-10z" />
    </svg>
  ),
  rupee: (
    <svg viewBox="0 0 24 24" {...ICON}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9 8h6M9 11h6M10.5 8c2.5 0 2.5 3 0 3H9l4 5" />
    </svg>
  ),
  gem: (
    <svg viewBox="0 0 24 24" {...ICON}>
      <path d="M6 4h12l3 5-9 11L3 9z" />
      <path d="M3 9h18M9 4l3 16 3-16" />
    </svg>
  ),
  megaphone: (
    <svg viewBox="0 0 24 24" {...ICON}>
      <path d="M4 10v4h3l6 4V6L7 10z" />
      <path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 24 24" {...ICON}>
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20 4v4.5h-4.5" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" {...ICON}>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" {...ICON}>
      <path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z" />
      <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-2-2l.8-1-1-2z" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" {...ICON}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" {...ICON}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z" />
    </svg>
  ),
  pendant: (
    <svg viewBox="0 0 48 48" {...ICON}>
      <path d="M10 6c2 10 8 16 14 16s12-6 14-16" />
      <path d="M24 22l-5 6 5 8 5-8z" />
    </svg>
  ),
  earrings: (
    <svg viewBox="0 0 48 48" {...ICON}>
      <circle cx="17" cy="9" r="3" />
      <circle cx="31" cy="9" r="3" />
      <path d="M17 12l-4 9 4 9 4-9zM31 12l-4 9 4 9 4-9z" />
    </svg>
  ),
  ring: (
    <svg viewBox="0 0 48 48" {...ICON}>
      <circle cx="24" cy="30" r="10" />
      <path d="M20 14h8l2 3-6 4-6-4z" />
    </svg>
  ),
  bracelet: (
    <svg viewBox="0 0 48 48" {...ICON}>
      <ellipse cx="24" cy="24" rx="16" ry="8" />
      {[[8, 24], [13, 18], [21, 16.3], [29, 16.3], [36, 18], [40, 24], [35, 30], [13, 30]].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.6" fill="currentColor" />
      ))}
    </svg>
  ),
};

/* ---------- content ---------- */

const STATS = [
  { label: 'Space', value: '50 sq ft', note: 'Counter inside your store' },
  { label: 'Investment', value: '₹50 Lakh', note: 'Partner investment' },
  { label: 'Collection', value: '9K & 18K', note: 'Natural diamond jewellery' },
  { label: 'Profit share', value: '25% – 30%', note: 'Higher share above ₹20 Lakh monthly sales' },
];

const WHY = [
  { icon: 'growth', title: 'Expand your business', text: 'Increase your product range and customer base without opening a new store.' },
  { icon: 'drop', title: 'Lightweight, trend-driven', text: 'Designs for daily wear, gifting and celebrations. Lower ticket sizes mean quicker decisions and faster sales.' },
  { icon: 'rupee', title: 'Rising profit share', text: 'Earn 25% of counter profit, rising to 30% on profit from monthly sales above ₹20 Lakh.' },
  { icon: 'gem', title: 'Premium quality guarantee', text: 'Every piece is certified natural diamond jewellery, backed by the Box Diamonds quality promise.' },
  { icon: 'megaphone', title: 'Marketing & branding', text: 'In-store branding, counter design, promotional creatives and social media campaigns to drive footfall.' },
  { icon: 'refresh', title: 'Buyback & exchange', text: 'Customers buy with confidence and come back to your store to upgrade or exchange.' },
];

const COLLECTION = [
  { icon: 'pendant', name: 'Diamond Pendant', from: 12000 },
  { icon: 'earrings', name: 'Diamond Earrings', from: 12500 },
  { icon: 'ring', name: 'Diamond Ring', from: 6500 },
  { icon: 'bracelet', name: 'Diamond Bracelet', from: 16000 },
];

const COMPARISON: [string, string, string][] = [
  ['Diamond sourcing and quality checks', 'Your cost and your risk', 'Box Diamonds'],
  ['Design development and trend risk', 'Your cost', 'Box Diamonds'],
  ['Slow-moving or dead stock', 'Your loss', 'Box Diamonds refreshes stock'],
  ['Certification and quality guarantee', 'Your responsibility', 'Box Diamonds'],
  ['Brand building and digital marketing', 'Your cost', 'Box Diamonds'],
  ['Buyback and exchange system', 'Your responsibility', 'Box Diamonds'],
  ['Staff product training', 'Your cost', 'Box Diamonds'],
  ['Your earnings', 'Profit after all of the above', '25% to 30% of counter profit, with no brand, design or marketing spend'],
];

const DEAL = [
  { title: 'Interests aligned', text: 'Both sides earn from profit, and your share rises as sales grow, so Box Diamonds has every reason to send the right stock, price it well and market your counter actively.' },
  { title: 'Full transparency', text: 'A monthly profit statement shows sales, product cost, direct costs and your share. Every rupee of the calculation is visible to you.' },
  { title: 'Extra income', text: 'No new store, rent, licence or team. The counter uses your existing location, footfall, staff and customer trust.' },
  { title: 'More footfall', text: 'Box Diamonds campaigns bring new, younger customers who also buy your own jewellery, and you keep 100% of that profit.' },
  { title: 'Repeat customers', text: 'Buyback and exchange bring customers back to your store to upgrade, exchange or buy again.' },
  { title: 'Brand power', text: '14 years of manufacturing experience and direct diamond sourcing behind every piece on your counter.' },
];

const STEPS = [
  { title: 'Enquire', text: 'Call or email our partnership team.' },
  { title: 'Discussion', text: 'We understand your store, location and customers.' },
  { title: 'Store assessment', text: 'We review counter location, visibility and footfall.' },
  { title: 'Agreement', text: 'Sign the agreement and complete the investment.' },
  { title: 'Counter setup', text: 'Installation, inventory placement and staff training.' },
  { title: 'Grand launch', text: 'Launch event and marketing campaign.' },
  { title: 'Grow together', text: 'Ongoing support, design refresh and monthly profit statement.' },
];

const FAQS = [
  { q: 'How much space do I need?', a: 'About 50 sq ft of dedicated floor space, ideally near the entrance or main display, with a power supply for counter lighting and CCTV and safe storage as per standard jewellery store practice.' },
  { q: 'What is the investment?', a: 'The partner investment is ₹50 Lakh. It supports the inventory placed at your counter, counter design and branding, launch marketing and staff training. The exact breakdown, refundability and security terms are set out in the partnership agreement.' },
  { q: 'How is profit shared?', a: 'Counter profit is net counter sales minus product cost and direct counter costs. You receive 25% of the profit from the first ₹20 Lakh of sales each month and 30% of the profit from every sale above ₹20 Lakh, with a monthly profit statement.' },
  { q: 'What is the ₹20 Lakh sales level?', a: 'It is the monthly sales level where the higher share starts. Profit from the first ₹20 Lakh is always shared at 25%, and only the profit from sales above it earns 30%, so there are no sudden jumps or drops at the threshold.' },
  { q: 'Which products will be displayed?', a: 'A curated range of natural diamond pendants, earrings, rings, bracelets and more in 9K and 18K gold, with new designs and regular stock refreshes to keep your counter fresh.' },
  { q: 'Are the diamonds natural?', a: 'Yes. Every piece uses 100% natural diamonds, never lab-grown, and comes as certified jewellery.' },
  { q: 'Who provides branding and marketing?', a: 'Box Diamonds provides the branded counter, in-store branding, marketing creatives, social media and promotions. As the partner you promote the counter to your existing customers locally.' },
  { q: 'Do customers get buyback and exchange?', a: 'Yes. Box Diamonds provides buyback, exchange and after-sales support, which also brings customers back to your store.' },
  { q: 'Which cities are eligible?', a: 'Jewellery stores (gold, silver or multi-brand), shopping malls and premium retail spaces in Tier 1, Tier 2 and upcoming cities, subject to a store assessment.' },
];

/* ---------- sections ---------- */

function Calculator() {
  const [sales, setSales] = useState(20 * LAKH);
  const [margin, setMargin] = useState(0.3);
  const profit = sales * margin;
  const share = partnerShare(sales, margin);
  const annual = share * 12;
  return (
    <div className={styles.calc}>
      <div className={styles.calcInputs}>
        <label className={styles.slider}>
          <span className={styles.sliderHead}>
            <span>Monthly counter sales</span>
            <strong>{inr(sales)}</strong>
          </span>
          <input
            type="range"
            min={5 * LAKH}
            max={60 * LAKH}
            step={LAKH}
            value={sales}
            onChange={(e) => setSales(Number(e.target.value))}
            style={{ ['--fill' as string]: `${((sales - 5 * LAKH) / (55 * LAKH)) * 100}%` }}
          />
        </label>
        <label className={styles.slider}>
          <span className={styles.sliderHead}>
            <span>Counter profit margin</span>
            <strong>{Math.round(margin * 100)}%</strong>
          </span>
          <input
            type="range"
            min={20}
            max={40}
            step={1}
            value={Math.round(margin * 100)}
            onChange={(e) => setMargin(Number(e.target.value) / 100)}
            style={{ ['--fill' as string]: `${((margin * 100 - 20) / 20) * 100}%` }}
          />
        </label>
        <p className={styles.calcNote}>
          Estimates only. Actual results depend on sales, product mix, gold prices and the costs agreed in the partnership
          agreement.
        </p>
      </div>
      <div className={styles.calcResult} aria-live="polite">
        <p className={styles.calcLabel}>Your estimated monthly share</p>
        <p className={styles.calcBig}>{inr(share)}</p>
        <dl className={styles.calcRows}>
          <div>
            <dt>Counter profit</dt>
            <dd>{inr(profit)}</dd>
          </div>
          <div>
            <dt>Your effective share</dt>
            <dd>{pct(share / profit)}</dd>
          </div>
          <div>
            <dt>Your annual share</dt>
            <dd>{inr(annual)}</dd>
          </div>
          <div>
            <dt>Annual return on ₹50 Lakh</dt>
            <dd>{pct(annual / INVESTMENT)}</dd>
          </div>
          <div>
            <dt>Payback period</dt>
            <dd>{Math.ceil(INVESTMENT / share)} months</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function Faq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className={styles.faq}>
      {FAQS.map((f, i) => (
        <div key={f.q} className={styles.faqItem}>
          <button
            type="button"
            className={styles.faqQ}
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span>{f.q}</span>
            <span className={styles.faqIcon} aria-hidden="true">
              {open === i ? '−' : '+'}
            </span>
          </button>
          {open === i && <p className={styles.faqA}>{f.a}</p>}
        </div>
      ))}
    </div>
  );
}

export function RetailPartnerPage() {
  useHead({
    title: 'Retail Partnership Program — Diamond Jewellery Counter | BOX DIAMONDS',
    description:
      'Add a 50 sq ft Box Diamonds counter to your jewellery store: certified natural diamond jewellery in 9K and 18K gold, branding and marketing support, and a 25–30% share of counter profit.',
    canonicalPath: '/retail-partner',
    jsonLd: [organizationJsonLd(), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Retail Partner', path: '/retail-partner' }])],
  });

  const MARGIN = 0.3;
  const exampleSales = [10, 20, 30, 50].map((l) => l * LAKH);

  return (
    <div className={styles.page}>
      {/* Hero */}
      <section className={`${styles.band} ${styles.hero}`}>
        <div className={`${styles.inner} ${styles.heroGrid}`}>
          <div>
            <Eyebrow>Retail Partnership Program</Eyebrow>
            <h1 className={styles.heroTitle}>
              Expand your gold jewellery business with <span className={styles.accent}>Box Diamonds</span>
            </h1>
            <p className={styles.heroText}>
              Add a premium collection of ultra-lightweight natural diamond jewellery in 9K and 18K gold to your store. All
              it takes is a dedicated 50 sq ft counter. We bring the collection, branding and sales support, and you share
              in the profit from every sale.
            </p>
            <div className={styles.actions}>
              <a href="#apply" className={styles.btnGold}>
                Be Our Retail Partner
              </a>
              <a href="#calculator" className={styles.btnOutline}>
                Estimate Your Earnings
              </a>
            </div>
          </div>
          <div className={styles.heroArt} aria-hidden="true">
            <span className={styles.ringOuter} />
            <span className={styles.ringInner} />
            <svg className={styles.diamond} viewBox="0 0 200 180">
              <defs>
                <linearGradient id="rp-gem" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#f6f1e6" />
                  <stop offset="1" stopColor="#b9c9c6" />
                </linearGradient>
              </defs>
              <path d="M40 10h120l35 50-95 115L5 60z" fill="url(#rp-gem)" stroke="#d4b56a" strokeWidth="3" strokeLinejoin="round" />
              <path d="M5 60h190M70 10L55 60l45 115 45-115-15-50M100 10L70 60M100 10l30 50" fill="none" stroke="#d4b56a" strokeWidth="2.2" strokeLinejoin="round" />
              <circle cx="58" cy="35" r="2.5" fill="#fff" />
              <circle cx="150" cy="44" r="2.5" fill="#fff" />
            </svg>
            <div className={styles.badge}>
              <span>Diamond jewellery</span>
              <span>starting</span>
              <strong>₹5,000</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Key figures */}
      <section className={styles.stats}>
        <div className={`${styles.inner} ${styles.statsGrid}`}>
          {STATS.map((s) => (
            <div key={s.label} className={styles.stat}>
              <p className={styles.statLabel}>{s.label}</p>
              <p className={styles.statValue}>{s.value}</p>
              <p className={styles.statNote}>{s.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section className={`${styles.band} ${styles.ivory}`}>
        <div className={`${styles.inner} ${styles.split}`}>
          <div>
            <Eyebrow>About Box Diamonds</Eyebrow>
            <h2 className={styles.h2}>Real diamonds. Lightweight designs. Accessible prices.</h2>
            <p className={styles.lead}>
              Box Diamonds is a natural diamond jewellery brand built on 14 years of jewellery manufacturing experience and
              direct diamond sourcing. We design ultra-lightweight, trend-driven jewellery for today&apos;s modern customer,
              especially the fast-growing Gen Z and young professional segment.
            </p>
          </div>
          <Checklist
            items={[
              '100% natural diamonds, no lab-grown',
              '9K gold for everyday affordability, 18K gold for premium purchases',
              'Ultra-lightweight designs that keep prices accessible',
              'Certified jewellery with buyback and exchange support',
              'Direct sourcing and in-house manufacturing expertise',
            ]}
          />
        </div>
      </section>

      {/* Why partner */}
      <section className={`${styles.band} ${styles.cream}`}>
        <div className={styles.inner}>
          <Eyebrow>Why partner with us</Eyebrow>
          <h2 className={styles.h2}>Grow together. Shine together.</h2>
          <p className={styles.lead}>
            A Box Diamonds counter brings in younger, first-time diamond buyers who might never walk in for traditional heavy
            gold.
          </p>
          <div className={styles.cards3}>
            {WHY.map((w) => (
              <div key={w.title} className={styles.card}>
                <span className={styles.cardIcon}>{ICONS[w.icon]}</span>
                <h3 className={styles.h3}>{w.title}</h3>
                <p>{w.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Counter model */}
      <section className={`${styles.band} ${styles.ivory}`}>
        <div className={`${styles.inner} ${styles.split}`}>
          <div>
            <Eyebrow>The counter model</Eyebrow>
            <h2 className={styles.h2}>A compact, high-impact shop-in-shop</h2>
            <p className={styles.lead}>
              Designed to sit within your existing jewellery store and turn 50 sq ft into a premium diamond destination.
            </p>
            <h3 className={styles.h3}>What the counter includes</h3>
            <Checklist
              items={[
                'Branded Box Diamonds display counter and signage',
                'Secure display trays and lighting designed for diamonds',
                'Curated pendants, earrings, rings, bracelets and more',
                'Brand panels, price cards and certification display',
                'Customer brochures and catalogue',
              ]}
            />
          </div>
          <div className={styles.panel}>
            <h3 className={styles.h3}>Space requirements</h3>
            <Checklist
              items={[
                'About 50 sq ft of dedicated floor space',
                'Good visibility, ideally near the entrance or main display',
                'Power supply for counter lighting',
                'CCTV and safe storage as per standard jewellery store practice',
              ]}
            />
            <h3 className={styles.h3}>Ideal for</h3>
            <Checklist
              items={[
                'Jewellery stores (gold, silver or multi-brand)',
                'Shopping malls and premium retail spaces',
                'Tier 1, Tier 2 and upcoming cities',
              ]}
            />
          </div>
        </div>
      </section>

      {/* Collection */}
      <section className={`${styles.band} ${styles.sage}`}>
        <div className={styles.inner}>
          <Eyebrow>The collection</Eyebrow>
          <h2 className={styles.h2}>Stylish. Sparkling. Timeless.</h2>
          <p className={styles.lead}>
            Ultra-lightweight natural diamond jewellery for everyday wear, office wear, gifting and celebrations, with new
            designs launched regularly to keep your counter fresh.
          </p>
          <div className={styles.cards4}>
            {COLLECTION.map((c) => (
              <div key={c.name} className={`${styles.card} ${styles.cardCenter}`}>
                <span className={styles.jewelIcon}>{ICONS[c.icon]}</span>
                <h3 className={styles.h3}>{c.name}</h3>
                <p className={styles.small}>Starting</p>
                <p className={styles.price}>{inr(c.from)}</p>
              </div>
            ))}
          </div>
          <div className={styles.cards2}>
            {[
              { k: '9K', t: '9K Gold', d: 'The most affordable entry into real diamond jewellery, ideal for daily wear, gifting and first purchases.' },
              { k: '18K', t: '18K Gold', d: 'A premium finish and higher gold value for customers seeking classic luxury.' },
            ].map((g) => (
              <div key={g.k} className={`${styles.card} ${styles.karat}`}>
                <span className={styles.coin}>{g.k}</span>
                <div>
                  <h3 className={styles.h3}>{g.t}</h3>
                  <p>{g.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Investment & profit */}
      <section className={`${styles.band} ${styles.ivory}`}>
        <div className={styles.inner}>
          <Eyebrow>Investment &amp; profit sharing</Eyebrow>
          <h2 className={styles.h2}>The more your counter sells, the higher your share</h2>
          <p className={styles.lead}>
            Your ₹50 Lakh investment supports inventory placed at your counter, counter design and branding, launch marketing
            and staff training. The exact breakdown, refundability and security terms are set out in the partnership
            agreement.
          </p>
          <div className={styles.cards2}>
            <div className={styles.slab}>
              <p className={styles.slabLabel}>Slab 1 · Monthly sales up to ₹20 Lakh</p>
              <p className={styles.slabBig}>
                25% <span>to partner</span>
              </p>
              <p>75% to Box Diamonds. Profit from the first ₹20 Lakh of sales each month is always shared at 25%.</p>
            </div>
            <div className={`${styles.slab} ${styles.slabHi}`}>
              <p className={styles.slabLabel}>Slab 2 · Monthly sales above ₹20 Lakh</p>
              <p className={styles.slabBig}>
                30% <span>to partner</span>
              </p>
              <p>
                70% to Box Diamonds. Profit from every sale above ₹20 Lakh in the month earns you 30%. No sudden jumps or
                drops at the threshold.
              </p>
            </div>
          </div>

          <h3 className={`${styles.h3} ${styles.subhead}`}>How counter profit is calculated</h3>
          <div className={styles.formula}>
            {[
              ['Net counter sales', 'Sales value after GST, discounts and returns'],
              ['− Product cost', 'Natural diamonds, 9K / 18K gold, making charges, certification'],
              ['− Direct counter costs', 'Packaging, card charges, counter promotions, buyback and exchange adjustments'],
              ['= Counter profit', 'Shared between you and Box Diamonds as per the slabs, with a monthly profit statement'],
            ].map(([t, d]) => (
              <div key={t}>
                <h4>{t}</h4>
                <p>{d}</p>
              </div>
            ))}
          </div>

          <h3 className={`${styles.h3} ${styles.subhead}`}>Illustrative example</h3>
          <p className={styles.small}>
            Assumes a 30% counter profit margin, for illustration only. Actual margins depend on product mix, gold prices and
            costs. Not a guarantee of sales or earnings.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Monthly counter sales</th>
                  <th>Counter profit (30%)</th>
                  <th>Partner share</th>
                  <th>Company share</th>
                  <th>Partner&apos;s effective share</th>
                </tr>
              </thead>
              <tbody>
                {exampleSales.map((s) => {
                  const profit = s * MARGIN;
                  const share = partnerShare(s, MARGIN);
                  return (
                    <tr key={s}>
                      <td>{inr(s)}</td>
                      <td>{inr(profit)}</td>
                      <td className={styles.hl}>{inr(share)}</td>
                      <td>{inr(profit - share)}</td>
                      <td>{pct(share / profit)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className={styles.small}>
            How ₹30 Lakh works: profit on the first ₹20 Lakh is ₹6,00,000, and 25% of that is ₹1,50,000. Profit on the next
            ₹10 Lakh is ₹3,00,000, and 30% of that is ₹90,000. Partner total: ₹2,40,000.
          </p>
        </div>
      </section>

      {/* Calculator */}
      <section id="calculator" className={`${styles.band} ${styles.cream}`}>
        <div className={styles.inner}>
          <Eyebrow>Earnings calculator</Eyebrow>
          <h2 className={styles.h2}>Estimate your monthly earnings</h2>
          <p className={styles.lead}>Move the sliders to see an illustrative estimate of your profit share and return on investment.</p>
          <Calculator />
        </div>
      </section>

      {/* Strong deal */}
      <section className={`${styles.band} ${styles.ivory}`}>
        <div className={styles.inner}>
          <Eyebrow>Why this is a strong deal</Eyebrow>
          <h2 className={styles.h2}>You bring the space and the customers. We bring everything else.</h2>
          <p className={styles.lead}>
            A 25% profit share, rising to 30% as sales grow, means you earn more when the counter does well, while Box
            Diamonds does most of the work and covers most of the cost of building the business.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Risk or cost</th>
                  <th>Own diamond counter</th>
                  <th>Box Diamonds partner</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map(([r, own, bd]) => (
                  <tr key={r}>
                    <td>{r}</td>
                    <td>{own}</td>
                    <td className={styles.hl}>{bd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.cards3}>
            {DEAL.map((d, i) => (
              <div key={d.title} className={styles.card}>
                <p className={styles.num}>{String(i + 1).padStart(2, '0')}</p>
                <h3 className={styles.h3}>{d.title}</h3>
                <p>{d.text}</p>
              </div>
            ))}
          </div>

          <div className={styles.cards2}>
            <div>
              <h3 className={styles.h3}>Return on your ₹50 Lakh</h3>
              <p className={styles.small}>Illustrative, at a 30% counter profit margin.</p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Monthly sales</th>
                      <th>Monthly share</th>
                      <th>Annual share</th>
                      <th>Annual return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exampleSales.map((s) => {
                      const share = partnerShare(s, MARGIN);
                      return (
                        <tr key={s}>
                          <td>{lakh(s)}</td>
                          <td>{inr(share)}</td>
                          <td>{inr(share * 12)}</td>
                          <td className={styles.hl}>{`${((share * 12) / INVESTMENT * 100).toFixed(1).replace(/\.0$/, '')}%`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 className={styles.h3}>Break-even path</h3>
              <p className={styles.small}>Monthly sales needed to recover ₹50 Lakh from the partner share alone, at a 30% margin.</p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Payback</th>
                      <th>Share / month</th>
                      <th>Profit / month</th>
                      <th>Sales / month</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[24, 36, 48].map((m) => {
                      const share = INVESTMENT / m;
                      const sales = salesForShare(share, MARGIN);
                      return (
                        <tr key={m}>
                          <td>{m} months</td>
                          <td>{inr(share)}</td>
                          <td>{inr(sales * MARGIN)}</td>
                          <td className={styles.hl}>{inr(sales)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className={`${styles.band} ${styles.sage}`}>
        <div className={styles.inner}>
          <Eyebrow>Roles &amp; responsibilities</Eyebrow>
          <h2 className={styles.h2}>A clear partnership</h2>
          <div className={styles.cards2}>
            <div className={styles.panel}>
              <h3 className={`${styles.h3} ${styles.gold}`}>Box Diamonds provides</h3>
              <Checklist
                items={[
                  'Certified natural diamond jewellery in 9K and 18K gold',
                  'New designs and regular stock refresh',
                  'Branded counter design and in-store branding',
                  'Marketing creatives, social media and promotions',
                  'Product knowledge and sales training for your staff',
                  'Buyback, exchange and after-sales support',
                  'Billing support, stock reconciliation and monthly profit statement',
                ]}
              />
            </div>
            <div className={styles.panel}>
              <h3 className={`${styles.h3} ${styles.gold}`}>Retail partner provides</h3>
              <Checklist
                items={[
                  '50 sq ft dedicated counter space in a jewellery store',
                  'Partner investment of ₹50 Lakh',
                  'Store staff to assist customers at the counter',
                  'Store security and safe custody of displayed jewellery',
                  'Local promotion to existing customers',
                  'Accurate sales reporting and timely settlement',
                ]}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className={`${styles.band} ${styles.ivory}`}>
        <div className={styles.inner}>
          <Eyebrow>How to become a partner</Eyebrow>
          <h2 className={styles.h2}>From enquiry to grand launch</h2>
          <ol className={styles.steps}>
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className={styles.num}>{String(i + 1).padStart(2, '0')}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section className={`${styles.band} ${styles.cream}`}>
        <div className={styles.inner}>
          <Eyebrow>FAQ</Eyebrow>
          <h2 className={styles.h2}>Frequently asked questions</h2>
          <Faq />
        </div>
      </section>

      {/* Apply */}
      <section id="apply" className={`${styles.band} ${styles.hero} ${styles.apply}`}>
        <div className={styles.inner}>
          <Eyebrow center>Partner enquiries</Eyebrow>
          <h2 className={`${styles.h2} ${styles.applyTitle}`}>
            Become a Box Diamonds <span className={styles.accent}>Retail Partner</span> today
          </h2>
          <p className={styles.applySub}>Grow together. Shine together.</p>
          <div className={styles.applyGrid}>
            <div className={styles.contacts}>
              {[
                { icon: 'phone', label: 'Call us', value: PHONE_DISPLAY, href: `tel:+${PHONE}` },
                { icon: 'whatsapp', label: 'WhatsApp', value: 'Chat with our team', href: WHATSAPP_URL },
                { icon: 'mail', label: 'Email', value: EMAIL, href: EMAIL_URL },
                { icon: 'globe', label: 'Website', value: 'www.boxdiamonds.com', href: '/' },
              ].map((c) => (
                <a
                  key={c.label}
                  href={c.href}
                  className={styles.contact}
                  {...(c.icon === 'whatsapp' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  <span className={styles.contactIcon}>{ICONS[c.icon]}</span>
                  <span>
                    <span className={styles.contactLabel}>{c.label}</span>
                    <span className={styles.contactValue}>{c.value}</span>
                  </span>
                </a>
              ))}
            </div>
            <div className={styles.applyCard}>
              <h3 className={styles.h3}>How to apply</h3>
              <p>Send us these details on WhatsApp or email and our partnership team will contact you.</p>
              <Checklist
                items={[
                  'Your full name and phone number',
                  'Store name and city',
                  'Store type: jewellery store, mall or premium retail space',
                  'Approximate store footfall and counter location',
                ]}
              />
              <div className={styles.actions}>
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={styles.btnGold}>
                  Apply on WhatsApp
                </a>
                <a href={EMAIL_URL} className={styles.btnOutline}>
                  Apply by Email
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.trust}>
        <div className={styles.inner}>
          <p className={styles.trustRow}>
            <span>Certified jewellery</span>
            <span>Trusted quality</span>
            <span>Safe &amp; secure transactions</span>
          </p>
          <p className={styles.terms}>
            Terms and conditions apply. Investment details, profit calculation and deductible costs, the ₹20 Lakh sales
            threshold, settlement cycle, tenure and exit terms will be governed by the final partnership agreement.
            Illustrative figures and calculator results are not a promise of earnings. © Box Diamonds.
          </p>
        </div>
      </section>
    </div>
  );
}
