import { PolicyDocLayout, type PolicySection } from './PolicyDocLayout';
import { PolicyContact } from './PolicyContact';

const SECTIONS: PolicySection[] = [
  {
    id: 'eligibility',
    title: 'Eligibility',
    icon: 'user',
    content: (
      <p>
        You must be at least 18 years old, or place orders under the supervision of a parent or legal guardian, to use
        this Website and purchase products from us.
      </p>
    ),
  },
  {
    id: 'account-registration',
    title: 'Account Registration',
    icon: 'lock',
    content: (
      <p>
        Some features require an account, created via mobile number/OTP verification. You are responsible for all
        activity under your account and for keeping your login details secure. Please notify us immediately of any
        unauthorised use.
      </p>
    ),
  },
  {
    id: 'products-pricing',
    title: 'Products, Pricing & Availability',
    icon: 'gem',
    content: (
      <ul>
        <li>
          We aim to display accurate product images, descriptions, weights and prices, but slight variations (e.g.
          natural gemstone characteristics, minor metal-weight tolerances) may occur.
        </li>
        <li>
          Prices are subject to change, including due to gold rate fluctuations, without prior notice — the
          price shown at the time your order is placed and confirmed will apply to that order.
        </li>
        <li>Products are subject to availability. We reserve the right to limit quantities or discontinue any product.</li>
        <li>
          In the event of a pricing or listing error, we may cancel the affected order and refund any amount paid, per
          our <a href="/refund-policy#cancellation">Return and Refund Policy</a>.
        </li>
      </ul>
    ),
  },
  {
    id: 'orders-payment',
    title: 'Orders & Payment',
    icon: 'card',
    content: (
      <ul>
        <li>Placing an order is an offer to purchase; an order is confirmed only once payment is successfully verified.</li>
        <li>We accept payment through the methods displayed at checkout, processed via our payment gateway partner(s).</li>
        <li>
          We reserve the right to refuse or cancel any order, including for suspected fraud, pricing errors, or
          unavailability, in which case any amount paid will be refunded.
        </li>
      </ul>
    ),
  },
  {
    id: 'shipping-returns',
    title: 'Shipping, Returns & Cancellations',
    icon: 'truck',
    content: (
      <p>
        Delivery timelines and shipping terms are set out in our <a href="/shipping-policy">Shipping Policy</a>.
        Return, refund and order cancellation terms are set out in our{' '}
        <a href="/refund-policy">Return and Refund Policy</a>. These policies form part of these Terms.
      </p>
    ),
  },
  {
    id: 'intellectual-property',
    title: 'Intellectual Property',
    icon: 'copyright',
    content: (
      <p>
        All content on the Website — including text, graphics, logos, product images, and design — is owned by or
        licensed to 9Karet and protected by applicable intellectual property laws. You may not copy, reproduce,
        distribute or create derivative works from this content without our prior written consent.
      </p>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable Use',
    icon: 'ban',
    content: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Website for any unlawful purpose or in violation of these Terms.</li>
          <li>Attempt to gain unauthorised access to the Website, our systems or other users’ accounts.</li>
          <li>Upload or transmit viruses, malicious code, or content that is unlawful, defamatory or infringing.</li>
          <li>Scrape, copy or resell product listings, prices or content without authorisation.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'product-disclaimer',
    title: 'Product Disclaimer',
    icon: 'search',
    content: (
      <p>
        Jewellery images are for illustrative purposes; actual product colour may vary slightly due to photography,
        lighting and display settings. Gemstone certification, where provided, is issued by independent certification
        bodies and reflects their assessment at the time of certification.
      </p>
    ),
  },
  {
    id: 'limitation-of-liability',
    title: 'Limitation of Liability',
    icon: 'alert',
    content: (
      <p>
        To the extent permitted by applicable law, 9Karet shall not be liable for any indirect, incidental or
        consequential damages arising from your use of the Website or purchase of products, beyond the value of the
        relevant order. Nothing in this section limits any liability that cannot be excluded under applicable Indian
        law, including in respect of defective goods.
      </p>
    ),
  },
  {
    id: 'indemnification',
    title: 'Indemnification',
    icon: 'shield',
    content: (
      <p>
        You agree to indemnify and hold 9Karet harmless from any claims, losses or damages arising from your
        violation of these Terms or misuse of the Website.
      </p>
    ),
  },
  {
    id: 'governing-law',
    title: 'Governing Law & Jurisdiction',
    icon: 'scale',
    content: (
      <p>
        These Terms are governed by the laws of India. Subject to your statutory rights, any disputes arising out of
        or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts in Mumbai,
        Maharashtra.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to These Terms',
    icon: 'edit',
    content: (
      <p>
        We may update these Terms from time to time. The “Last Updated” date at the top of this page indicates when it
        was last revised. Continued use of the Website after changes take effect constitutes acceptance of the revised
        Terms.
      </p>
    ),
  },
  {
    id: 'statutory-rights',
    title: 'Statutory Consumer Rights',
    icon: 'handshake',
    content: (
      <p>
        Nothing in these Terms is intended to limit any mandatory rights or remedies available to customers under
        applicable Indian consumer-protection law, including the Consumer Protection Act, 2019.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact 9Karet',
    icon: 'mail',
    content: <PolicyContact assistanceWith="questions about these Terms" />,
  },
];

export function TermsPage() {
  return (
    <PolicyDocLayout
      title="Terms & Conditions"
      lastUpdated="2 October 2026"
      subtitle={
        <>
          The terms that govern your use of 9Karet.com and your purchases with us.
          <br />
          Please read them carefully.
        </>
      }
      glance={{
        heading: 'Using 9Karet',
        content: (
          <p>
            These Terms &amp; Conditions (“Terms”) govern your use of www.9karet.com (the “Website”), owned and
            operated by Goldbox Diamonds Private Limited (“9Karet”, “we”, “us”). By accessing the Website or
            placing an order, you agree to these Terms. If you do not agree, please do not use the Website.
          </p>
        ),
      }}
      sections={SECTIONS}
    />
  );
}
