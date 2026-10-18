// Shared, email-safe HTML layout for the 6 customer-facing order-lifecycle
// emails (Confirmed/Processing/Ready to Ship/Shipped/Out for
// Delivery/Delivered) — one reusable table-based template + a small
// per-status config, not six duplicated templates. Table layout + inline
// CSS throughout, no CSS grid/flexbox/JS/webfonts, so it degrades cleanly
// in Outlook desktop (which ignores <style>/media queries entirely) while
// still looking right in Gmail/Apple Mail/mobile clients that do support
// them.
import { formatPriceForEmail } from '../../utils/formatPriceForEmail.js';
import { buildOrderEmailContext } from '../orderEmailContext.js';
import { env } from '../../config/env.js';

const BRAND = {
  green: '#530711',
  greenDark: '#38040b',
  gold: '#c6a15b',
  goldBright: '#d9ad42',
  bg: '#faf8f3',
  surface: '#ffffff',
  text: '#3c171c',
  textMuted: '#5f6969',
  border: '#e3e7e4',
  danger: '#b3261e',
};

const FONT_STACK = "Arial, Helvetica, 'Segoe UI', sans-serif";
const SUPPORT_EMAIL = 'info@9karet.com';
const LOGO_URL = `${env.webAppBaseUrl}/images/logo.png`;

// Order in which every step appears in the tracker — deliberately only the
// customer-facing lifecycle (no DELAYED/RETURN_INITIATED/CANCELLED/etc,
// matching "do not use internal admin-only statuses").
const PROGRESS_STEPS = [
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'PROCESSING', label: 'Processing' },
  { key: 'READY_TO_SHIP', label: 'Ready to Ship' },
  { key: 'SHIPPED', label: 'Shipped' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
  { key: 'DELIVERED', label: 'Delivered' },
];

// One entry per email template — everything status-specific (heading, CTA,
// which tracker step is "current") lives here so the HTML builder below
// stays generic.
const ORDER_STATUS_EMAIL_CONFIG = {
  ORDER_CONFIRMED: {
    stepKey: 'CONFIRMED',
    subject: (ctx) => `Your 9KARET order ${ctx.orderNumber} is confirmed`,
    heading: 'Thank you for your order',
    subtext: (ctx) => `Your 9KARET order ${ctx.orderNumber} has been confirmed and is being prepared.`,
    ctaLabel: 'View Order',
    unboxing: 'heads-up',
  },
  ORDER_PROCESSING: {
    stepKey: 'PROCESSING',
    subject: (ctx) => `Order ${ctx.orderNumber} is being prepared`,
    heading: 'Your order is being prepared',
    subtext: (ctx) => `Our team is now preparing your 9KARET order ${ctx.orderNumber}.`,
    ctaLabel: 'View Order Status',
  },
  ORDER_READY_TO_SHIP: {
    stepKey: 'READY_TO_SHIP',
    subject: (ctx) => `Order ${ctx.orderNumber} is ready to ship`,
    heading: 'Your order is packed and ready',
    subtext: (ctx) => `Your 9KARET order ${ctx.orderNumber} is packed and will ship shortly.`,
    ctaLabel: 'View Order',
  },
  ORDER_SHIPPED: {
    stepKey: 'SHIPPED',
    subject: (ctx) => `Your order ${ctx.orderNumber} has shipped`,
    heading: 'Your order is on the way',
    subtext: (ctx) => `Your 9KARET order ${ctx.orderNumber} has been shipped and is on its way to you.`,
    ctaLabel: 'Track Your Order',
  },
  ORDER_OUT_FOR_DELIVERY: {
    stepKey: 'OUT_FOR_DELIVERY',
    subject: (ctx) => `Order ${ctx.orderNumber} is out for delivery`,
    heading: 'Your order is arriving today',
    subtext: (ctx) => `Your 9KARET order ${ctx.orderNumber} is out for delivery and should arrive today.`,
    ctaLabel: 'Track Your Order',
    unboxing: 'arriving',
  },
  ORDER_DELIVERED: {
    stepKey: 'DELIVERED',
    subject: (ctx) => `Order ${ctx.orderNumber} has been delivered`,
    heading: 'Your order has been delivered',
    subtext: (ctx) =>
      `Your 9KARET order ${ctx.orderNumber} has been delivered. We hope you love it.`,
    ctaLabel: 'View Order',
    unboxing: 'delivered',
  },
};

export const ORDER_STATUS_EMAIL_TEMPLATE_NAMES = new Set(Object.keys(ORDER_STATUS_EMAIL_CONFIG));

function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDeliveryEstimate(estimate) {
  if (!estimate?.earliestDate || !estimate?.latestDate) return null;
  const opts = { day: 'numeric', month: 'long' };
  const earliest = new Date(estimate.earliestDate).toLocaleDateString('en-IN', opts);
  const latest = new Date(estimate.latestDate).toLocaleDateString('en-IN', {
    ...opts,
    year: 'numeric',
  });
  return `${earliest} – ${latest}`;
}

function renderTrackerDesktop(currentIndex) {
  const cells = PROGRESS_STEPS.map((step, i) => {
    const done = i < currentIndex;
    const current = i === currentIndex;
    const circleColor = done || current ? BRAND.green : '#d7dedd';
    const circleContent = done ? '&#10003;' : '';
    const labelColor = done || current ? BRAND.text : '#9aa5a4';
    const labelWeight = current ? 'bold' : 'normal';
    const connector =
      i < PROGRESS_STEPS.length - 1
        ? `<td width="6%" style="padding:0;"><div style="height:2px;background:${i < currentIndex ? BRAND.green : '#d7dedd'};font-size:0;line-height:0;">&nbsp;</div></td>`
        : '';
    return `
      <td width="15%" style="padding:0;text-align:center;vertical-align:top;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
          <tr>
            <td width="22" height="22" align="center" valign="middle" style="width:22px;height:22px;border-radius:11px;background:${circleColor};color:#ffffff;font-size:12px;font-family:${FONT_STACK};line-height:22px;">${circleContent}</td>
          </tr>
        </table>
        <div style="margin-top:6px;font-family:${FONT_STACK};font-size:10px;letter-spacing:0.2px;color:${labelColor};font-weight:${labelWeight};">${escapeHtml(step.label)}</div>
      </td>
      ${connector}`;
  }).join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="tracker-desktop">
      <tr>${cells}</tr>
    </table>`;
}

function renderTrackerMobile(currentIndex) {
  const currentLabel = PROGRESS_STEPS[currentIndex]?.label ?? '';
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="tracker-mobile" style="display:none;">
      <tr>
        <td style="font-family:${FONT_STACK};font-size:13px;color:${BRAND.text};">
          <strong>Step ${currentIndex + 1} of ${PROGRESS_STEPS.length}:</strong> ${escapeHtml(currentLabel)}
        </td>
      </tr>
    </table>`;
}

function renderProductRow(item) {
  const specs = [
    item.purity,
    item.goldColor ? `Gold Colour: ${item.goldColor.charAt(0)}${item.goldColor.slice(1).toLowerCase()}` : null,
    item.sizeLabel ? `Size: ${item.sizeLabel}` : null,
    ...(item.stones ?? []).map((st) => `${st.stoneTypeName}: ${st.count} pc, ${Number(st.weightCarats).toFixed(2)} ct`),
    `Qty: ${item.quantity}`,
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join('<br>');

  const imageCell = item.productImageUrl
    ? `<img src="${escapeHtml(item.productImageUrl)}" width="72" height="72" alt="${escapeHtml(item.productName)}" style="display:block;width:72px;height:72px;border-radius:8px;border:1px solid ${BRAND.border};object-fit:cover;">`
    : `<div style="width:72px;height:72px;border-radius:8px;background:${BRAND.bg};border:1px solid ${BRAND.border};"></div>`;

  return `
    <tr>
      <td colspan="3" style="padding:14px 0;border-bottom:1px solid ${BRAND.border};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="72" valign="top" style="padding-right:14px;">${imageCell}</td>
            <td valign="top" style="font-family:${FONT_STACK};">
              <div style="font-size:14px;font-weight:bold;color:${BRAND.text};margin-bottom:4px;">${escapeHtml(item.productName)}</div>
              <div style="font-size:12px;line-height:1.6;color:${BRAND.textMuted};">${specs}</div>
            </td>
            <td width="90" valign="top" align="right" style="font-family:${FONT_STACK};font-size:14px;font-weight:bold;color:${BRAND.text};white-space:nowrap;">${formatPriceForEmail(item.lineTotal)}</td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function renderAddress(address) {
  if (!address) return '';
  return [
    escapeHtml(address.name),
    escapeHtml(address.addressLine),
    address.building ? escapeHtml(address.building) : null,
    address.landmark ? escapeHtml(address.landmark) : null,
    `${escapeHtml(address.city)}, ${escapeHtml(address.state)} ${escapeHtml(address.pincode)}`,
    address.mobileNumber ? escapeHtml(address.mobileNumber) : null,
  ]
    .filter(Boolean)
    .join('<br>');
}

// Unboxing-video reminder (Return and Refund Policy: a continuous unboxing
// video is mandatory for every return). Shown on the three emails a customer
// reads around delivery — loudest on "out for delivery", which lands right
// before they open the parcel.
const UNBOXING_COPY = {
  'heads-up': {
    title: 'Before you open your parcel',
    lines: [
      'When your order arrives, record one continuous video from before you open the outer package until the jewellery is fully visible.',
      'An unboxing video is mandatory for any return.',
    ],
    checklist: null,
    footer: null,
  },
  arriving: {
    title: 'Start recording BEFORE you open the package',
    lines: ['Your parcel arrives today. Please record one continuous unboxing video:'],
    checklist: [
      'Show the sealed outer package and the shipping label',
      'Record the whole opening without pausing or cutting',
      'Show the jewellery box, the product, certificate and invoice',
    ],
    footer: 'An unboxing video is mandatory for every return — returns cannot be accepted without it.',
  },
  delivered: {
    title: 'Keep your unboxing video',
    lines: [
      'If you need to return an item, request it within 7 days of delivery from My Account → My Orders.',
      'You will need to upload your complete unboxing video — it is mandatory for every return.',
    ],
    checklist: null,
    footer: null,
  },
};

function siteOrigin(context) {
  try {
    return new URL(context.orderUrl).origin;
  } catch {
    return '';
  }
}

function renderUnboxingNotice(context, variant) {
  const copy = UNBOXING_COPY[variant];
  if (!copy) return '';
  const prominent = variant === 'arriving';
  const policyUrl = `${siteOrigin(context)}/refund-policy`;
  return `
        <tr>
          <td class="mobile-pad" style="padding:0 40px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${prominent ? '#fbf3e2' : BRAND.bg};border:${prominent ? '2px' : '1px'} solid ${BRAND.gold};border-radius:10px;">
              <tr>
                <td style="padding:${prominent ? '20px 22px' : '16px 20px'};font-family:${FONT_STACK};">
                  <div style="font-size:${prominent ? '16px' : '14px'};font-weight:bold;color:${BRAND.text};margin-bottom:8px;">&#127909;&nbsp; ${escapeHtml(copy.title)}</div>
                  ${copy.lines.map((l) => `<p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:${BRAND.text};">${escapeHtml(l)}</p>`).join('')}
                  ${
                    copy.checklist
                      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 4px;">${copy.checklist
                          .map(
                            (c) =>
                              `<tr><td valign="top" style="padding:3px 8px 3px 0;font-size:13px;color:${BRAND.gold};font-weight:bold;">&#10003;</td><td style="padding:3px 0;font-size:13px;line-height:1.5;color:${BRAND.text};">${escapeHtml(c)}</td></tr>`,
                          )
                          .join('')}</table>`
                      : ''
                  }
                  ${copy.footer ? `<p style="margin:8px 0 0;font-size:13px;line-height:1.6;font-weight:bold;color:${BRAND.text};">${escapeHtml(copy.footer)}</p>` : ''}
                  <p style="margin:10px 0 0;font-size:12px;"><a href="${escapeHtml(policyUrl)}" target="_blank" style="color:${BRAND.green};font-weight:bold;text-decoration:underline;">Read our Return &amp; Refund Policy</a></p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
}

function renderUnboxingText(context, variant) {
  const copy = UNBOXING_COPY[variant];
  if (!copy) return [];
  return [
    `** ${copy.title.toUpperCase()} **`,
    ...copy.lines,
    ...(copy.checklist ?? []).map((c) => `  - ${c}`),
    ...(copy.footer ? [copy.footer] : []),
    `Return & Refund Policy: ${siteOrigin(context)}/refund-policy`,
    '',
  ];
}

function renderHtml(context, config) {
  const currentIndex = PROGRESS_STEPS.findIndex((s) => s.key === config.stepKey);
  const orderDateLabel = formatDate(context.orderDate);
  const deliveryEstimateLabel = formatDeliveryEstimate(context.deliveryEstimate);
  const hasShipment = !!context.awbNumber;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<title>${escapeHtml(config.subject(context))}</title>
<style>
  body, table, td { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
  table { border-collapse:collapse !important; }
  body { margin:0; padding:0; width:100% !important; background:${BRAND.bg}; }
  @media screen and (max-width:480px) {
    .email-container { width:100% !important; }
    .stack-col { display:block !important; width:100% !important; text-align:left !important; }
    .stack-col-right { text-align:left !important; padding-top:12px !important; }
    .tracker-desktop { display:none !important; }
    .tracker-mobile { display:block !important; }
    .mobile-pad { padding-left:20px !important; padding-right:20px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.bg};">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" class="email-container" width="620" cellpadding="0" cellspacing="0" border="0" style="width:620px;max-width:620px;background:${BRAND.surface};border-radius:12px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td align="center" style="padding:28px 24px;border-bottom:1px solid ${BRAND.border};">
            <img src="${LOGO_URL}" alt="9KARET" height="34" style="height:34px;display:inline-block;">
          </td>
        </tr>

        <!-- Status hero -->
        <tr>
          <td align="center" class="mobile-pad" style="padding:36px 40px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="48" height="48" align="center" valign="middle" style="width:48px;height:48px;border-radius:24px;background:${BRAND.green};color:#ffffff;font-size:22px;font-family:${FONT_STACK};line-height:48px;">&#10003;</td>
              </tr>
            </table>
            <h1 style="margin:18px 0 8px;font-family:${FONT_STACK};font-size:22px;color:${BRAND.text};font-weight:bold;">${escapeHtml(config.heading)}</h1>
            <p style="margin:0;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${BRAND.textMuted};max-width:440px;">${escapeHtml(config.subtext(context))}</p>
          </td>
        </tr>

        ${renderUnboxingNotice(context, config.unboxing)}

        <!-- Progress tracker -->
        <tr>
          <td class="mobile-pad" style="padding:0 40px 32px;">
            ${renderTrackerDesktop(currentIndex)}
            ${renderTrackerMobile(currentIndex)}
          </td>
        </tr>

        <!-- Order summary -->
        <tr>
          <td class="mobile-pad" style="padding:0 40px 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BRAND.border};border-radius:10px;">
              <tr>
                <td style="padding:18px 20px 6px;">
                  <div style="font-family:${FONT_STACK};font-size:14px;font-weight:bold;color:${BRAND.text};">Order Summary</div>
                </td>
              </tr>
              <tr>
                <td style="padding:6px 20px 18px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:${FONT_STACK};font-size:13px;">
                    <tr>
                      <td style="padding:6px 0;color:${BRAND.textMuted};">Order ID</td>
                      <td align="right" style="padding:6px 0;color:${BRAND.text};font-weight:bold;">${escapeHtml(context.orderNumber)}</td>
                    </tr>
                    <tr><td colspan="2" style="border-top:1px solid ${BRAND.border};font-size:0;line-height:0;">&nbsp;</td></tr>
                    <tr>
                      <td style="padding:6px 0;color:${BRAND.textMuted};">Order Date</td>
                      <td align="right" style="padding:6px 0;color:${BRAND.text};">${escapeHtml(orderDateLabel ?? '—')}</td>
                    </tr>
                    <tr><td colspan="2" style="border-top:1px solid ${BRAND.border};font-size:0;line-height:0;">&nbsp;</td></tr>
                    <tr>
                      <td style="padding:6px 0;color:${BRAND.textMuted};">Status</td>
                      <td align="right" style="padding:6px 0;color:${BRAND.green};font-weight:bold;">${escapeHtml(PROGRESS_STEPS[currentIndex]?.label ?? context.orderStatus)}</td>
                    </tr>
                    <tr><td colspan="2" style="border-top:1px solid ${BRAND.border};font-size:0;line-height:0;">&nbsp;</td></tr>
                    <tr>
                      <td style="padding:6px 0;color:${BRAND.textMuted};">Order Total</td>
                      <td align="right" style="padding:6px 0;color:${BRAND.text};font-weight:bold;">${formatPriceForEmail(context.orderTotal)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Product details -->
        <tr>
          <td class="mobile-pad" style="padding:0 40px 24px;">
            <div style="font-family:${FONT_STACK};font-size:14px;font-weight:bold;color:${BRAND.text};margin-bottom:4px;">Product Details</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${context.items.map(renderProductRow).join('')}
            </table>
          </td>
        </tr>

        <!-- Shipping & delivery -->
        <tr>
          <td class="mobile-pad" style="padding:0 40px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BRAND.border};border-radius:10px;">
              <tr>
                <td style="padding:18px 20px 4px;">
                  <div style="font-family:${FONT_STACK};font-size:14px;font-weight:bold;color:${BRAND.text};">Shipping &amp; Delivery Details</div>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 20px 18px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td class="stack-col" width="55%" valign="top" style="font-family:${FONT_STACK};font-size:13px;">
                        <div style="color:${BRAND.textMuted};margin-bottom:4px;">Delivering to</div>
                        <div style="color:${BRAND.text};line-height:1.6;">${renderAddress(context.deliveryAddress)}</div>
                      </td>
                      <td class="stack-col stack-col-right" width="45%" valign="top" align="right" style="font-family:${FONT_STACK};font-size:13px;">
                        ${
                          hasShipment
                            ? `<div style="color:${BRAND.textMuted};margin-bottom:2px;">Delivery Partner</div>
                               <div style="color:${BRAND.text};font-weight:bold;margin-bottom:10px;">${escapeHtml(context.courierName)}</div>
                               <div style="color:${BRAND.textMuted};margin-bottom:2px;">Tracking ID</div>
                               <div style="color:${BRAND.text};font-weight:bold;margin-bottom:10px;">${escapeHtml(context.awbNumber)}</div>`
                            : ''
                        }
                        ${
                          deliveryEstimateLabel
                            ? `<div style="color:${BRAND.textMuted};margin-bottom:2px;">Estimated Delivery</div>
                               <div style="color:${BRAND.text};font-weight:bold;">${escapeHtml(deliveryEstimateLabel)}</div>`
                            : ''
                        }
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td align="center" style="padding:0 40px 36px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="border-radius:8px;background:${BRAND.green};">
                  <a href="${escapeHtml(context.orderUrl)}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${FONT_STACK};font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(config.ctaLabel)}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Support -->
        <tr>
          <td align="center" style="padding:0 40px 32px;border-top:1px solid ${BRAND.border};">
            <p style="margin:24px 0 6px;font-family:${FONT_STACK};font-size:13px;font-weight:bold;color:${BRAND.text};">Need help with your order?</p>
            <p style="margin:0 0 12px;font-family:${FONT_STACK};font-size:12px;color:${BRAND.textMuted};">Contact 9KARET support.</p>
            <a href="mailto:${SUPPORT_EMAIL}" style="font-family:${FONT_STACK};font-size:12px;color:${BRAND.gold};font-weight:bold;text-decoration:none;">Contact Support</a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="padding:24px 40px 32px;background:${BRAND.bg};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-family:${FONT_STACK};font-size:11px;color:${BRAND.textMuted};padding:0 10px;">Secure Payments</td>
                <td style="font-family:${FONT_STACK};font-size:11px;color:${BRAND.border};">|</td>
                <td style="font-family:${FONT_STACK};font-size:11px;color:${BRAND.textMuted};padding:0 10px;">Insured Shipping</td>
                <td style="font-family:${FONT_STACK};font-size:11px;color:${BRAND.border};">|</td>
                <td style="font-family:${FONT_STACK};font-size:11px;color:${BRAND.textMuted};padding:0 10px;">Dedicated Customer Support</td>
              </tr>
            </table>
            <p style="margin:16px 0 2px;font-family:${FONT_STACK};font-size:12px;color:${BRAND.textMuted};">Thank you for shopping with us</p>
            <p style="margin:0;font-family:${FONT_STACK};font-size:13px;font-weight:bold;letter-spacing:0.5px;color:${BRAND.text};">9KARET</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function renderText(context, config) {
  const lines = [
    config.heading,
    '',
    config.subtext(context),
    '',
    ...renderUnboxingText(context, config.unboxing),
    `Order ID: ${context.orderNumber}`,
    context.orderDate ? `Order Date: ${formatDate(context.orderDate)}` : null,
    `Status: ${PROGRESS_STEPS.find((s) => s.key === config.stepKey)?.label ?? context.orderStatus}`,
    `Order Total: ${formatPriceForEmail(context.orderTotal)}`,
    '',
    'Items:',
    ...context.items.map(
      (item) =>
        `- ${item.productName} x${item.quantity} — ${formatPriceForEmail(item.lineTotal)}`,
    ),
    '',
    context.awbNumber ? `Delivery Partner: ${context.courierName}` : null,
    context.awbNumber ? `Tracking ID: ${context.awbNumber}` : null,
    formatDeliveryEstimate(context.deliveryEstimate)
      ? `Estimated Delivery: ${formatDeliveryEstimate(context.deliveryEstimate)}`
      : null,
    '',
    `${config.ctaLabel}: ${context.orderUrl}`,
    '',
    `Need help with your order? Contact us at ${SUPPORT_EMAIL}`,
    '',
    '— 9KARET',
  ].filter((l) => l !== null);
  return lines.join('\n');
}

export async function renderOrderStatusEmail(template, payload) {
  const config = ORDER_STATUS_EMAIL_CONFIG[template];
  if (!config) throw new Error(`Unknown order-status email template "${template}"`);

  const context = await buildOrderEmailContext(payload?.orderId);
  if (!context) throw new Error(`Order not found for email template "${template}" (orderId: ${payload?.orderId})`);

  return {
    subject: config.subject(context),
    body: renderText(context, config),
    html: renderHtml(context, config),
  };
}
