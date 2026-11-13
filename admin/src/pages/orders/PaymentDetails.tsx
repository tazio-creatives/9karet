import { useState } from 'react';
import type { OrderDetail } from '../../api/types';
import sharedStyles from '../../styles/shared.module.css';

function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', fontSize: 'var(--text-sm)' }}>
      <span style={{ color: 'var(--color-text-muted)', minWidth: 120 }}>{label}</span>
      <code style={{ fontSize: 'var(--text-sm)', userSelect: 'all' }}>{value}</code>
      <button
        type="button"
        className={sharedStyles.buttonLink}
        onClick={() => {
          navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

// Cashfree identifiers for this order — search the Transaction ID (or the
// order ID) in the Cashfree dashboard to issue a refund.
export function PaymentDetails({ order }: { order: OrderDetail }) {
  const d = order.paymentDetails;
  if (!d) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      {d.transactionId ? (
        <CopyValue label="Transaction ID" value={d.transactionId} />
      ) : (
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          Transaction ID {d.lookupFailed ? 'could not be loaded from Cashfree — refresh to retry' : 'not available'}
        </span>
      )}
      {d.gatewayOrderId && <CopyValue label="Cashfree order ID" value={d.gatewayOrderId} />}
      {d.bankReference && <CopyValue label="Bank ref (UTR)" value={d.bankReference} />}
      {d.paymentMethod && (
        <span style={{ fontSize: 'var(--text-sm)' }}>
          <span style={{ color: 'var(--color-text-muted)', display: 'inline-block', minWidth: 120 }}>Method</span>
          {d.paymentMethod.replace(/_/g, ' ').toUpperCase()}
        </span>
      )}
    </div>
  );
}
