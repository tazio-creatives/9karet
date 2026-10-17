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
    question: 'Are BOX DIAMONDS diamonds natural and certified?',
    answer:
      'Yes. BOX DIAMONDS uses natural diamonds, certified by IGI or GIA. The certificate is supplied with your jewellery, along with the invoice.',
    link: { label: 'Why BOX DIAMONDS', to: '/why-box-diamonds' },
  },
  {
    question: 'What gold purity is BOX DIAMONDS jewellery made in?',
    answer:
      'Our jewellery is made in BIS-hallmarked 9K and 18K gold, in yellow, rose or white gold depending on the design. 18K gold offers a traditional richness, while 9K gold keeps real diamond jewellery more affordable and durable for everyday wear.',
  },
  {
    question: 'Do you deliver across India, and is shipping free?',
    answer:
      'Yes. We deliver to serviceable PIN codes across India through insured, tracked logistics partners, and shipping is free unless a delivery charge is shown at checkout. Most pieces are made to order, which usually takes 4–5 days, followed by 3–4 days in transit. The estimate for your PIN code is shown on each product page.',
    link: { label: 'Shipping Policy', to: '/shipping-policy' },
  },
  {
    question: 'Can I return jewellery bought from BOX DIAMONDS?',
    answer:
      'Eligible products can be returned within seven calendar days of delivery, with free return pickup across India. Raise the request from My Account. Solitaire jewellery, loose diamonds and engraved pieces are not returnable. Refunds are processed after a quality inspection.',
    link: { label: 'Return & Refund Policy', to: '/refund-policy' },
  },
  {
    question: 'Does BOX DIAMONDS offer buyback and exchange?',
    answer:
      'Yes. Eligible BOX DIAMONDS jewellery is covered by exchange and buyback benefits, subject to the conditions shown before you complete your purchase.',
  },
  {
    question: 'How can I contact BOX DIAMONDS?',
    answer:
      'Email info@boxdiamonds.com or use the contact form on our Contact page. BOX DIAMONDS is operated by Goldbox Diamonds Private Limited, registered at No 281/287, 39 1-3, Narsi Natha Street, Princess Dock, Mumbai – 400009, Maharashtra.',
    link: { label: 'Contact Us', to: '/contact' },
  },
];

export function HomeFaq() {
  return (
    <section className={styles.wrap} aria-labelledby="home-about-heading">
      <div className={styles.about}>
        <h2 id="home-about-heading" className={styles.heading}>
          About BOX DIAMONDS
        </h2>
        <p>
          BOX DIAMONDS is an Indian fine jewellery brand that sells certified natural diamond jewellery online at
          boxdiamonds.com, with delivery across India. It is operated by Goldbox Diamonds Private Limited, Mumbai.
        </p>
        <p>
          Our rings, earrings, necklaces, pendants, bangles and bracelets are crafted by our own artisans in
          BIS-hallmarked 9K and 18K gold and set with IGI- or GIA-certified natural diamonds. We keep the designs
          lightweight and the pricing transparent, so real diamond jewellery is something you can wear every day, not
          only on special occasions.
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
