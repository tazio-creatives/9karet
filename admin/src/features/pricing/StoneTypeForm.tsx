import { useState, type FormEvent } from 'react';
import type { StoneType } from '../../api/types';
import { ApiError } from '../../api/client';
import sharedStyles from '../../styles/shared.module.css';

interface StoneTypeFormProps {
  initial?: StoneType;
  onSubmit: (input: { name: string; sortOrder: number; isActive: boolean }) => Promise<unknown>;
  onCancel: () => void;
}

export function StoneTypeForm({ initial, onSubmit, onCancel }: StoneTypeFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({ name, sortOrder, isActive });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save stone type.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={sharedStyles.cardPadded}>
      <div className={sharedStyles.formGrid}>
        <label className={sharedStyles.field}>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ruby" required />
        </label>
        <label className={sharedStyles.field}>
          Sort Order
          <input type="number" step="1" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
        </label>
        <label className={`${sharedStyles.field} ${sharedStyles.checkboxField}`}>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>
      </div>

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
