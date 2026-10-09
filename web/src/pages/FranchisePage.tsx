import type { ReactNode } from 'react';
import { useHead } from '../seo/head';
import { breadcrumbJsonLd, organizationJsonLd } from '../seo/jsonLd';
import styles from './FranchisePage.module.css';

// Franchise Partner Programme landing page (/franchise) — ported from the
// approved standalone franchise site (copy, figures and colours unchanged),
// minus its own top menu: it sits under the normal site header and is
// linked from the footer.

const PHONE_DISPLAY = '+91 73042 94849';
const TEL = 'tel:+917304294849';

const BAND = [
  ['₹2 Cr', 'Total investment'],
  ['500 sq ft', 'Store size'],
  ['50 : 50', 'Profit sharing'],
  ['~75%', 'Of investment held as jewellery stock'],
  ['Monthly', 'Payouts by the 10th'],
];

const PROBLEM = [
  ['₹1.48 L', 'Price of 10 g of 24K gold in India on 8 October 2026.'],
  ['60%', 'Record fall in gold jewellery sales by volume in June 2025 as prices surged.'],
  ['₹1.35 L', 'Price of 10 g of 22K gold, before making charges.'],
  ['1/3+', "Share of India's jewellery sales now coming from studded (diamond and gemstone) jewellery."],
];

const OPPORTUNITY = [
  ['₹1,520 bn', "Projected size of India's natural diamond jewellery market by 2030, up from ₹785 bn in 2024 (12% CAGR)."],
  ['86%', 'Share of natural diamond market value from Gen Z (51%) and Millennials (35%).'],
  ['~11%', "India's natural diamond growth in 2025, the fastest of any country, after four straight years of double-digit growth."],
  ['15%', 'Indian women owning natural diamond jewellery in 2025, up from 11% in 2022.'],
];

const KARAT = [
  {
    tag: '9K',
    title: 'The first diamond',
    text: 'Entry-level, everyday and gifting pieces that bring new, budget-conscious buyers into real diamond jewellery.',
    rows: [
      ['Gold content', '37.5%'],
      ['BIS fineness', '375'],
      ['Best for', 'Daily wear, gifting, first purchase'],
      ['Strength', 'Very durable, scratch-resistant'],
      ['Price', 'Most affordable'],
    ],
  },
  {
    tag: '18K',
    title: 'The upgrade',
    text: 'Premium, richer-gold pieces for engagements, occasions and customers who want the classic fine-jewellery standard.',
    rows: [
      ['Gold content', '75%'],
      ['BIS fineness', '750'],
      ['Best for', 'Engagement, occasions, premium gifts'],
      ['Strength', 'Durable, richer gold colour'],
      ['Price', 'Premium, far below 22K'],
    ],
  },
];

const PRICE_LADDER = [
  ['Entry / gifting', 'Diamond studs, nose pins, mini pendants, charms', '9K', '₹3,600 - ₹10,000'],
  ['Everyday wear', 'Rings, bracelets, chains with pendant, hoops', '9K', '₹10,000 - ₹30,000'],
  ['Statement / occasions', 'Engagement rings, tennis bracelets, layered necklaces', '18K', '₹30,000 - ₹60,000'],
  ['Premium / bridal-light', 'Necklace sets, mangalsutra, couple bands', '18K', '₹60,000 - ₹99,999'],
];

const EDGE: [string, ReactNode][] = [
  ['Buys from wholesalers, pays 2-3 margin layers', <><strong>Manufactures in-house</strong>, no middle layers</>],
  ['Buys diamonds through traders', <strong>Sources natural diamonds directly</strong>],
  ['Copies designs already trending', <><strong>Creates the trends</strong> for big brands</>],
  ['Slow to refresh stock', <><strong>New designs every month</strong> from own factory</>],
  ['Unsold stock stays stuck', <><strong>Old stock re-made</strong> at the factory</>],
];

const STANDING = [
  ['Natural diamonds', 'Yes', 'No', 'Sometimes', 'Yes, 100%'],
  ['9K + 18K under one brand', 'Mostly 18K/22K, 9K pilots', 'Some', 'Rare', 'Core focus'],
  ['Ultra-lightweight Gen Z design', 'Limited', 'Yes', 'No', 'Core focus'],
  ['Entry price', 'Higher', 'Low', 'Varies', '₹3,600'],
  ['Own manufacturing', 'Partly', 'Varies', 'No', 'Yes, 14 years'],
];

const OPERATIONS = [
  ['Sales company', 'Trained store managers and sales staff, daily targets, incentives and CRM follow-ups.'],
  ['Marketing company', 'Instagram, YouTube and influencer campaigns, launch event, festive campaigns and local ads.'],
  ['Staff support', 'Recruitment, product training, grooming, replacement staff and security protocols.'],
  ['Back office', 'Design, manufacturing, stock planning, hallmarking, accounts, GST and compliance.'],
];

// [responsibility, franchise partner, Box Diamonds]
const RESPONSIBILITIES: [string, string, string][] = [
  ['Capital investment (₹2 crore)', '✓', ''],
  ['Store location approval', '✓ jointly', '✓'],
  ['Store design and setup', '', '✓'],
  ['Jewellery stock supply, refresh and quality control', '', '✓'],
  ['BIS hallmarking and natural diamond certification', '', '✓'],
  ['Staff hiring, training and management', '', '✓'],
  ['Sales and marketing', '', '✓'],
  ['Billing, accounts and GST', '', '✓'],
  ['Customer service, warranty, buyback and exchange', '', '✓'],
  ['Monthly profit statement and payout', '', '✓'],
  ['Review monthly reports', '✓', ''],
];

// [label, amount, width %, colour]
const INVESTMENT: [string, string, number, string][] = [
  ['Jewellery stock (9K & 18K + natural diamonds)', '₹150 L', 75, '#0b4a5a'],
  ['Interiors, fixtures, lighting, display', '₹18 L', 9, 'rgba(15, 93, 112, 0.7)'],
  ['Security: safe, CCTV, alarm, strong room', '₹7 L', 3.5, '#a8833e'],
  ['Rent security deposit (refundable)', '₹6 L', 3, '#c9b07a'],
  ['Launch marketing and opening event', '₹7 L', 3.5, '#d9c9a3'],
  ['Working capital (balance refundable)', '₹7 L', 3.5, '#8fb3ba'],
  ['Brand onboarding, training, systems', '₹5 L', 2.5, '#c7d9dc'],
];

const SCENARIOS = [
  { k: 'Conservative · ₹25 L sales / month', v: '₹2.68 L', rows: [['Per year', '₹32.1 L'], ['Annual return', '~16%'], ['Payback', '~6.2 years'], ['Bills needed', '~4 / day']] },
  { k: 'Base · ₹35 L sales / month', v: '₹4.46 L', base: true, rows: [['Per year', '₹53.6 L'], ['Annual return', '~27%'], ['Payback', '~3.7 years'], ['Bills needed', '~5-6 / day']] },
  { k: 'Optimistic · ₹50 L sales / month', v: '₹7.15 L', rows: [['Per year', '₹85.8 L'], ['Annual return', '~43%'], ['Payback', '~2.3 years'], ['Bills needed', '~8 / day']] },
];

const FIVE_YEAR = [
  ['1', '₹3.15 Cr', '₹1.26 Cr', '₹0.56 Cr', '₹0.70 Cr', '₹34.8 L', '₹34.8 L'],
  ['2', '₹4.20 Cr', '₹1.68 Cr', '₹0.63 Cr', '₹1.05 Cr', '₹52.5 L', '₹87.3 L'],
  ['3', '₹4.62 Cr', '₹1.85 Cr', '₹0.67 Cr', '₹1.18 Cr', '₹58.9 L', '₹1.46 Cr'],
  ['4', '₹5.08 Cr', '₹2.03 Cr', '₹0.71 Cr', '₹1.32 Cr', '₹66.0 L', '₹2.12 Cr'],
  ['5', '₹5.59 Cr', '₹2.23 Cr', '₹0.76 Cr', '₹1.47 Cr', '₹73.7 L', '₹2.86 Cr'],
];

const PEACE = [
  ['Asset-backed', 'About 75% of your capital is physical gold and natural diamond stock, insured and recorded in your name.'],
  ['Verifiable value', 'Every piece carries a BIS hallmark with HUID and a natural diamond certificate.'],
  ['Fully insured', 'Stock insured against theft, fire and burglary, in-store and in-transit.'],
  ['Expert operations', 'Run by a company with 14 years in jewellery. No learning curve for you.'],
  ['Transparent reporting', 'Monthly sales, stock and profit statements, live dashboard and annual audit.'],
  ['Monthly payouts', 'Your profit share is credited by the 10th of every month.'],
  ['No dead stock', 'Slow-moving designs go back to the factory and return as new trends.'],
  ['Defined exit', 'Stock buyback at prevailing value plus refundable deposits after lock-in.'],
];

const PROMISES = [
  ['Lifetime warranty:', 'free lifetime service on manufacturing defects, plus cleaning, polishing and check-ups.'],
  ['Lifetime exchange:', 'exchange any Box Diamonds piece at prevailing gold and diamond value toward a new design.'],
  ['Buyback:', 'gold and natural diamond value at prevailing rates, as per the published buyback policy.'],
  ['BIS hallmark with HUID:', 'government-verified gold purity on every piece.'],
  ['Natural diamond certificate:', 'proof that every diamond is real and natural.'],
  ['Upgrade programme:', 'start at ₹3,600 in 9K and move up to 18K over time.'],
];

const STORE = [
  ['Size', '~500 sq ft carpet area'],
  ['Frontage', '15-18 ft preferred'],
  ['Location', 'High street, mall, premium market, near colleges, offices and cafés'],
  ['Cities', 'Tier 1 and Tier 2 to start; Tier 3 later'],
  ['Neighbourhood', 'Strong Gen Z and young-professional footfall'],
  ['Store look', 'Modern, bright, Instagram-friendly, try-on mirrors, selfie wall'],
];

const STEPS = [
  ['Meet & present', 'Week 1'],
  ['Letter of intent', 'Week 2 · ₹10 L token'],
  ['Location approval', 'Weeks 2-6'],
  ['Agreement signed', 'Week 6'],
  ['Interiors & fit-out', 'Weeks 7-12'],
  ['Staff hiring & training', 'Weeks 9-12'],
  ['Stock, hallmarking & certification', 'Weeks 7-12'],
  ['Pre-launch marketing', 'Weeks 10-12'],
  ['Grand opening', 'Weeks 12-14'],
  ['First payout', 'Month after opening'],
];

const TERMS: { title: string; open?: boolean; rows: [string, string][] }[] = [
  {
    title: 'Commercial terms',
    open: true,
    rows: [
      ['Franchise model', 'FOCO - Franchise Owned, Company Operated'],
      ['Total investment', '₹2,00,00,000 (₹2 crore)'],
      ['Booking / token amount', '₹10 lakh at signing of the Letter of Intent, fully adjusted against the total investment'],
      ['Balance payment', 'At signing of the franchise agreement, before store fit-out begins'],
      ['Franchise fee / royalty', 'No separate royalty; Box Diamonds earns only through its 50% profit share'],
      ['Profit sharing', '50% Franchise Partner : 50% Box Diamonds of monthly store operating profit (net sales excluding GST, less cost of jewellery sold, less store operating costs)'],
      ['Payout', 'Monthly, credited by the 10th of the following month, with a monthly profit statement'],
      ['Store operating costs', 'Rent, staff salaries, utilities, insurance, local marketing (3% of sales), payment charges and store maintenance, all paid from store revenue before profit sharing'],
      ['Brand-level marketing', 'Paid by Box Diamonds (national digital, influencer and brand campaigns)'],
    ],
  },
  {
    title: 'Ownership and stock',
    rows: [
      ['Stock ownership', 'Jewellery stock of ₹1.5 crore owned by the Franchise Partner, recorded item-wise with HUID and diamond certificate numbers'],
      ['Stock replenishment', 'Every piece sold is replaced from the Box Diamonds factory so stock value stays at ₹1.5 crore'],
      ['Stock refresh', 'Designs unsold for 6 months are exchanged for new designs at no cost to the partner'],
      ['Stock audit', 'Physical audit every quarter; independent annual audit, with the partner free to attend'],
      ['Insurance', 'Full stock and store insurance (in-store and in-transit), with the Franchise Partner as beneficiary for the stock'],
      ['Fixed assets', 'Interiors, fixtures and security equipment owned by the Franchise Partner'],
    ],
  },
  {
    title: 'Tenure, territory and exit',
    rows: [
      ['Agreement tenure', '5 years from store opening'],
      ['Renewal', 'Renewable for another 5 years on mutual consent, with no renewal fee'],
      ['Lock-in period', '36 months from store opening'],
      ['Exclusive territory', 'No other Box Diamonds store within 3 km (metro cities) or 5 km (other cities)'],
      ['Exit after lock-in', "Either party may exit with 6 months' written notice"],
      ['Stock on exit', 'Box Diamonds buys back all remaining stock at the prevailing gold rate and diamond value on the exit date, paid within 60 days'],
      ['Fixed assets on exit', 'Refunded at book value after 20% depreciation per year'],
      ['Deposits on exit', 'Rent security deposit and remaining working capital returned in full'],
      ['Exit before lock-in', 'Only in special cases by mutual agreement; stock buyback applies, fixed-asset refund may be reduced'],
    ],
  },
  {
    title: 'Reporting and governance',
    rows: [
      ['Monthly reports', 'Sales report, stock statement and profit & loss statement'],
      ['Live dashboard', 'Online access to daily sales and stock data'],
      ['Partner review', 'Quarterly meeting with the Box Diamonds management team'],
      ['Store opening', '12-14 weeks from signing of the franchise agreement'],
    ],
  },
];

const RISKS = [
  ['Gold price volatility', 'Stock value moves with gold; 9K and ultra-lightweight 18K designs use less gold per piece, keeping prices affordable; daily rate-linked pricing'],
  ['Natural diamond price decline', "Global prices have fallen amid lab-grown competition. Small diamonds are a small share of each piece's cost, direct sourcing lowers input cost, and India demand remains strong"],
  ['Lab-grown competition', 'Clear positioning on 100% natural diamonds, certification and long-term value'],
  ['Slow early months', 'Launch marketing, online-to-store leads and influencer campaigns; Year 1 modelled at 75%'],
  ['Theft / burglary', 'Insurance, safes, CCTV, alarm, trained staff and security protocols'],
  ['Dead stock', 'Factory refresh and re-make programme'],
  ['Rent increase', 'Long lease with fixed escalation'],
];

function Eyebrow({ children }: { children: ReactNode }) {
  return <span className={styles.eyebrow}>{children}</span>;
}

function Ticks({ items }: { items: ReactNode[] }) {
  return (
    <ul className={styles.ticks}>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function StatCard({ big, text }: { big: string; text: string }) {
  return (
    <div className={styles.card}>
      <div className={styles.big}>{big}</div>
      <p>{text}</p>
    </div>
  );
}

export function FranchisePage() {
  useHead({
    title: 'Box Diamonds Franchise | 9K & 18K Natural Diamond Jewellery Franchise Opportunity',
    description:
      'Become a Box Diamonds franchise partner. Ultra-lightweight 9K and 18K BIS-hallmarked gold jewellery with certified natural diamonds. ₹2 crore investment, company-operated store, 50:50 profit sharing, monthly payouts.',
    canonicalPath: '/franchise',
    jsonLd: [organizationJsonLd(), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Franchise', path: '/franchise' }])],
  });

  return (
    <div className={styles.page}>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={`${styles.wrap} ${styles.heroGrid}`}>
          <div>
            <Eyebrow>Franchise Partner Programme</Eyebrow>
            <h1 className={styles.heroTitle}>
              Invest in real gold &amp; <em>natural diamonds</em>. We run the store.
            </h1>
            <p className={styles.lead}>
              Box Diamonds is India&apos;s first ultra-lightweight 9K &amp; 18K gold natural diamond jewellery brand for Gen Z.
              Become a franchise partner in a company-operated store and earn a monthly share of profit.
            </p>
            <div className={styles.ctas}>
              <a className={styles.btnPrimary} href={TEL}>
                Talk to our franchise team
              </a>
              <a className={styles.btnGhost} href="#returns">
                See projected returns
              </a>
            </div>
            <div className={styles.chips}>
              {['BIS hallmarked 9K & 18K', '100% certified natural diamonds', '14 years as a manufacturer', '₹3,600 to under ₹1 lakh'].map(
                (c) => (
                  <span key={c} className={styles.chip}>
                    {c}
                  </span>
                ),
              )}
            </div>
          </div>
          <div className={styles.heroImg}>
            <img
              src="/images/franchise/hero.webp"
              alt="Delicate gold chain with natural diamond pendant, diamond band ring and diamond stud earrings on ivory silk"
              width={1024}
              height={1536}
              fetchPriority="high"
            />
          </div>
        </div>
      </section>

      {/* Key numbers */}
      <div className={styles.band}>
        <div className={`${styles.wrap} ${styles.bandGrid}`}>
          {BAND.map(([n, l]) => (
            <div key={l}>
              <div className={styles.bandNum}>{n}</div>
              <div className={styles.bandLbl}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Problem */}
      <section id="opportunity" className={`${styles.section} ${styles.alt}`}>
        <div className={`${styles.wrap} ${styles.g2}`}>
          <div>
            <Eyebrow>The problem</Eyebrow>
            <h2 className={styles.h2}>Indians love gold. But gold has left the common buyer.</h2>
            <p className={styles.lead}>
              For weddings, festivals and every celebration, the Indian mind goes first to gold. At today&apos;s prices, most
              young buyers simply cannot afford traditional heavy jewellery.
            </p>
          </div>
          <div className={`${styles.g2} ${styles.tight}`}>
            {PROBLEM.map(([b, t]) => (
              <StatCard key={b} big={b} text={t} />
            ))}
          </div>
        </div>
      </section>

      {/* Opportunity */}
      <section className={styles.section}>
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <Eyebrow>The opportunity</Eyebrow>
            <h2 className={styles.h2}>9K &amp; 18K gold + natural diamonds + Gen Z</h2>
            <p className={styles.lead}>
              India is now the world&apos;s second-largest diamond jewellery market, and young buyers drive it.
            </p>
          </div>
          <div className={styles.g4}>
            {OPPORTUNITY.map(([b, t]) => (
              <StatCard key={b} big={b} text={t} />
            ))}
          </div>

          <div className={`${styles.g2} ${styles.mediaRow}`}>
            <div className={styles.storeImg}>
              <img
                src="/images/franchise/store.webp"
                alt="Young woman trying on a delicate gold ring with a natural diamond in a modern jewellery store"
                width={1024}
                height={1536}
                loading="lazy"
                decoding="async"
              />
            </div>
            <div>
              <Eyebrow>Young India is driving the change</Eyebrow>
              <h2 className={`${styles.h2} ${styles.h2Small}`}>Jewellery to wear every day, not lock away</h2>
              <Ticks
                items={[
                  'Gen Z and urban professionals are increasingly choosing lower-karat gold for daily wear.',
                  '58% of 20-25-year-olds chose diamonds, second only to gold, in a Deloitte study.',
                  'Natural diamonds are moving from "locker luxury" to everyday wear, with more women buying for themselves.',
                  'About 80% of wedding jewellery enquiries in Ahmedabad are now for lightweight designer pieces.',
                  'Titan grew studded jewellery 35% in FY2025-26; Kalyan grew it 36% in Q1 FY2027.',
                ]}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 9K vs 18K */}
      <section id="product" className={`${styles.section} ${styles.tint}`}>
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <Eyebrow>Two collections, one design language</Eyebrow>
            <h2 className={styles.h2}>9K and 18K: two trusted, hallmarked price levels</h2>
            <p className={styles.lead}>
              9K gold was brought under BIS hallmarking in July 2025, alongside 14K, 18K, 22K and 24K. Every piece carries the BIS
              logo, purity mark and a unique HUID code.
            </p>
          </div>
          <div className={styles.karat}>
            {KARAT.map((k) => (
              <div key={k.tag} className={styles.card}>
                <div className={styles.karatTag}>{k.tag}</div>
                <h3 className={styles.h3}>{k.title}</h3>
                <p>{k.text}</p>
                <dl>
                  {k.rows.map(([dt, dd]) => (
                    <div key={dt}>
                      <dt>{dt}</dt>
                      <dd>{dd}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
          <p className={styles.cite}>
            18K gold was about ₹11,073 per gram vs ₹14,765 for 24K on 8 October 2026. Indicative store mix: about 60% 9K and 40%
            18K by value, adjusted per city.
          </p>

          <div className={styles.block}>
            <h3 className={styles.h3}>Price ladder: ₹3,600 to under ₹1,00,000</h3>
            <div className={styles.tbl}>
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Example products</th>
                    <th>Lead collection</th>
                    <th>Indicative price</th>
                  </tr>
                </thead>
                <tbody>
                  {PRICE_LADDER.map(([c, e, l, p]) => (
                    <tr key={c}>
                      <td>
                        <strong>{c}</strong>
                      </td>
                      <td>{e}</td>
                      <td>{l}</td>
                      <td>{p}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Why Box Diamonds */}
      <section className={`${styles.section} ${styles.alt}`}>
        <div className={styles.wrap}>
          <div className={styles.g2}>
            <div>
              <Eyebrow>Why Box Diamonds</Eyebrow>
              <h2 className={styles.h2}>A manufacturer&apos;s prices. A brand&apos;s design.</h2>
              <p className={`${styles.lead} ${styles.spaced}`}>
                For 14 years we have manufactured jewellery and created trending designs for big brands. Now we bring that
                directly to customers, online and in stores.
              </p>
              <p className={styles.pull}>
                Real natural diamonds + BIS-hallmarked 9K &amp; 18K gold + ultra-lightweight design, from ₹3,600.
              </p>
            </div>
            <div>
              <div className={styles.tbl}>
                <table>
                  <thead>
                    <tr>
                      <th>Traditional retailer</th>
                      <th className={styles.hl}>Box Diamonds</th>
                    </tr>
                  </thead>
                  <tbody>
                    {EDGE.map(([t, b]) => (
                      <tr key={t}>
                        <td>{t}</td>
                        <td className={styles.hl}>{b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={styles.note}>
                India has a strong tradition of buying jewellery in person. Customers want to touch, try and check before buying.
                Online builds awareness; the store closes the sale and builds lifelong trust.
              </p>
            </div>
          </div>

          <div className={styles.block}>
            <h3 className={styles.h3}>Where we stand</h3>
            <p className={styles.note}>
              Titan has piloted 9K at Mia and CaratLane, and lab-grown brands are expanding fast. No brand yet owns natural
              diamonds in ultra-lightweight 9K and 18K for Gen Z.
            </p>
            <div className={styles.tbl}>
              <table>
                <thead>
                  <tr>
                    <th aria-label="Feature" />
                    <th>Big brands</th>
                    <th>Lab-grown brands</th>
                    <th>Local jewellers</th>
                    <th className={styles.hl}>Box Diamonds</th>
                  </tr>
                </thead>
                <tbody>
                  {STANDING.map(([f, a, b, c, d]) => (
                    <tr key={f}>
                      <td>
                        <strong>{f}</strong>
                      </td>
                      <td>{a}</td>
                      <td>{b}</td>
                      <td>{c}</td>
                      <td className={`${styles.hl} ${styles.check}`}>{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* FOCO model */}
      <section id="model" className={styles.section}>
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <Eyebrow>Franchise Owned, Company Operated (FOCO)</Eyebrow>
            <h2 className={styles.h2}>You invest. We run the store. You earn every month.</h2>
            <p className={styles.lead}>
              You own the store&apos;s jewellery stock and assets. Box Diamonds handles everything day to day. No jewellery
              experience or daily involvement needed.
            </p>
          </div>
          <div className={`${styles.g4} ${styles.gapBelow}`}>
            {OPERATIONS.map(([t, d]) => (
              <div key={t} className={styles.card}>
                <h3 className={styles.h3}>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
          <div className={styles.tbl}>
            <table>
              <thead>
                <tr>
                  <th>Responsibility</th>
                  <th>Franchise Partner</th>
                  <th>Box Diamonds</th>
                </tr>
              </thead>
              <tbody>
                {RESPONSIBILITIES.map(([r, p, b]) => (
                  <tr key={r}>
                    <td>{r}</td>
                    <td className={styles.check}>{p}</td>
                    <td className={styles.check}>{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Investment */}
      <section className={`${styles.section} ${styles.alt}`}>
        <div className={`${styles.wrap} ${styles.g2}`}>
          <div>
            <Eyebrow>Where your ₹2 crore goes</Eyebrow>
            <h2 className={styles.h2}>About 75% stays in real gold and diamonds</h2>
            <p className={styles.lead}>
              ₹1.5 crore sits in physical, hallmarked and certified jewellery stock, not in a fee you never see again.
            </p>
            <div className={styles.stack} aria-hidden="true">
              {INVESTMENT.map(([l, , w, c]) => (
                <span key={l} style={{ width: `${w}%`, background: c }} />
              ))}
            </div>
            <p className={styles.cite}>
              Total investment is fixed at ₹2 crore. Rent deposit and interiors vary slightly by city; any difference is adjusted
              within working capital.
            </p>
          </div>
          <div className={styles.legend}>
            {INVESTMENT.map(([l, a, , c]) => (
              <div key={l}>
                <span>
                  <i style={{ background: c }} />
                  {l}
                </span>
                <b>{a}</b>
              </div>
            ))}
            <div className={styles.legendTotal}>
              <span>Total</span>
              <b>₹200 L</b>
            </div>
          </div>
        </div>
      </section>

      {/* Returns */}
      <section id="returns" className={styles.section}>
        <div className={styles.wrap}>
          <div className={`${styles.g2} ${styles.gapBelowLg}`}>
            <div>
              <Eyebrow>How the 50:50 works</Eyebrow>
              <h2 className={styles.h2}>A simple, transparent profit share</h2>
              <p className={styles.lead}>
                Box Diamonds&apos; manufacturing margin is built into the stock price. The 50:50 split is on store operating profit,
                with no separate royalty.
              </p>
            </div>
            <div className={styles.flow}>
              <div>
                <span>Monthly net sales (excluding GST)</span>
                <b>₹35.0 L</b>
              </div>
              <div className={styles.minus}>
                <span>− Cost of jewellery sold (60%)</span>
                <b>₹21.0 L</b>
              </div>
              <div>
                <span>= Gross profit (40%)</span>
                <b>₹14.0 L</b>
              </div>
              <div className={styles.minus}>
                <span>− Store operating costs</span>
                <b>₹5.07 L</b>
              </div>
              <div className={styles.res}>
                <span>= Store operating profit</span>
                <b>₹8.93 L</b>
              </div>
              <div className={styles.split}>
                <div>Partner 50% · ₹4.46 L</div>
                <div>Box Diamonds 50% · ₹4.46 L</div>
              </div>
              <p className={styles.cite}>Base-case example for one month at steady state.</p>
            </div>
          </div>

          <div className={styles.sectionHead}>
            <Eyebrow>Projected returns at steady state</Eyebrow>
            <h2 className={styles.h2}>Three scenarios</h2>
          </div>
          <div className={styles.scen}>
            {SCENARIOS.map((s) => (
              <div key={s.k} className={`${styles.card} ${s.base ? styles.base : ''}`}>
                {s.base && <span className={styles.badge}>BASE CASE</span>}
                <div className={styles.scenK}>{s.k}</div>
                <div className={styles.scenV}>
                  {s.v}
                  <span> / month</span>
                </div>
                <ul>
                  {s.rows.map(([a, b]) => (
                    <li key={a}>
                      {a}
                      <b>{b}</b>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className={styles.cite}>
            Assumptions: 40% store gross margin; rent ₹1.25 L/month (500 sq ft @ ₹250); 4 staff ₹1.60 L/month; utilities ₹0.35 L;
            insurance ₹0.10 L; software, security and misc ₹0.30 L; local marketing 3% of sales; payment charges 1.2%; average bill
            ~₹22,000.
          </p>

          <div className={styles.block}>
            <h3 className={styles.h3}>Five-year projection (base case)</h3>
            <p className={styles.note}>Year 1 at 75% of steady-state sales, 10% growth a year from Year 3, fixed costs up 5% a year.</p>
            <div className={styles.tbl}>
              <table className={styles.numR}>
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Annual sales</th>
                    <th>Gross profit</th>
                    <th>Operating costs</th>
                    <th>Operating profit</th>
                    <th>Partner&apos;s 50%</th>
                    <th className={styles.hl}>Cumulative to partner</th>
                  </tr>
                </thead>
                <tbody>
                  {FIVE_YEAR.map((r, i) => (
                    <tr key={r[0]}>
                      {r.slice(0, 6).map((c, j) => (
                        <td key={j}>{c}</td>
                      ))}
                      <td className={styles.hl}>{i === FIVE_YEAR.length - 1 ? <strong>{r[6]}</strong> : r[6]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={styles.conclusion}>
              In the base case, the partner recovers the full ₹2 crore by Year 4 and receives about ₹2.86 crore over 5 years, while
              still owning ₹1.5 crore of jewellery stock.
            </p>
          </div>
        </div>
      </section>

      {/* Peace of mind + promises */}
      <section className={`${styles.section} ${styles.tint}`}>
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <Eyebrow>Peace of mind</Eyebrow>
            <h2 className={styles.h2}>Why you can sleep peacefully</h2>
          </div>
          <div className={styles.g4}>
            {PEACE.map(([t, d]) => (
              <div key={t} className={styles.card}>
                <h3 className={styles.h3}>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>

          <div className={`${styles.g2} ${styles.mediaRow}`}>
            <div>
              <Eyebrow>Customer promises</Eyebrow>
              <h2 className={`${styles.h2} ${styles.h2Small}`}>What brings customers back again and again</h2>
              <p className={styles.lead}>These promises turn a first-time Gen Z buyer into a lifelong customer.</p>
            </div>
            <Ticks
              items={PROMISES.map(([b, t]) => (
                <>
                  <strong>{b}</strong> {t}
                </>
              ))}
            />
          </div>
        </div>
      </section>

      {/* Store format + timeline */}
      <section className={`${styles.section} ${styles.alt}`}>
        <div className={styles.wrap}>
          <div className={`${styles.g2} ${styles.gapBelowLg}`}>
            <div>
              <Eyebrow>Store format</Eyebrow>
              <h2 className={styles.h2}>500 sq ft where young India shops</h2>
              <p className={styles.lead}>
                Tier 2 and Tier 3 cities are growing as diamond markets, with Tier 1 at 41% of the consumer base.
              </p>
            </div>
            <div className={styles.tbl}>
              <table className={styles.kv}>
                <tbody>
                  {STORE.map(([k, v]) => (
                    <tr key={k}>
                      <td>
                        <strong>{k}</strong>
                      </td>
                      <td>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.sectionHead}>
            <Eyebrow>From first call to grand opening</Eyebrow>
            <h2 className={styles.h2}>12-14 weeks to open</h2>
          </div>
          <ol className={styles.steps}>
            {STEPS.map(([t, w], i) => (
              <li key={t}>
                <span className={styles.stepNum}>{String(i + 1).padStart(2, '0')}</span>
                <b>{t}</b>
                <span>{w}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Terms */}
      <section id="terms" className={styles.section}>
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <Eyebrow>Franchise terms</Eyebrow>
            <h2 className={styles.h2}>Clear terms, in writing</h2>
            <p className={styles.lead}>
              A summary of the main terms. The signed franchise agreement is the final and binding document.
            </p>
          </div>
          {TERMS.map((t) => (
            <details key={t.title} className={styles.details} open={t.open}>
              <summary>{t.title}</summary>
              <div className={styles.tbl}>
                <table className={styles.kv}>
                  <tbody>
                    {t.rows.map(([k, v]) => (
                      <tr key={k}>
                        <td>{k}</td>
                        <td>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}

          <div className={styles.block}>
            <h3 className={styles.h3}>Risks and how we manage them</h3>
            <div className={styles.tbl}>
              <table>
                <thead>
                  <tr>
                    <th>Risk</th>
                    <th>How we manage it</th>
                  </tr>
                </thead>
                <tbody>
                  {RISKS.map(([r, m]) => (
                    <tr key={r}>
                      <td>
                        <strong>{r}</strong>
                      </td>
                      <td>{m}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className={styles.cta}>
        <div className={styles.wrap}>
          <img src="/images/logo-white.png" alt="Box Diamonds" className={styles.ctaLogo} width={413} height={249} loading="lazy" />
          <h2 className={styles.h2}>Become a Box Diamonds franchise partner</h2>
          <p>
            Meet our team, visit our manufacturing unit, see the collection and reserve your territory. Be among the first partners
            in your city.
          </p>
          <a className={styles.phone} href={TEL}>
            {PHONE_DISPLAY}
          </a>
          <div className={`${styles.ctas} ${styles.ctasCenter}`}>
            <a className={styles.btnGold} href={TEL}>
              Call now
            </a>
            <a className={styles.btnGhostLight} href="/">
              www.boxdiamonds.com
            </a>
          </div>
        </div>
      </section>

      <div className={styles.disclaimer}>
        <div className={styles.wrap}>
          <h4>Important disclaimer</h4>
          <p>
            The financial projections on this page are estimates based on stated assumptions and industry benchmarks. They are not
            guaranteed returns. Actual results depend on location, market conditions, gold and diamond prices, and store
            performance. Investors should review the franchise agreement with their own legal and financial advisors before
            investing.
          </p>
        </div>
      </div>

      <a className={`${styles.btnPrimary} ${styles.mobileCall}`} href={TEL}>
        Call {PHONE_DISPLAY}
      </a>
    </div>
  );
}
