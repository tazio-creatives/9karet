import { renderOrderStatusEmail, ORDER_STATUS_EMAIL_TEMPLATE_NAMES } from './emailTemplates/orderStatusEmail.js';

// Plain-text templates (plan §12: minimal stack, no templating engine) —
// each entry maps a template name to a render function returning
// {subject, body}. Payload shapes are documented per template since they're
// the only contract between the enqueue call site and the worker.
//
// The 6 customer order-lifecycle templates (ORDER_CONFIRMED through
// ORDER_DELIVERED) are NOT here — they're rendered by the shared HTML
// template in emailTemplates/orderStatusEmail.js instead (routed below in
// renderEmailTemplate). Everything else (payment/cancellation/return
// notices) stays plain text, unchanged.
const templates = {
  // payload: { contactName, orderNumber }
  PAYMENT_FAILED: ({ contactName, orderNumber }) => ({
    subject: `Payment failed for order ${orderNumber}`,
    body: `Hi ${contactName},\n\nWe couldn't confirm payment for order ${orderNumber}. No amount has been charged and the order has not been placed. Please try again.\n\n— BOX DIAMONDS`,
  }),

  // payload: { contactName, orderNumber }
  ORDER_CANCELLED: ({ contactName, orderNumber }) => ({
    subject: `Order ${orderNumber} has been cancelled`,
    body: `Hi ${contactName},\n\nOrder ${orderNumber} has been cancelled. If a payment was made, it will be refunded to the original payment method.\n\n— BOX DIAMONDS`,
  }),

  // payload: { contactName, orderNumber, totalAmount, refundDays }
  ORDER_CANCELLED_BY_CUSTOMER: ({ contactName, orderNumber, totalAmount, refundDays }) => ({
    subject: `Your order ${orderNumber} has been cancelled`,
    body: `Hi ${contactName},\n\nAs requested, your order ${orderNumber} has been cancelled.\n\nRefund: ₹${Number(totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} will be credited back to your original payment method within ${refundDays} days. Depending on your bank, it may take a few additional working days to reflect in your account.\n\nIf you have any questions, just reply to this email.\n\n— BOX DIAMONDS`,
  }),

  // To the support inbox — payload: { name, email, phone, orderNumber, message }
  CONTACT_MESSAGE_RECEIVED: ({ name, email, phone, orderNumber, message }) => ({
    subject: `New contact message from ${name}`,
    body: `A new message was sent through the Box Diamonds Contact Us form.\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone || '—'}\nOrder number: ${orderNumber || '—'}\n\nMessage:\n${message}\n\nReply to the customer directly at ${email}. You can also track this message in Admin → Messages.`,
  }),

  // To the customer — payload: { name }
  CONTACT_ACKNOWLEDGEMENT: ({ name }) => ({
    subject: 'We have received your message — Box Diamonds',
    body: `Hi ${name},\n\nThank you for contacting Box Diamonds. We have received your message and our customer-support team will get back to you as soon as possible.\n\nIf your question is about an order, please keep your order number handy.\n\n— BOX DIAMONDS`,
  }),

  // payload: { contactName, orderNumber }
  ORDER_DELIVERY_FAILED: ({ contactName, orderNumber }) => ({
    subject: `Delivery attempt failed for order ${orderNumber}`,
    body: `Hi ${contactName},\n\nWe attempted to deliver order ${orderNumber} but were unable to complete it. Our team will be in touch to arrange redelivery.\n\n— BOX DIAMONDS`,
  }),

  // payload: { contactName, orderNumber }
  ORDER_RETURN_INITIATED: ({ contactName, orderNumber }) => ({
    subject: `Return initiated for order ${orderNumber}`,
    body: `Hi ${contactName},\n\nA return has been initiated for order ${orderNumber}. We'll keep you updated as it makes its way back to us.\n\n— BOX DIAMONDS`,
  }),
};

// --- Return flow (customer-facing) --------------------------------------
// Each is sent once, at the moment the return actually moves to that stage
// (see orderReturns/adminReturns controllers and shippingService's reverse
// pickup handling).
const formatRupees = (amount) =>
  `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

Object.assign(templates, {
  // payload: { contactName, orderNumber }
  RETURN_REQUEST_RECEIVED: ({ contactName, orderNumber }) => ({
    subject: `We've received your return request for order ${orderNumber}`,
    body: `Hi ${contactName},\n\nThank you — we've received your return request and unboxing video for order ${orderNumber}. Our team will review it and update you shortly, usually within 1–2 working days.\n\nPlease keep the item, its packaging, certificates and tags safe until the return is complete.\n\n— BOX DIAMONDS`,
  }),

  // payload: { contactName, orderNumber }
  RETURN_APPROVED: ({ contactName, orderNumber }) => ({
    subject: `Your return for order ${orderNumber} is approved`,
    body: `Hi ${contactName},\n\nGood news — your return request for order ${orderNumber} has been approved. We'll arrange a courier pickup from your delivery address and email you the pickup details shortly.\n\nPlease pack the item securely in its original packaging, along with any certificates and tags.\n\n— BOX DIAMONDS`,
  }),

  // payload: { contactName, orderNumber }
  RETURN_REJECTED: ({ contactName, orderNumber }) => ({
    subject: `Update on your return request for order ${orderNumber}`,
    body: `Hi ${contactName},\n\nAfter reviewing your return request for order ${orderNumber}, we're unable to accept this return as it doesn't meet our Return & Refund Policy.\n\nIf you have questions or would like us to take another look, just reply to this email and our team will be happy to help.\n\n— BOX DIAMONDS`,
  }),

  // payload: { contactName, orderNumber, courierName, awb, rescheduled }
  RETURN_PICKUP_SCHEDULED: ({ contactName, orderNumber, courierName, awb, rescheduled }) => ({
    subject: `${rescheduled ? 'New pickup scheduled' : 'Pickup scheduled'} for your return — order ${orderNumber}`,
    body: `Hi ${contactName},\n\n${rescheduled ? 'A new pickup' : 'A pickup'} has been scheduled for your return of order ${orderNumber}.\n\nCourier: ${courierName || '—'}\nTracking (AWB): ${awb || '—'}\n\nThe courier will collect the item from your delivery address, usually within 1–3 working days. Please keep it packed securely in its original packaging and hand it over only to the courier agent.\n\n— BOX DIAMONDS`,
  }),

  // payload: { contactName, orderNumber }
  RETURN_PICKUP_FAILED: ({ contactName, orderNumber }) => ({
    subject: `Pickup attempt for your return — order ${orderNumber}`,
    body: `Hi ${contactName},\n\nThe courier was unable to collect your return for order ${orderNumber}. Don't worry — we'll arrange another pickup and email you the details. If you'd like to tell us a convenient time, just reply to this email.\n\n— BOX DIAMONDS`,
  }),

  // payload: { contactName, orderNumber }
  RETURN_PICKED_UP: ({ contactName, orderNumber }) => ({
    subject: `Your return for order ${orderNumber} has been picked up`,
    body: `Hi ${contactName},\n\nThe courier has collected your return for order ${orderNumber} and it's on its way to us. We'll let you know as soon as it reaches our team.\n\n— BOX DIAMONDS`,
  }),

  // payload: { contactName, orderNumber, refundDays }
  RETURN_RECEIVED: ({ contactName, orderNumber, refundDays }) => ({
    subject: `We've received your return for order ${orderNumber}`,
    body: `Hi ${contactName},\n\nYour returned item for order ${orderNumber} has reached us. Once it passes our quality check, your refund will be processed to your original payment method within ${refundDays ?? 7} days. We'll email you as soon as it's issued.\n\n— BOX DIAMONDS`,
  }),

  // payload: { contactName, orderNumber, amount, reference, isReturn }
  REFUND_ISSUED: ({ contactName, orderNumber, amount, reference, isReturn }) => ({
    subject: `Your refund for order ${orderNumber} has been issued`,
    body: `Hi ${contactName},\n\nWe've issued a refund of ${formatRupees(amount)} for your ${isReturn ? 'returned' : 'cancelled'} order ${orderNumber} to your original payment method.${reference ? `\nRefund reference: ${reference}` : ''}\n\nDepending on your bank, it can take 5–7 working days to reflect in your account.\n\n— BOX DIAMONDS`,
  }),
});

export async function renderEmailTemplate(template, payload) {
  if (ORDER_STATUS_EMAIL_TEMPLATE_NAMES.has(template)) {
    return renderOrderStatusEmail(template, payload ?? {});
  }
  const render = templates[template];
  if (!render) throw new Error(`Unknown email template "${template}"`);
  return render(payload ?? {});
}
