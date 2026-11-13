import { PolicyDocLayout, type PolicySection } from './PolicyDocLayout';
import { PolicyContact } from './PolicyContact';

const SECTIONS: PolicySection[] = [
  {
    id: 'information-we-collect',
    title: 'Information We Collect',
    icon: 'list',
    content: (
      <>
        <p>
          We collect information you provide directly to us, such as when you create an account, place an order, or
          contact customer support:
        </p>
        <ul>
          <li>Name, mobile number and email address.</li>
          <li>Delivery and billing address.</li>
          <li>Order history, wishlist and cart contents.</li>
          <li>Communications you send us (support requests, reviews, feedback).</li>
        </ul>
        <p>We also collect information automatically as you browse:</p>
        <ul>
          <li>Device, browser and IP address.</li>
          <li>Pages viewed, time spent, and referring/exit pages.</li>
          <li>Cookies and similar tracking technologies (see Section 3).</li>
        </ul>
        <p>
          <strong>Payment information</strong> — we do not store your full card, UPI or net-banking credentials.
          Payments are processed directly by our payment gateway partner(s), who handle and secure that information
          under their own compliance standards (including PCI-DSS).
        </p>
      </>
    ),
  },
  {
    id: 'how-we-use',
    title: 'How We Use Your Information',
    icon: 'sparkle',
    content: (
      <ul>
        <li>To process and deliver your orders, and to communicate order/delivery updates.</li>
        <li>To create and manage your account.</li>
        <li>To respond to support requests, returns and refund claims.</li>
        <li>
          To send order confirmations, transactional messages and, where you’ve opted in, marketing communications.
        </li>
        <li>To detect and prevent fraud, abuse and unauthorised access.</li>
        <li>To improve our website, products and customer experience.</li>
        <li>To comply with legal, tax and regulatory obligations.</li>
      </ul>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and Tracking Technologies',
    icon: 'cookie',
    content: (
      <p>
        We use cookies and similar technologies to keep you signed in, remember your cart and preferences, understand
        how our website is used, and measure the effectiveness of our marketing. You can control or disable cookies
        through your browser settings; doing so may affect some website features (such as staying signed in or
        checkout working correctly).
      </p>
    ),
  },
  {
    id: 'sharing',
    title: 'Sharing Your Information',
    icon: 'share',
    content: (
      <>
        <p>We do not sell your personal information. We share it only where necessary to run our business:</p>
        <ul>
          <li>With logistics and courier partners, to deliver your order.</li>
          <li>With payment gateway providers, to process payments and refunds.</li>
          <li>
            With service providers who support our website, hosting, analytics, customer support and marketing on our
            behalf.
          </li>
          <li>With gemstone certification bodies, where relevant to your order.</li>
          <li>
            Where required by law, court order, or to protect the rights, property or safety of 9Karet, our
            customers or the public.
          </li>
          <li>
            In connection with a merger, acquisition or sale of business assets, subject to the same protections
            described here.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'data-security',
    title: 'Data Security',
    icon: 'lock',
    content: (
      <p>
        We use reasonable technical and organisational safeguards to protect your personal information against
        unauthorised access, alteration, disclosure or destruction. No method of transmission or storage is completely
        secure, and we cannot guarantee absolute security.
      </p>
    ),
  },
  {
    id: 'data-retention',
    title: 'Data Retention',
    icon: 'archive',
    content: (
      <p>
        We retain personal information for as long as necessary to fulfil the purposes described in this policy,
        including to satisfy legal, accounting, tax or reporting requirements (such as maintaining order and invoice
        records).
      </p>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your Rights',
    icon: 'verify',
    content: (
      <>
        <p>Subject to applicable law, you may:</p>
        <ul>
          <li>Access, review and update your personal information through your account, or by contacting us.</li>
          <li>Request correction of inaccurate information.</li>
          <li>
            Request deletion of your account and associated personal information, subject to records we’re legally
            required to keep.
          </li>
          <li>
            Opt out of marketing communications at any time (via the unsubscribe link in our emails, or by contacting
            us).
          </li>
        </ul>
        <p>
          To exercise any of these rights, contact us using the details in Section 11. We may need to verify your
          identity before acting on a request.
        </p>
      </>
    ),
  },
  {
    id: 'childrens-privacy',
    title: 'Children’s Privacy',
    icon: 'user',
    content: (
      <p>
        Our website is not directed at children under 18. We do not knowingly collect personal information from
        children. If you believe a child has provided us with personal information, please contact us and we will
        take steps to delete it.
      </p>
    ),
  },
  {
    id: 'third-party-links',
    title: 'Third-Party Links',
    icon: 'link',
    content: (
      <p>
        Our website may contain links to third-party websites (such as social media platforms). We are not
        responsible for the privacy practices or content of those sites. We encourage you to review their privacy
        policies separately.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to This Policy',
    icon: 'edit',
    content: (
      <p>
        We may update this Privacy Policy from time to time to reflect changes in our practices or for legal reasons.
        The “Last Updated” date at the top of this page indicates when it was last revised. Material changes will be
        communicated through the website or by other reasonable means.
      </p>
    ),
  },
  {
    id: 'grievance-officer',
    title: 'Grievance Officer & Contact',
    icon: 'mail',
    content: (
      <>
        <p>
          In accordance with the Digital Personal Data Protection Act, 2023, the Information Technology Act, 2000 and
          rules made thereunder, any questions, concerns or grievances regarding this Privacy Policy or your personal
          information may be directed to our Grievance Officer using the contact details below.
        </p>
        <PolicyContact assistanceWith="privacy-related questions or requests" />
      </>
    ),
  },
];

export function PrivacyPolicyPage() {
  return (
    <PolicyDocLayout
      title="Privacy Policy"
      lastUpdated="16 September 2026"
      subtitle={
        <>
          How 9Karet collects, uses and protects your personal information.
          <br />
          Your privacy matters to us.
        </>
      }
      glance={{
        heading: 'Your Privacy at 9Karet',
        content: (
          <>
            <p>
              9Karet (“we”, “us”, “our”), owned and operated by Goldbox Diamonds Private Limited, respects your
              privacy. This Privacy Policy explains what personal information we collect through www.9karet.com,
              how we use it, who we share it with, and the choices available to you.
            </p>
            <p>
              By using our website or placing an order, you agree to the collection and use of information as described
              here.
            </p>
          </>
        ),
      }}
      sections={SECTIONS}
    />
  );
}
