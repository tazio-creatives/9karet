import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { REAL_JEWELLERY_TYPES, type JewelleryType } from '../../api/aiStudio';
import { fetchProductSizeMeasurements } from '../../api/productSizeImage';
import { inferJewelleryTypeFromCategory } from './generationRules';
import { ManualMeasurementsForm } from './ManualMeasurementsForm';
import sharedStyles from '../../styles/shared.module.css';

function formatType(type: string) {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatGeneratedAt(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

const STATUS_LABEL: Record<string, string> = {
  generating: 'Generating…',
  passed: 'Passed',
  warning: 'Passed (with a minor note)',
  failed: 'Needs Regeneration',
  stale: 'Measurements changed — regeneration required',
};

// Reachable for ANY existing product, independent of whether an AI Studio
// wizard session is open — this is what lets an admin fix a measurement (or
// generate a size image for the first time) on an already-published
// product without restarting the whole wizard (plan point 2). Renders the
// same ManualMeasurementsForm the wizard's 'measurements' sub-step uses, and
// calls the exact same backend endpoints.
export function ProductSizeImagePanel({ productId, categoryName }: { productId: string; categoryName: string | null }) {
  const queryClient = useQueryClient();
  const queryKey = ['product-size-measurements', productId];
  const { data } = useQuery({
    queryKey,
    queryFn: () => fetchProductSizeMeasurements(productId),
    enabled: !!productId,
    // Generation runs in a background job — poll while it's in flight so
    // the status/failure reason update on their own instead of staying on
    // "Generating…" until the admin happens to navigate away and back.
    refetchInterval: (query) => (query.state.data?.generatedImage?.status === 'generating' ? 2000 : false),
  });

  const inferred = inferJewelleryTypeFromCategory(categoryName);
  const [selectedType, setSelectedType] = useState<JewelleryType | ''>('');
  const jewelleryType = selectedType || data?.measurements?.jewelleryType || inferred || '';

  const generatedImage = data?.generatedImage ?? null;

  return (
    <section className={sharedStyles.cardPadded}>
      <h2 className={sharedStyles.pageTitle} style={{ fontSize: 18 }}>
        Product Size Image
      </h2>
      <p className={sharedStyles.empty}>
        Optional size-guide image with a ruler overlay, built from measurements you enter — never estimated by AI.
      </p>

      <label className={sharedStyles.field} style={{ maxWidth: 320, marginTop: 12 }}>
        Product Category (for measurement fields)
        <select value={jewelleryType} onChange={(e) => setSelectedType(e.target.value as JewelleryType)}>
          <option value="">— Select —</option>
          {REAL_JEWELLERY_TYPES.map((t) => (
            <option key={t} value={t}>
              {formatType(t)}
            </option>
          ))}
        </select>
      </label>

      {generatedImage && (
        <p className={generatedImage.status === 'passed' ? sharedStyles.badgeSuccess : sharedStyles.badgeNeutral} style={{ display: 'inline-block', marginTop: 10 }}>
          {STATUS_LABEL[generatedImage.status] ?? generatedImage.status}
        </p>
      )}
      {generatedImage?.generatedAt && (
        // Shown even when status is now 'stale' (measurements were edited
        // since) or 'failed' (a regeneration attempt since failed) — this
        // is when the image CURRENTLY being previewed below was actually
        // produced, which the status label alone doesn't tell the admin.
        <p className={sharedStyles.empty} style={{ marginTop: 4 }}>
          Last generated: {formatGeneratedAt(generatedImage.generatedAt)}
        </p>
      )}
      {generatedImage?.failureReason &&
        (generatedImage.status === 'warning' ? (
          // A usable image with a review note (e.g. Pendant proportion check).
          <p className={sharedStyles.empty} style={{ marginTop: 4 }}>
            Review note: {generatedImage.failureReason}
          </p>
        ) : (
          <p className={sharedStyles.error}>{generatedImage.failureReason}</p>
        ))}
      {generatedImage?.imageUrl && (
        <img
          src={generatedImage.imageUrl}
          alt="Product Size Image preview"
          style={{ display: 'block', width: 220, height: 220, objectFit: 'contain', marginTop: 10, border: '1px solid #e2e2e2', borderRadius: 8 }}
        />
      )}

      {jewelleryType && (
        <div style={{ marginTop: 12 }}>
          <ManualMeasurementsForm
            productId={productId}
            jewelleryType={jewelleryType}
            initial={data?.measurements}
            onSaved={() => queryClient.invalidateQueries({ queryKey })}
            onGenerating={() => queryClient.invalidateQueries({ queryKey })}
          />
        </div>
      )}
    </section>
  );
}
