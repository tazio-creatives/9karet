import { useState, type FormEvent } from 'react';
import type { JewelleryType } from '../../api/aiStudio';
import type { ProductSizeMeasurements, ProductSizeMeasurementsInput, ProductSizeMeasurementsResponse } from '../../api/productSizeImage';
import { saveProductSizeMeasurements, generateProductSizeImage } from '../../api/productSizeImage';
import { ApiError } from '../../api/client';
import { fieldsForMeasurementForm, hasAtMostTwoDecimals, inclusionRuleFor, PENDANT_MESSAGES } from './measurementFields';
import sharedStyles from '../../styles/shared.module.css';

interface ManualMeasurementsFormProps {
  productId: string;
  jewelleryType: JewelleryType;
  initial?: ProductSizeMeasurements | null;
  onSaved: (_result: ProductSizeMeasurementsResponse) => void;
  onGenerating: () => void;
  onCancel?: () => void;
}

// Category field config comes from measurementFields.ts (mirrors the
// backend validator's shape exactly) — required fields, error strings and
// the "loop/hook/clasp inclusion + body/total pair" rule are all just
// re-validated here for immediate feedback; the backend re-validates the
// same rules regardless (never trust client-side validation alone).
export function ManualMeasurementsForm({ productId, jewelleryType, initial, onSaved, onGenerating, onCancel }: ManualMeasurementsFormProps) {
  // initial's own jewellery_type may not match the currently-confirmed
  // category (a saved form from a prior, different category confirmation) —
  // discard the pre-fill in that case rather than showing mismatched fields.
  const matchesCategory = initial?.jewelleryType === jewelleryType;
  const [unit, setUnit] = useState<'mm' | 'cm'>(matchesCategory ? initial!.unit : 'mm');
  const [values, setValues] = useState<Record<string, string>>(() => {
    if (!matchesCategory) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(initial!.measurements)) out[k] = String(v);
    return out;
  });
  const inclusionRule = inclusionRuleFor(jewelleryType);
  const [inclusionChoice, setInclusionChoice] = useState<'included' | 'excluded' | ''>(() => {
    if (!matchesCategory || !inclusionRule) return '';
    if (initial!.includedParts.includes(inclusionRule.part)) return 'included';
    if (initial!.excludedParts.includes(inclusionRule.part)) return 'excluded';
    return '';
  });
  const [note, setNote] = useState(matchesCategory ? (initial!.note ?? '') : '');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const fields = fieldsForMeasurementForm(jewelleryType, inclusionChoice);

  // A Pendant saved before the overall-height field existed: its saved height
  // is never reused silently — the admin is told and must enter the overall
  // height before regenerating. The current image stays live until then.
  const legacyPendantHeight =
    matchesCategory &&
    jewelleryType === 'PENDANT' &&
    initial!.measurements.pendantOverallHeight == null &&
    initial!.measurements.pendantBodyHeight != null
      ? initial!.measurements.pendantBodyHeight
      : null;

  function buildInput(): ProductSizeMeasurementsInput {
    const measurements: Record<string, number | string> = {};
    for (const field of fields) {
      const raw = values[field.key];
      if (raw == null || raw === '') continue;
      measurements[field.key] = field.type === 'number' ? Number(raw) : raw;
    }
    const includedParts = inclusionRule && inclusionChoice === 'included' ? [inclusionRule.part] : [];
    const excludedParts = inclusionRule && inclusionChoice === 'excluded' ? [inclusionRule.part] : [];
    return { jewelleryType, unit, measurements, includedParts, excludedParts, note: note || null };
  }

  function validateClientSide(input: ProductSizeMeasurementsInput, forGeneration: boolean): string | null {
    const numberFields = fields.filter((f) => f.type === 'number' && input.measurements[f.key] != null);
    if (numberFields.length === 0) return 'Enter at least one measurement.';
    for (const field of numberFields) {
      const value = Number(input.measurements[field.key]);
      if (!(value > 0) || !Number.isFinite(value) || !hasAtMostTwoDecimals(value)) {
        return `Enter a valid ${field.label.toLowerCase()}.`;
      }
    }
    if (inclusionRule) {
      if (input.includedParts.length === 0 && input.excludedParts.length === 0) {
        return `Choose whether the ${inclusionRule.label.toLowerCase()} is included.`;
      }
      if (inclusionRule.partHeightKey && inclusionRule.wholeHeightKey) {
        // Pendant: saving may be partial; generating needs every value the
        // ruler uses. Mirrors the backend validator.
        const body = input.measurements[inclusionRule.partHeightKey];
        const overall = input.measurements[inclusionRule.wholeHeightKey];
        if (body != null && overall != null && Number(body) >= Number(overall)) return PENDANT_MESSAGES.bodyNotSmaller;
        if (forGeneration) {
          if (overall == null) return PENDANT_MESSAGES.overallRequired;
          if (input.excludedParts.length > 0 && body == null) return PENDANT_MESSAGES.bodyRequired;
        }
      }
    }
    return null;
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const input = buildInput();
    const clientError = validateClientSide(input, false);
    if (clientError) {
      setError(clientError);
      return;
    }
    setIsSaving(true);
    try {
      const result = await saveProductSizeMeasurements(productId, input);
      onSaved(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save measurements.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleGenerate() {
    setError(null);
    const input = buildInput();
    const clientError = validateClientSide(input, true);
    if (clientError) {
      setError(clientError);
      return;
    }
    setIsGenerating(true);
    try {
      await generateProductSizeImage(productId, input);
      onGenerating();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start generation.');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <form onSubmit={handleSave} className={sharedStyles.cardPadded}>
      <p className={sharedStyles.error} style={!matchesCategory && initial ? undefined : { display: 'none' }}>
        Previously saved measurements were for a different category and have been cleared.
      </p>
      {legacyPendantHeight != null && (
        <p className={sharedStyles.error}>
          These measurements were saved before the overall-height field existed. The saved height ({String(legacyPendantHeight)}{' '}
          {unit}) is not reused automatically — enter the Overall pendant height (loop included)
          {inclusionChoice === 'excluded' ? ' and confirm the Pendant body height (loop excluded)' : ''} before regenerating.
          The current size image stays live until you regenerate.
        </p>
      )}

      <div className={`${sharedStyles.formGrid} ${sharedStyles.formSection}`}>
        <label className={sharedStyles.field}>
          Measurement Unit
          <select value={unit} onChange={(e) => setUnit(e.target.value as 'mm' | 'cm')}>
            <option value="mm">mm</option>
            <option value="cm">cm</option>
          </select>
        </label>
      </div>

      <div className={`${sharedStyles.formGrid} ${sharedStyles.formSection}`}>
        {fields.map((field) => (
          <label className={sharedStyles.field} key={field.key}>
            {field.label}
            <input
              type={field.type === 'number' ? 'number' : 'text'}
              step={field.type === 'number' ? '0.01' : undefined}
              min={field.type === 'number' ? '0.01' : undefined}
              value={values[field.key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
            />
          </label>
        ))}
      </div>

      {inclusionRule && (
        <div className={`${sharedStyles.formGrid} ${sharedStyles.formSection}`}>
          <label className={sharedStyles.field}>
            Measurement Includes
            <select value={inclusionChoice} onChange={(e) => setInclusionChoice(e.target.value as 'included' | 'excluded' | '')}>
              <option value="">— Select —</option>
              <option value="included">{inclusionRule.label} included</option>
              <option value="excluded">{inclusionRule.label} excluded</option>
            </select>
          </label>
        </div>
      )}

      <label className={`${sharedStyles.field} ${sharedStyles.formSection}`}>
        Measurement Note (optional)
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </label>

      {error && <p className={sharedStyles.error}>{error}</p>}

      <div className={sharedStyles.formActions}>
        <button type="submit" className={sharedStyles.button} disabled={isSaving || isGenerating}>
          {isSaving ? 'Saving…' : 'Save Measurements'}
        </button>
        <button
          type="button"
          className={sharedStyles.buttonPrimary}
          disabled={isSaving || isGenerating}
          onClick={handleGenerate}
        >
          {isGenerating ? 'Starting…' : 'Generate Size Image'}
        </button>
        {onCancel && (
          <button type="button" className={sharedStyles.buttonLink} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
