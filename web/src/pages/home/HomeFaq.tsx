import { Link } from 'react-router-dom';
import styles from './HomeFaq.module.css';

// Static, homepage-only "about + FAQ" block (like AssuranceStrip, not a
// homepage_sections row). It gives search engines and AI assistants real,
// quotable text about the brand — the rest of the homepage is mostly
// images. Every answer restates what the policy pages already say; when a
// policy changes, update the matching answer here too. HomePage.tsx feeds
// these same items into FAQPage JSON-LD, so the markup always matches the
// visible text.
export const HOME_FAQ: { question: string; answer: string; link?: { label: string; to: string } }[] = [
  {
    question: 'What gold is 9KARET jewellery made in?',
    answer:
      'Every 9KARET piece is made in BIS-hallmarked 9K gold (37.5% pure gold), in yellow, rose or white gold depending on the design. 9K gold is harder-wearing than higher karats, which makes it ideal for jewellery you wear every day.',
  },
  {
    question: 'What stones are used, and how are they priced?',
    answer:
      'Our pieces are set with genuine gemstones such as ruby, emerald and sapphire, along with cubic zirconia in some designs. Each product page lists every stone with its count and weight, and the price breakup shows the gemstone value separately from the gold value, making charge and GST.',
  },
  {
    question: 'How is the price calculated?',
    answer:
      'The price is the gold value at the live 9K gold rate, plus the gemstone value, plus the making charge, plus 3% GST. The full breakup is shown on every product page, so you always know what you are paying for.',
  },
  {
    question: 'Do you deliver across India, and is shipping free?',
    answer:
      'Yes. We deliver to serviceable PIN codes across India through insured, tracked logistics partners, and shipping is free unless a delivery charge is shown at checkout. Most pieces are made to order, which usually takes 4–5 days, followed by 3–4 days in transit. The estimate for your PIN code is shown on each product page.',
    link: { label: 'Shipping Policy', to: '/shipping-policy' },
  },
  {
    question: 'Can I return jewellery bought from 9KARET?',
    answer:
      'Eligible products can be returned within seven calendar days of delivery, with free return pickup across India. Raise the request from My Account. Custom and engraved pieces are not returnable. Refunds are processed after a quality inspection.',
    link: { label: 'Return & Refund Policy', to: '/refund-policy' },
  },
  {
    question: 'Does 9KARET offer buyback and exchange?',
    answer:
      'Yes. Eligible 9KARET jewellery is covered by exchange and buyback benefits, subject to the conditions shown before you complete your purchase.',
  },
  {
    question: 'How can I contact 9KARET?',
    answer:
      'Email info@9karet.com or use the contact form on our Contact page. 9KARET is operated by Goldbox Diamonds Private Limited, registered at No 281/287, 39 1-3, Narsi Natha Street, Princess Dock, Mumbai – 400009, Maharashtra.',
    link: { label: 'Contact Us', to: '/contact' },
  },
];

export function HomeFaq() {
  return (
    <section className={styles.wrap} aria-labelledby="home-about-heading">
      <div className={styles.about}>
        <h2 id="home-about-heading" className={styles.heading}>
          About 9KARET
        </h2>
        <p>
          9KARET is an Indian jewellery brand that sells 9K gold jewellery online at 9karet.com, with delivery across
          India. It is operated by Goldbox Diamonds Private Limited, Mumbai.
        </p>
        <p>
          Our rings, earrings, necklaces, pendants and bracelets are made in BIS-hallmarked 9K gold and set with
          genuine gemstones. 9K gold keeps real gold jewellery affordable and durable — smart gold you can wear every
          day — and our pricing is transparent, with the gold, gemstone and making charges shown separately.
        </p>
      </div>

      <div className={styles.faq}>
        <h2 className={styles.heading}>Frequently Asked Questions</h2>
        <div className={styles.list}>
          {HOME_FAQ.map((item) => (
            <div key={item.question} className={styles.item}>
              <h3 className={styles.question}>{item.question}</h3>
              <p className={styles.answer}>{item.answer}</p>
              {item.link && (
                <Link to={item.link.to} className={styles.more}>
                  {item.link.label} →
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
