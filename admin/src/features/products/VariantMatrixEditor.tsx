import { useEffect } from 'react';
import type { GoldColor, Purity, VariantOverrideInput } from '../../api/types';
import sharedStyles from '../../styles/shared.module.css';
import styles from './VariantMatrixEditor.module.css';

type AttributeValues = VariantOverrideInput['attributeValues'];

function comboKey(av: AttributeValues): string {
  return [av.goldColor ?? '', av.purity ?? '', av.sizeLabel ?? ''].join('|');
}

function cartesian(lists: AttributeValues[][]): AttributeValues[] {
  return lists.reduce<AttributeValues[]>(
    (acc, list) => acc.flatMap((combo) => list.map((part) => ({ ...combo, ...part }))),
    [{}],
  );
}

interface VariantMatrixEditorProps {
  goldColors: GoldColor[];
  purities: Purity[];
  goldColorLabels: Record<GoldColor, string>;
  sizeLabels: string[];
  value: VariantOverrideInput[];
  onChange: (next: VariantOverrideInput[]) => void;
}

// Client-side preview of the exact variant matrix syncProductVariants will
// generate server-side from the same axes — lets a brand-new product be
// fully configured (starting stock, and optionally a different gold weight
// per combination) in the same save that picks Gold Colors/Sizes, instead
// of a separate trip into the per-product variant
// editor afterward. Only used on the Add Product (create) flow; editing an
// existing product's combinations happens on that dedicated page, which
// also shows each row's live price.
export function VariantMatrixEditor({
  goldColors,
  purities,
  goldColorLabels,
  sizeLabels,
  value,
  onChange,
}: VariantMatrixEditorProps) {
  const axisLists: AttributeValues[][] = [];
  if (goldColors.length) axisLists.push(goldColors.map((v) => ({ goldColor: v })));
  if (purities.length) axisLists.push(purities.map((v) => ({ purity: v })));
  if (sizeLabels.length) axisLists.push(sizeLabels.map((v) => ({ sizeLabel: v })));

  const combos = axisLists.length === 0 ? [] : cartesian(axisLists);
  const axisSignature = [goldColors.join(','), purities.join(','), sizeLabels.join(',')].join('|');

  // Reconcile the draft list whenever the checked axes change: keep the
  // existing draft for a combination that's still valid (preserves whatever
  // the admin already typed into it), seed a default draft for a newly
  // possible combination, and drop drafts for combinations no longer
  // possible.
  useEffect(() => {
    const byKey = new Map(value.map((o) => [comboKey(o.attributeValues), o]));
    const next = combos.map((attributeValues) => {
      const key = comboKey(attributeValues);
      return (
        byKey.get(key) ?? {
          attributeValues,
          stockQuantity: 0,
          goldWeightGrams: null,
          isAvailable: true,
        }
      );
    });
    const changed =
      next.length !== value.length || next.some((o, i) => comboKey(o.attributeValues) !== comboKey(value[i].attributeValues));
    if (changed) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axisSignature]);

  function updateDraft(index: number, patch: Partial<VariantOverrideInput>) {
    onChange(value.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }

  // Purity is always 9K, so it's only named when it's the sole axis.
  function labelFor(av: AttributeValues): string {
    const label = [av.goldColor ? goldColorLabels[av.goldColor] : undefined, av.sizeLabel ? `Size ${av.sizeLabel}` : undefined]
      .filter(Boolean)
      .join(' / ');
    return label || (av.purity ?? '');
  }

  if (combos.length === 0) return null;

  return (
    <div className={styles.wrap}>
      <p className={styles.subtext}>
        {combos.length} combination{combos.length === 1 ? '' : 's'} will be created when you save. Set starting
        stock here, and optionally a different gold weight for any combination — leave weight blank to inherit the
        product's base weight. You can fine-tune these later from the product's Variants page.
      </p>
      <table className={sharedStyles.table}>
        <thead>
          <tr>
            <th>Combination</th>
            <th>Stock</th>
            <th>Gold Weight (g)</th>
            <th>Available</th>
          </tr>
        </thead>
        <tbody>
          {value.map((draft, i) => (
            <tr key={comboKey(draft.attributeValues)}>
              <td>{labelFor(draft.attributeValues)}</td>
              <td>
                <input
                  type="number"
                  min={0}
                  className={styles.cellInput}
                  value={draft.stockQuantity ?? 0}
                  onChange={(e) => updateDraft(i, { stockQuantity: Number(e.target.value) || 0 })}
                />
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  step="0.001"
                  placeholder="inherit"
                  className={styles.cellInput}
                  value={draft.goldWeightGrams ?? ''}
                  onChange={(e) =>
                    updateDraft(i, { goldWeightGrams: e.target.value.trim() === '' ? null : Number(e.target.value) })
                  }
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={draft.isAvailable ?? true}
                  onChange={(e) => updateDraft(i, { isAvailable: e.target.checked })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
