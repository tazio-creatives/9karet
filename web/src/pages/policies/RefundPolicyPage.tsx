import { PolicyDocLayout, type PolicySection } from './PolicyDocLayout';
import { PolicyContact } from './PolicyContact';

const SECTIONS: PolicySection[] = [
  {
    id: 'return-period',
    title: 'Seven-Day Return Period',
    icon: 'calendar',
    content: (
      <>
        <p>
          You must raise your return request through My Account on 9Karet.com within seven calendar days from
          the date on which your order is shown as delivered.
        </p>
        <p>A request raised after the seven-day period may not be accepted unless required under applicable law.</p>
        <p>The return period begins on the recorded delivery date and includes weekends and public holidays.</p>
      </>
    ),
  },
  {
    id: 'unboxing-video',
    title: 'Mandatory Unboxing Video',
    icon: 'video',
    content: (
      <>
        <p>A clear, continuous unboxing video is mandatory for every return request.</p>
        <p>The video should:</p>
        <ul>
          <li>Begin before the shipping package is opened.</li>
          <li>Clearly show the sealed outer package.</li>
          <li>Show the shipping label and order details.</li>
          <li>Record the complete opening process without pauses or cuts.</li>
          <li>Show the jewellery box, product, certificate, invoice, tags, and accessories.</li>
          <li>Clearly display the jewellery from different angles.</li>
          <li>Capture any visible damage, missing item, incorrect product, or other concern.</li>
          <li>Be recorded in sufficient lighting and image quality.</li>
          <li>Remain continuous, original, and unedited.</li>
        </ul>
        <p>A paused, edited, blurred, incomplete, or unclear video may not be accepted as valid return evidence.</p>
        <p>
          Customers are advised to record every jewellery delivery immediately upon receipt, even when the package
          appears undamaged.
        </p>
        <p>
          The absence of an acceptable unboxing video may affect eligibility under this voluntary return policy,
          subject always to rights and remedies that cannot lawfully be excluded.
        </p>
      </>
    ),
  },
  {
    id: 'return-evidence',
    title: 'Uploading Your Return Evidence',
    icon: 'upload',
    content: (
      <>
        <p>Before raising a return request, log in to:</p>
        <p>
          <strong>9Karet.com → My Account → My Orders → Select Order → Request Return</strong>
        </p>
        <p>You must upload:</p>
        <ul>
          <li>The complete unboxing video</li>
          <li>A clear, recent photograph of the jewellery</li>
          <li>Photographs showing the front, back, sides, lock, clasp, chain, or setting, as applicable</li>
          <li>A photograph of the product certificate</li>
          <li>A photograph of the invoice</li>
          <li>A photograph of the original packaging and product tag</li>
          <li>A clear image of any concern being reported</li>
        </ul>
        <p>The images must show the product’s current condition at the time the return request is submitted.</p>
        <p>
          Screenshots, downloaded photographs, catalogue images, heavily filtered images, or photographs that do not
          clearly show the actual product may not be accepted.
        </p>
      </>
    ),
  },
  {
    id: 'initial-verification',
    title: 'Initial Verification',
    icon: 'verify',
    content: (
      <>
        <p>
          After receiving your return request, our team will review the information, photographs, and unboxing video
          provided.
        </p>
        <p>
          If the uploaded evidence is clear and the product appears eligible, we will provide initial approval and
          begin arranging the return.
        </p>
        <p>
          Initial approval does not guarantee a refund. Final acceptance is subject to physical inspection after the
          product reaches the 9Karet quality-control facility.
        </p>
        <p>
          If additional information is required, our customer-support team may contact you before approving the
          return.
        </p>
      </>
    ),
  },
  {
    id: 'return-pickup',
    title: 'Return Pickup Process',
    icon: 'truck',
    content: (
      <>
        <p>Once your return request receives initial approval:</p>
        <ul>
          <li>A 9Karet representative will contact you.</li>
          <li>The representative will confirm the return details and your pickup address.</li>
          <li>A suitable pickup date and time will be arranged.</li>
          <li>Our authorised logistics partner will collect the product.</li>
          <li>
            The product must be handed over with all original documents, packaging, certificates, tags, and
            accessories.
          </li>
        </ul>
        <p>
          <strong>Free return shipping:</strong> 9Karet provides free reverse shipping across India for eligible
          products approved under this policy, subject to pickup availability at your location.
        </p>
        <p>Please do not send jewellery independently unless 9Karet provides written instructions.</p>
        <p>
          9Karet may not be responsible for products returned through an unauthorised courier or sent without
          an approved return request.
        </p>
        <p>
          Pickup availability may depend on the serviceability of the delivery location. Where reverse pickup is
          unavailable, our team will provide alternative instructions.
        </p>
      </>
    ),
  },
  {
    id: 'return-condition',
    title: 'Condition Required for Return',
    icon: 'sparkle',
    content: (
      <>
        <p>A product will be accepted only if it is returned in the same condition in which it was delivered.</p>
        <p>The product must be:</p>
        <ul>
          <li>Unworn</li>
          <li>Unused</li>
          <li>Unwashed</li>
          <li>Unaltered</li>
          <li>Unpolished</li>
          <li>Unrepaired</li>
          <li>Unengraved after delivery</li>
          <li>Free from scratches</li>
          <li>Free from dents</li>
          <li>Free from bending or distortion</li>
          <li>Free from breakage</li>
          <li>Free from stains, chemicals, perfume, cosmetics, or other residue</li>
          <li>Returned with the original tag intact</li>
          <li>Returned with the original invoice</li>
          <li>Returned with all certificates</li>
          <li>Returned with the original jewellery box and packaging</li>
          <li>Returned with every accessory supplied with the order</li>
        </ul>
        <p>
          The product must not show signs of use, wear, mishandling, accidental damage, or unauthorised servicing.
        </p>
      </>
    ),
  },
  {
    id: 'size-or-preference',
    title: 'Returns for Size or Preference',
    icon: 'ruler',
    content: (
      <>
        <p>An eligible product may be returned because:</p>
        <ul>
          <li>The size is unsuitable.</li>
          <li>The product does not fit as expected.</li>
          <li>The customer does not prefer the design after receiving it.</li>
          <li>The customer changes their mind.</li>
        </ul>
        <p>Such a return will be accepted only when:</p>
        <ul>
          <li>The request is raised within seven calendar days.</li>
          <li>The complete unboxing video has been provided.</li>
          <li>The required live photographs have been uploaded.</li>
          <li>The product remains in its original delivered condition.</li>
          <li>The product satisfies every return-eligibility requirement.</li>
          <li>The product does not belong to an excluded category.</li>
        </ul>
        <p>
          Trying on a product must not result in scratches, bending, stretching, marks, distortion, or any other
          change.
        </p>
        <p>
          Ring-size availability and actual fit can vary according to the design and width of the ring. Customers are
          advised to confirm their size carefully before ordering.
        </p>
      </>
    ),
  },
  {
    id: 'damaged-or-altered',
    title: 'Damaged or Altered Products Will Not Be Accepted',
    icon: 'alert',
    content: (
      <>
        <p>A return may be rejected if our quality team finds:</p>
        <ul>
          <li>Scratches</li>
          <li>Dents</li>
          <li>Breakage</li>
          <li>Bending</li>
          <li>Distortion</li>
          <li>A loose or missing stone</li>
          <li>A damaged prong or setting</li>
          <li>A stretched or damaged chain</li>
          <li>A broken clasp, lock, screw, or connecting ring</li>
          <li>Signs of wear</li>
          <li>Signs of chemical exposure</li>
          <li>Perfume, makeup, lotion, oil, or other residue</li>
          <li>Unauthorised repair, resizing, polishing, or alteration</li>
          <li>Missing tags, certificates, invoice, packaging, or accessories</li>
          <li>A product that differs from the item originally dispatched</li>
          <li>Any condition inconsistent with the return photographs or unboxing video</li>
        </ul>
        <p>
          Products damaged after delivery due to wear, accident, misuse, improper handling, or failure to follow our{' '}
          <a href="/care-guide">Jewellery Care Guide</a> are not eligible for return.
        </p>
        <p>
          This condition does not remove any remedy available for a product proven to have been damaged, defective,
          incorrect, or incomplete when delivered.
        </p>
      </>
    ),
  },
  {
    id: 'delivery-damage',
    title: 'Reporting Delivery Damage or an Incorrect Product',
    icon: 'package',
    content: (
      <>
        <p>
          If the package or product is damaged, broken, incomplete, incorrect, or appears tampered with at delivery:
        </p>
        <ul>
          <li>Record the complete unboxing video.</li>
          <li>Take clear photographs immediately.</li>
          <li>Do not wear, use, clean, alter, or repair the product.</li>
          <li>Keep all packaging, seals, labels, certificates, and accessories.</li>
          <li>Raise a request through My Account as soon as possible and within the applicable return period.</li>
        </ul>
        <p>
          Our team will compare the unboxing evidence, dispatch records, product details, and returned item before
          deciding the appropriate resolution.
        </p>
      </>
    ),
  },
  {
    id: 'non-returnable',
    title: 'Non-Returnable Products',
    icon: 'ban',
    content: (
      <>
        <p>The following products are not eligible for return under the seven-day voluntary return policy:</p>
        <ul>
          <li>Custom-made jewellery</li>
          <li>Personalised jewellery</li>
          <li>Engraved products</li>
          <li>Products manufactured to special specifications</li>
          <li>Resized or altered jewellery</li>
          <li>Products repaired or polished after delivery</li>
          <li>Products showing signs of wear or use</li>
          <li>Products damaged after delivery</li>
          <li>Products with removed or damaged tags</li>
          <li>Products returned without certificates or original documentation</li>
          <li>Products returned without the original packaging</li>
          <li>Gift cards, vouchers, or promotional benefits</li>
          <li>Any product identified as non-returnable on its product page</li>
        </ul>
        <p>
          An exclusion will not apply where a remedy is required under applicable law for a product that was
          defective, damaged, incorrect, counterfeit, or materially different from its confirmed description when
          delivered.
        </p>
      </>
    ),
  },
  {
    id: 'quality-inspection',
    title: 'Quality Inspection',
    icon: 'search',
    content: (
      <>
        <p>After the returned product reaches 9Karet, it will be examined by our quality-control team.</p>
        <p>The inspection may include:</p>
        <ul>
          <li>Product identity verification</li>
          <li>Gold-purity verification</li>
          <li>Product-weight verification</li>
          <li>Stone-count verification</li>
          <li>Stone-setting inspection</li>
          <li>Scratch and surface inspection</li>
          <li>Shape and structural inspection</li>
          <li>Ring-size or measurement confirmation</li>
          <li>Clasp, lock, screw, or chain inspection</li>
          <li>Certificate and tag verification</li>
          <li>Packaging and accessory verification</li>
          <li>Comparison with dispatch records</li>
          <li>Comparison with the uploaded photographs and unboxing video</li>
        </ul>
        <p>
          The inspection process begins only after the returned package has been physically received and recorded at
          our facility.
        </p>
      </>
    ),
  },
  {
    id: 'refund-timeline',
    title: 'Inspection and Refund Timeline',
    icon: 'clock',
    content: (
      <>
        <p>
          The complete inspection and refund process may take up to 14 working days from the date the returned
          product is received at the 9Karet facility.
        </p>
        <p>
          Working days exclude Sundays, public holidays, bank holidays, and officially declared non-working days.
        </p>
        <p>If the return is approved after inspection, the refund will be initiated to the original payment method.</p>
        <p>
          After initiation, the time required for the amount to appear in your account may depend on your bank, card
          issuer, payment service provider, or other financial institution.
        </p>
      </>
    ),
  },
  {
    id: 'refund-amount',
    title: 'Refund Amount',
    icon: 'wallet',
    content: (
      <>
        <p>
          For an approved return, the eligible amount will be refunded according to the order value and applicable
          terms.
        </p>
        <p>
          The refund may exclude amounts that were clearly identified as non-refundable before purchase, where legally
          permissible, including:
        </p>
        <ul>
          <li>Gift-wrapping charges</li>
          <li>Special delivery charges</li>
          <li>Personalisation charges</li>
          <li>Customisation charges</li>
          <li>Engraving charges</li>
          <li>Paid services already completed</li>
          <li>Promotional benefits not eligible for cash conversion</li>
          <li>Deductions required because of missing items or documentation</li>
        </ul>
        <p>Any applicable deduction will be communicated with the reason for the deduction.</p>
        <p>
          Where a promotional discount, coupon, gift, cashback, reward, or bundled offer formed part of the
          transaction, the refund will be adjusted according to the applicable offer terms.
        </p>
      </>
    ),
  },
  {
    id: 'refund-method',
    title: 'Refund Method',
    icon: 'card',
    content: (
      <>
        <p>Approved refunds will generally be sent to the original payment method used for the order.</p>
        <p>Depending on the original transaction, the refund may be processed to:</p>
        <ul>
          <li>A bank account</li>
          <li>A debit or credit card</li>
          <li>UPI</li>
          <li>A digital wallet</li>
          <li>The original payment gateway</li>
          <li>Another legally permitted method agreed with the customer</li>
        </ul>
        <p>Cash refunds may not be available for online transactions.</p>
        <p>
          For cash-on-delivery orders, the customer may be required to provide verified bank-account information. The
          account details must belong to the purchaser or another person authorised in accordance with our
          verification process.
        </p>
      </>
    ),
  },
  {
    id: 'rejected-returns',
    title: 'Rejected Returns',
    icon: 'xCircle',
    content: (
      <>
        <p>
          If the quality team determines that the product does not satisfy the return conditions, the return may be
          rejected.
        </p>
        <p>Reasons may include:</p>
        <ul>
          <li>Physical damage</li>
          <li>Scratches or signs of wear</li>
          <li>Missing stones or components</li>
          <li>Alteration or resizing</li>
          <li>Missing tags or certificates</li>
          <li>Missing packaging or accessories</li>
          <li>Product mismatch</li>
          <li>Evidence inconsistency</li>
          <li>Return of an excluded product</li>
          <li>Failure to comply with the return procedure</li>
        </ul>
        <p>The customer will be informed of the reason for rejection.</p>
        <p>
          Subject to applicable terms, the rejected product may be returned to the customer. Shipping, insurance,
          handling, or other reasonable costs may apply where permitted.
        </p>
      </>
    ),
  },
  {
    id: 'packaging',
    title: 'Packaging the Return',
    icon: 'gift',
    content: (
      <>
        <p>Once pickup is approved:</p>
        <ul>
          <li>Place the jewellery inside its original 9Karet jewellery box.</li>
          <li>Include the certificate, invoice, tags, accessories, and supplied documents.</li>
          <li>Secure the jewellery so that it cannot move or become damaged.</li>
          <li>Place the jewellery box inside suitable protective outer packaging.</li>
          <li>Do not write, tape, or attach labels directly to the jewellery box.</li>
          <li>Do not disclose the package contents on the outer packaging.</li>
          <li>Do not hand over the package to anyone other than the authorised pickup representative.</li>
          <li>Obtain or retain the pickup confirmation provided by the logistics partner.</li>
        </ul>
        <p>
          The product remains the customer’s responsibility until it is collected by the authorised logistics partner
          and a valid pickup record is generated.
        </p>
      </>
    ),
  },
  {
    id: 'failed-pickup',
    title: 'Failed or Missed Pickup',
    icon: 'refresh',
    content: (
      <>
        <p>
          If the scheduled pickup cannot be completed because the customer is unavailable, the address is incorrect,
          or the package is not ready, 9Karet may attempt to reschedule the collection.
        </p>
        <p>Repeated failed pickup attempts may delay or cancel the return request.</p>
      </>
    ),
  },
  {
    id: 'cancellation',
    title: 'Cancellation Before Dispatch',
    icon: 'cancel',
    content: (
      <>
        <p>
          If an order has not entered production, customisation, certification, packaging, or dispatch, the customer
          may request cancellation through My Account or customer support.
        </p>
        <p>Cancellation is not guaranteed and depends on the status of the order.</p>
        <p>
          Custom-made, personalised, engraved, resized, or special-order products may not be cancellable once
          production has started.
        </p>
      </>
    ),
  },
  {
    id: 'customer-responsibilities',
    title: 'Customer Responsibilities',
    icon: 'user',
    content: (
      <>
        <p>Before submitting a return request, the customer is responsible for:</p>
        <ul>
          <li>Reading the product description and specifications</li>
          <li>Selecting the appropriate size and available options</li>
          <li>Recording the mandatory unboxing video</li>
          <li>Inspecting the product immediately after delivery</li>
          <li>Uploading clear, current photographs</li>
          <li>Keeping all original packaging and documentation</li>
          <li>Protecting the jewellery from damage</li>
          <li>Providing accurate pickup information</li>
          <li>Handing over the complete product to the authorised logistics partner</li>
        </ul>
      </>
    ),
  },
  {
    id: 'our-responsibilities',
    title: '9Karet’ Responsibilities',
    icon: 'handshake',
    content: (
      <>
        <p>9Karet will:</p>
        <ul>
          <li>Review return requests fairly</li>
          <li>Verify submitted evidence</li>
          <li>Arrange pickup for approved and serviceable requests</li>
          <li>Inspect returned jewellery carefully</li>
          <li>Communicate approval, rejection, or requests for additional information</li>
          <li>Process approved refunds within the stated internal timeline</li>
          <li>Respect consumer rights available under applicable law</li>
        </ul>
      </>
    ),
  },
  {
    id: 'policy-misuse',
    title: 'Policy Misuse',
    icon: 'flag',
    content: (
      <>
        <p>9Karet may reject, investigate, or restrict a request where there is reasonable evidence of:</p>
        <ul>
          <li>Product substitution</li>
          <li>False damage claims</li>
          <li>Manipulated photographs or videos</li>
          <li>Return of a different item</li>
          <li>Removal or replacement of stones or components</li>
          <li>Repeated misuse of the return process</li>
          <li>Fraudulent payment or account activity</li>
          <li>Misrepresentation of product condition</li>
        </ul>
        <p>Appropriate action may be taken in accordance with applicable law.</p>
      </>
    ),
  },
  {
    id: 'statutory-rights',
    title: 'Your Statutory Rights',
    icon: 'scale',
    content: (
      <>
        <p>
          This policy describes the voluntary return process offered by 9Karet. Nothing in this policy is
          intended to exclude, restrict, or override any consumer right or remedy that cannot lawfully be excluded
          under applicable Indian law.
        </p>
        <p>
          If any provision of this policy conflicts with a mandatory legal requirement, the applicable legal
          requirement will prevail.
        </p>
      </>
    ),
  },
  {
    id: 'how-to-return',
    title: 'How to Request a Return',
    icon: 'list',
    content: (
      <ol>
        <li>Visit 9Karet.com.</li>
        <li>Log in to My Account.</li>
        <li>Open My Orders.</li>
        <li>Select the relevant order.</li>
        <li>Choose Request Return.</li>
        <li>Select the reason for return.</li>
        <li>Upload the complete unboxing video.</li>
        <li>Upload clear, live photographs of the product.</li>
        <li>Upload the requested invoice, certificate, tag, and packaging images.</li>
        <li>Submit the request.</li>
        <li>Wait for verification and a call from our representative.</li>
        <li>Keep the complete return package ready for collection.</li>
      </ol>
    ),
  },
  {
    id: 'contact',
    title: 'Contact Us',
    icon: 'mail',
    content: (
      <>
        <PolicyContact assistanceWith="return or refund assistance" />
        <p>Please keep the following information ready:</p>
        <ul>
          <li>Order number</li>
          <li>Registered name</li>
          <li>Registered mobile number</li>
          <li>Delivery date</li>
          <li>Product name</li>
          <li>Reason for return</li>
          <li>Unboxing video</li>
          <li>Current product photographs</li>
          <li>Invoice and certificate details</li>
        </ul>
        <p>
          <strong>9Karet — Timeless by Nature.</strong>
          <br />A clear process. A careful inspection. A fair resolution.
        </p>
      </>
    ),
  },
];

export function RefundPolicyPage() {
  return (
    <PolicyDocLayout
      title="Return and Refund Policy"
      lastUpdated="2 October 2026"
      subtitle={
        <>
          Your complete guide to returns and refunds at 9Karet.
          <br />
          Shop with confidence.
        </>
      }
      glance={{
        heading: 'Shop With Confidence at 9Karet',
        content: (
          <>
            <p>
              At 9Karet, every piece of jewellery is carefully inspected before it is packed and dispatched. We
              want you to feel confident about your purchase and understand the conditions that apply if you decide to
              return an eligible product.
            </p>
            <p>
              Eligible products may be returned within seven calendar days from the date of delivery, subject to the
              conditions, exclusions, verification requirements, and quality inspection explained below. Free return
              shipping is available across India for eligible returns.
            </p>
          </>
        ),
      }}
      sections={SECTIONS}
    />
  );
}
