import { useEffect, useState } from 'react';
import type { Purity, WeightRulesInput } from '../../api/types';
import styles from './ProductVariations.module.css';

function draftsFromValue(value: WeightRulesInput) {
  const purityDrafts: Record<string, string> = {};
  const matrixDrafts: Record<string, string> = {};
  for (const rule of value.purityRules) purityDrafts[rule.purity] = String(rule.goldWeightGrams);
  for (const rule of value.puritySizeRules) {
    matrixDrafts[`${rule.purity}|${rule.sizeLabel}`] = String(rule.goldWeightGrams);
  }
  return { purityDrafts, matrixDrafts };
}

function valueFromDrafts(purityDrafts: Record<string, string>, matrixDrafts: Record<string, string>): WeightRulesInput {
  const purityRules = Object.entries(purityDrafts)
    .filter(([, v]) => v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) > 0)
    .map(([purity, v]) => ({ purity: purity as Purity, goldWeightGrams: Number(v) }));
  const puritySizeRules = Object.entries(matrixDrafts)
    .filter(([, v]) => v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) > 0)
    .map(([key, v]) => {
      const [purity, sizeLabel] = key.split('|');
      return { purity: purity as Purity, sizeLabel, goldWeightGrams: Number(v) };
    });
  return { purityRules, puritySizeRules };
}

interface WeightDefaultsProps {
  purities: Purity[];
  sizes: { label: string }[];
  value: WeightRulesInput;
  onChange: (_next: WeightRulesInput) => void;
}

// Weight resolution hierarchy — lets an admin declare "this size weighs
// differently" as a live default, without hand-editing every exact
// combination. Priority, most specific wins: a Purity+Size default here >
// a Purity-only default >
// a combination's own legacy weight (set in Advanced Variant Management, or
// seeded from the old Size-level weight field) > the product's base weight.
//
// Fully controlled — driven by `purities`/`sizes` (the product form's own
// unsaved selections, not a saved product's attributes) and `value`/
// `onChange` (the draft rule set, held by ProductFormPage alongside the rest
// of the form). No fetch, no save button, no product id required: this
// renders identically whether the product exists yet or not, so the grid
// appears the instant a purity/size is picked, before the first Save.
export function WeightDefaults({ purities, sizes, value, onChange }: WeightDefaultsProps) {
  const sizeLabels = sizes.map((s) => s.label.trim()).filter(Boolean);
  const axisSignature = `${purities.join(',')}|${sizeLabels.join(',')}`;

  const [purityDrafts, setPurityDrafts] = useState<Record<string, string>>({});
  const [matrixDrafts, setMatrixDrafts] = useState<Record<string, string>>({});

  // Reconciles local drafts whenever the checked purities/sizes change OR
  // the saved `value` itself changes: seed from the incoming `value` (so
  // hydrating an existing product, or the response of a just-completed
  // Save, pre-fills correctly), preserve whatever's already typed for a
  // combination that's still valid, and drop drafts for combinations no
  // longer possible — mirrors VariantMatrixEditor's reconciliation.
  //
  // Depending on `value` too (not just `axisSignature`) matters because
  // ProductFormPage fetches the product (which sets purities/sizes) and the
  // saved weight rules (this `value`) as two independent, unordered network
  // requests. If the rules response lands AFTER purities/sizes have already
  // settled, axisSignature alone would never change again and this effect
  // would never re-run — silently leaving the saved rules out of the
  // visible inputs even though they loaded correctly. Re-running on every
  // `value` change is safe: the "prev ?? seeded" merge below always prefers
  // whatever's already typed, so an echo of the admin's own edit (value
  // changing because onChange just fired) reproduces the same drafts rather
  // than clobbering them.
  useEffect(() => {
    const seeded = draftsFromValue(value);
    setPurityDrafts((prev) => {
      const next: Record<string, string> = {};
      for (const p of purities) next[p] = prev[p] ?? seeded.purityDrafts[p] ?? '';
      return next;
    });
    setMatrixDrafts((prev) => {
      const next: Record<string, string> = {};
      for (const p of purities) {
        for (const s of sizeLabels) {
          const key = `${p}|${s}`;
          next[key] = prev[key] ?? seeded.matrixDrafts[key] ?? '';
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axisSignature, value]);

  function updateMatrixDraft(key: string, raw: string) {
    const next = { ...matrixDrafts, [key]: raw };
    setMatrixDrafts(next);
    onChange(valueFromDrafts(purityDrafts, next));
  }

  // 9Karet has the one 9K purity, so a purity-only default would just repeat
  // the product's Base Gold Weight — only the by-size weights are shown.
  // Purity-only drafts are still tracked above, so a saved one survives.
  if (purities.length === 0 || sizeLabels.length === 0) return null;

  return (
    <div className={styles.rulesPanel}>
      <span className={styles.advancedTitle}>Gold Weight by Size</span>
      <p className={styles.advancedSub} style={{ padding: 0, marginTop: 4 }}>
        A bigger size uses more gold — enter each size's gold weight, or leave it blank to use the base gold weight.
        Saved together with the rest of the product when you click Save Product.
      </p>

      <div className={styles.sizeTableWrap} style={{ marginTop: 12 }}>
        <table className={styles.sizeTable}>
          <thead>
            <tr>
              <th>Size</th>
              {purities.map((p) => (
                <th key={p}>Gold Weight (g)</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sizeLabels.map((s) => (
              <tr key={s}>
                <td>{s}</td>
                {purities.map((p) => {
                  const key = `${p}|${s}`;
                  return (
                    <td key={p}>
                      <input
                        type="number"
                        min={0}
                        step="0.001"
                        placeholder="uses base weight"
                        value={matrixDrafts[key] ?? ''}
                        onChange={(e) => updateMatrixDraft(key, e.target.value)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
