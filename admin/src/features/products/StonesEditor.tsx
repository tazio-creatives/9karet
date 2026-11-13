import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createStoneType, fetchStoneTypes } from '../../api/stoneTypes';
import { ApiError } from '../../api/client';
import { formatPrice } from '../../utils/formatPrice';
import pv from './ProductVariations.module.css';
import styles from './StonesEditor.module.css';

// One editable stone line. Numbers are kept as the raw input strings while
// editing (so a field can be cleared without snapping to 0) and converted
// once, in toStoneInputs, when the product is saved.
export interface StoneDraft {
  stoneTypeId: string;
  count: string;
  weightCarats: string;
  price: string;
}

export const EMPTY_STONE: StoneDraft = { stoneTypeId: '', count: '1', weightCarats: '', price: '' };

// 1 ct = 0.2 g — gemstone weight adds into the piece's gross weight.
export const GRAMS_PER_CARAT = 0.2;

function isBlank(d: StoneDraft) {
  return !d.stoneTypeId && !d.weightCarats.trim() && !d.price.trim();
}

// Validates and converts the draft rows for the save payload. Fully blank
// rows (e.g. "+ Add Stone" clicked and left empty) are dropped; a half-filled
// row is an error rather than silently discarded.
export function toStoneInputs(drafts: StoneDraft[]) {
  const stones = [];
  for (const [i, d] of drafts.entries()) {
    if (isBlank(d)) continue;
    const count = Number(d.count);
    const weightCarats = Number(d.weightCarats);
    const price = Number(d.price);
    if (!d.stoneTypeId) return { error: `Stone ${i + 1}: choose a stone type.` };
    if (!Number.isInteger(count) || count < 1) return { error: `Stone ${i + 1}: count must be at least 1.` };
    if (!(weightCarats > 0)) return { error: `Stone ${i + 1}: enter the weight in carats.` };
    if (d.price.trim() === '' || !(price >= 0)) return { error: `Stone ${i + 1}: enter the price.` };
    stones.push({ stoneTypeId: d.stoneTypeId, count, weightCarats, price });
  }
  return { stones };
}

export function stoneTotals(drafts: StoneDraft[]) {
  return drafts.reduce(
    (acc, d) => ({
      carats: acc.carats + (Number(d.weightCarats) || 0),
      price: acc.price + (Number(d.price) || 0),
    }),
    { carats: 0, price: 0 },
  );
}

interface StonesEditorProps {
  value: StoneDraft[];
  onChange: (next: StoneDraft[]) => void;
}

// The piece's gemstones — each line a type from Stone Types (Pricing →
// Rates & Stones) with its count, total weight and price, all entered by
// hand. A missing type can be added right here without leaving the form.
export function StonesEditor({ value, onChange }: StonesEditorProps) {
  const queryClient = useQueryClient();
  const [newTypeName, setNewTypeName] = useState('');
  const [showNewType, setShowNewType] = useState(false);
  const [typeError, setTypeError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['admin-stone-types-active'],
    queryFn: () => fetchStoneTypes({ activeOnly: true }),
  });
  const stoneTypes = data?.stoneTypes ?? [];

  const createTypeMutation = useMutation({
    mutationFn: (name: string) => createStoneType({ name }),
    onSuccess: async ({ stoneType }) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-stone-types-active'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stone-types'] });
      setNewTypeName('');
      setShowNewType(false);
      setTypeError(null);
      // Drop the new type straight into the first row still waiting for one,
      // or start a new row with it.
      const emptyIndex = value.findIndex((d) => !d.stoneTypeId);
      if (emptyIndex >= 0) update(emptyIndex, { stoneTypeId: stoneType.id });
      else onChange([...value, { ...EMPTY_STONE, stoneTypeId: stoneType.id }]);
    },
    onError: (err) => setTypeError(err instanceof ApiError ? err.message : 'Could not add stone type.'),
  });

  function update(index: number, patch: Partial<StoneDraft>) {
    onChange(value.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  const totals = stoneTotals(value);

  return (
    <div className={pv.optionsBlock}>
      {value.length === 0 ? (
        <p className={pv.emptyNote}>No stones — plain 9K gold. Add a line for each kind of stone set in the piece.</p>
      ) : (
        <div className={pv.sizeTableWrap}>
          <table className={pv.sizeTable}>
            <thead>
              <tr>
                <th>Stone Type</th>
                <th>Count</th>
                <th>Weight (ct)</th>
                <th>Price (₹)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {value.map((d, i) => (
                <tr key={i}>
                  <td>
                    <select
                      className={styles.typeSelect}
                      value={d.stoneTypeId}
                      onChange={(e) => update(i, { stoneTypeId: e.target.value })}
                    >
                      <option value="">Choose…</option>
                      {stoneTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={d.count}
                      onChange={(e) => update(i, { count: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      placeholder="e.g. 0.25"
                      value={d.weightCarats}
                      onChange={(e) => update(i, { weightCarats: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 1500"
                      value={d.price}
                      onChange={(e) => update(i, { price: e.target.value })}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className={pv.sizeRemoveBtn}
                      onClick={() => onChange(value.filter((_, j) => j !== i))}
                      aria-label={`Remove stone ${i + 1}`}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={styles.totalRow}>
                <td>Total</td>
                <td></td>
                <td>
                  {totals.carats.toFixed(3)} ct
                  <span className={styles.totalHint}> ≈ {(totals.carats * GRAMS_PER_CARAT).toFixed(3)} g</span>
                </td>
                <td>{formatPrice(totals.price)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className={styles.toolbar}>
        <button type="button" className={pv.chipAdd} onClick={() => onChange([...value, { ...EMPTY_STONE }])}>
          + Add Stone
        </button>
        {!showNewType ? (
          <button type="button" className={styles.linkButton} onClick={() => setShowNewType(true)}>
            + New stone type
          </button>
        ) : (
          <div className={pv.ruleAddRow}>
            <input
              className={styles.newTypeInput}
              value={newTypeName}
              placeholder="e.g. Amethyst"
              autoFocus
              onChange={(e) => setNewTypeName(e.target.value)}
              onKeyDown={(e) => {
                // Enter must not submit the whole product form.
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (newTypeName.trim()) createTypeMutation.mutate(newTypeName.trim());
                }
              }}
            />
            <button
              type="button"
              className={pv.ruleAddBtn}
              disabled={!newTypeName.trim() || createTypeMutation.isPending}
              onClick={() => createTypeMutation.mutate(newTypeName.trim())}
            >
              {createTypeMutation.isPending ? 'Adding…' : 'Add Type'}
            </button>
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => {
                setShowNewType(false);
                setNewTypeName('');
                setTypeError(null);
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      {typeError && <p className={styles.error}>{typeError}</p>}
    </div>
  );
}
