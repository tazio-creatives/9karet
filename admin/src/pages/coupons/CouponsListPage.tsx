import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { fetchAdminCoupons, createCoupon, updateCoupon } from '../../api/coupons';
import type { Coupon, CouponInput } from '../../api/types';
import { ApiError } from '../../api/client';
import { formatPrice } from '../../utils/formatPrice';
import sharedStyles from '../../styles/shared.module.css';
import styles from './CouponsListPage.module.css';

type Mode = { type: 'none' } | { type: 'add' } | { type: 'edit'; coupon: Coupon };

function toDateInputValue(iso: string | null) {
  return iso ? iso.slice(0, 10) : '';
}

function CouponForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Coupon;
  onSubmit: (input: CouponInput) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [code, setCode] = useState(initial?.code ?? '');
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FLAT'>(initial?.discountType ?? 'PERCENT');
  const [discountValue, setDiscountValue] = useState(String(initial?.discountValue ?? ''));
  const [minOrderValue, setMinOrderValue] = useState(String(initial?.minOrderValue ?? 0));
  const [usageLimitTotal, setUsageLimitTotal] = useState(
    initial?.usageLimitTotal != null ? String(initial.usageLimitTotal) : '',
  );
  const [usageLimitPerUser, setUsageLimitPerUser] = useState(String(initial?.usageLimitPerUser ?? 1));
  const [startsAt, setStartsAt] = useState(toDateInputValue(initial?.startsAt ?? null));
  const [expiresAt, setExpiresAt] = useState(toDateInputValue(initial?.expiresAt ?? null));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const input: CouponInput = {
        ...(initial ? {} : { code }),
        discountType,
        discountValue: Number(discountValue),
        minOrderValue: Number(minOrderValue) || 0,
        usageLimitTotal: usageLimitTotal ? Number(usageLimitTotal) : null,
        usageLimitPerUser: Number(usageLimitPerUser) || 1,
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        isActive,
      };
      await onSubmit(input);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save coupon.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={sharedStyles.cardPadded}>
      <div className={sharedStyles.formGrid2}>
        <label className={sharedStyles.field}>
          Code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={!!initial}
            required
            placeholder="e.g. WELCOME10"
          />
        </label>
        <label className={sharedStyles.field}>
          Discount Type
          <select value={discountType} onChange={(e) => setDiscountType(e.target.value as 'PERCENT' | 'FLAT')}>
            <option value="PERCENT">Percent</option>
            <option value="FLAT">Flat</option>
          </select>
        </label>
        <label className={sharedStyles.field}>
          Discount Value {discountType === 'PERCENT' ? '(%)' : '(₹)'}
          <input
            type="number"
            min="0"
            step="0.01"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            required
          />
        </label>
        <label className={sharedStyles.field}>
          Minimum Order Value (₹)
          <input type="number" min="0" step="0.01" value={minOrderValue} onChange={(e) => setMinOrderValue(e.target.value)} />
        </label>
        <label className={sharedStyles.field}>
          Total Usage Limit (blank = unlimited)
          <input
            type="number"
            min="1"
            value={usageLimitTotal}
            onChange={(e) => setUsageLimitTotal(e.target.value)}
          />
        </label>
        <label className={sharedStyles.field}>
          Usage Limit Per User
          <input
            type="number"
            min="1"
            value={usageLimitPerUser}
            onChange={(e) => setUsageLimitPerUser(e.target.value)}
          />
        </label>
        <label className={sharedStyles.field}>
          Starts At (optional)
          <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </label>
        <label className={sharedStyles.field}>
          Expires At (optional)
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </label>
      </div>
      <label className={`${sharedStyles.field} ${sharedStyles.checkboxField} ${sharedStyles.formSection}`}>
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Active
      </label>
      {error && <p className={sharedStyles.error}>{error}</p>}
      <div className={sharedStyles.formActions}>
        <button type="submit" className={sharedStyles.buttonPrimary} disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className={sharedStyles.button} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function CouponsListPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-coupons'], queryFn: () => fetchAdminCoupons() });
  const [mode, setMode] = useState<Mode>({ type: 'none' });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });

  const createMutation = useMutation({
    mutationFn: (input: CouponInput) => createCoupon(input),
    onSuccess: () => {
      invalidate();
      setMode({ type: 'none' });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CouponInput }) => updateCoupon(id, input),
    onSuccess: () => {
      invalidate();
      setMode({ type: 'none' });
    },
  });

  if (isLoading) return <p>Loading…</p>;
  const coupons = data?.coupons ?? [];

  return (
    <div>
      <div className={sharedStyles.pageHeader}>
        <h1 className={sharedStyles.pageTitle}>Coupons</h1>
        {mode.type === 'none' && (
          <button type="button" className={sharedStyles.buttonPrimary} onClick={() => setMode({ type: 'add' })}>
            Add Coupon
          </button>
        )}
      </div>

      {mode.type === 'add' && (
        <div className={styles.formWrapper}>
          <CouponForm onSubmit={(input) => createMutation.mutateAsync(input)} onCancel={() => setMode({ type: 'none' })} />
        </div>
      )}
      {mode.type === 'edit' && (
        <div className={styles.formWrapper}>
          <CouponForm
            initial={mode.coupon}
            onSubmit={(input) => updateMutation.mutateAsync({ id: mode.coupon.id, input })}
            onCancel={() => setMode({ type: 'none' })}
          />
        </div>
      )}

      <div className={sharedStyles.card}>
        {coupons.length === 0 && <p className={sharedStyles.empty}>No coupons yet.</p>}
        {coupons.length > 0 && (
          <table className={sharedStyles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Min Order</th>
                <th>Usage</th>
                <th>Window</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id}>
                  <td className={styles.code}>{coupon.code}</td>
                  <td>
                    {coupon.discountType === 'PERCENT' ? `${coupon.discountValue}%` : formatPrice(coupon.discountValue)}
                  </td>
                  <td>{formatPrice(coupon.minOrderValue)}</td>
                  <td>
                    {coupon.usageLimitPerUser}/user{coupon.usageLimitTotal ? ` · ${coupon.usageLimitTotal} total` : ''}
                  </td>
                  <td className={styles.window}>
                    {coupon.startsAt ? new Date(coupon.startsAt).toLocaleDateString('en-IN') : '—'}
                    {' → '}
                    {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString('en-IN') : 'no end'}
                  </td>
                  <td>
                    <span className={coupon.isActive ? sharedStyles.badgeSuccess : sharedStyles.badgeNeutral}>
                      {coupon.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={sharedStyles.buttonLink}
                      onClick={() => setMode({ type: 'edit', coupon })}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
