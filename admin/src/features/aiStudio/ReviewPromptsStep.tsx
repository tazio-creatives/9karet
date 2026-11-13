import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchPromptPreview,
  type CustomerCategory,
  type JewelleryType,
  type PromptOverrides,
  type PromptCreativeOverride,
} from '../../api/aiStudio';
import { SHOT_LABELS } from './generationRules';
import sharedStyles from '../../styles/shared.module.css';
import styles from './ReviewPromptsStep.module.css';

function formatType(type: string) {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// Ring never reaches this step (generation starts immediately after category
// confirmation for Ring jobs — see AiImageStudioPage.tsx), so these fields
// only ever describe the generic Yellow/Rose/Presenter asset types.
const CREATIVE_FIELDS: { key: keyof PromptCreativeOverride; label: string }[] = [
  { key: 'background', label: 'Background' },
  { key: 'lighting', label: 'Lighting' },
  { key: 'composition', label: 'Composition' },
  { key: 'presenterPose', label: 'Presenter Pose' },
  { key: 'cameraAngle', label: 'Camera Angle' },
  { key: 'additionalInstructions', label: 'Additional Safe Instructions' },
];

interface ReviewPromptsStepProps {
  productId: string;
  jobId: string;
  jewelleryType: Exclude<JewelleryType, 'UNKNOWN'>;
  presenterId: string | null;
  presenterName: string | null;
  generateRoseGold: boolean;
  promptOverrides: PromptOverrides;
  onPromptOverridesChange: (_v: PromptOverrides) => void;
  customerCategory: CustomerCategory | '';
}

// "Review Prompts" — the third Choose-Presenter sub-screen. Only ever
// previews prompts (fetchPromptPreview writes nothing, starts nothing); the
// actual image-generation request only goes out once the admin clicks
// "Confirm & Generate" on the page below.
export function ReviewPromptsStep({
  productId,
  jobId,
  jewelleryType,
  presenterId,
  presenterName,
  generateRoseGold,
  promptOverrides,
  onPromptOverridesChange,
  customerCategory,
}: ReviewPromptsStepProps) {
  const [expandedAssetType, setExpandedAssetType] = useState<string | null>(null);

  // promptOverrides changes on every keystroke in a creative field — without
  // debouncing, each one would refetch immediately, briefly emptying
  // `prompts` and unmounting/remounting every card (including whichever
  // textarea the admin is actively typing in), kicking them out mid-word.
  const [debouncedOverrides, setDebouncedOverrides] = useState(promptOverrides);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedOverrides(promptOverrides), 500);
    return () => clearTimeout(timer);
  }, [promptOverrides]);

  const { data, isFetching, isError } = useQuery({
    queryKey: [
      'ai-studio-prompt-preview',
      productId,
      jobId,
      jewelleryType,
      presenterId,
      generateRoseGold,
      debouncedOverrides,
      customerCategory,
    ],
    queryFn: () =>
      fetchPromptPreview(productId, jobId, {
        jewelleryType,
        presenterId,
        generateRoseGold,
        promptOverrides: debouncedOverrides,
        customerCategory: customerCategory || undefined,
      }),
    placeholderData: (previousData) => previousData,
  });
  const prompts = data?.prompts ?? [];

  // Turns customising on for a card even before any field has a value —
  // must not go through resetToRecommended's "drop empty overrides" logic,
  // or the card would immediately snap back to Recommended.
  function startCustomising(assetType: string) {
    onPromptOverridesChange({ ...promptOverrides, [assetType]: promptOverrides[assetType] ?? {} });
  }

  function updateOverrideField(assetType: string, key: keyof PromptCreativeOverride, value: string) {
    const current = promptOverrides[assetType] ?? {};
    onPromptOverridesChange({ ...promptOverrides, [assetType]: { ...current, [key]: value } });
  }

  function resetToRecommended(assetType: string) {
    const next = { ...promptOverrides };
    delete next[assetType];
    onPromptOverridesChange(next);
  }

  return (
    <div>
      <p>
        Review the exact prompt for every planned image before generating. Use the recommended prompt, or customise
        the creative fields only — the product, category, and safety rules always stay locked.
      </p>

      {isFetching && prompts.length === 0 && <p>Loading prompt previews…</p>}
      {isError && <p className={sharedStyles.error}>Could not load prompt previews — try again.</p>}

      <div className={styles.grid}>
        {prompts.map((p) => {
          const override = promptOverrides[p.assetType];
          const isCustomising = !!override;
          const isExpanded = expandedAssetType === p.assetType;
          const cardTitle = SHOT_LABELS[p.assetType];
          return (
            <div key={p.assetType} className={styles.card}>
              <div className={styles.cardHeader}>
                <p className={styles.cardTitle}>{cardTitle}</p>
                <span className={p.mode === 'customised' ? sharedStyles.badgeWarning : sharedStyles.badgeSuccess}>
                  {p.mode === 'customised' ? 'Customised' : 'Recommended'}
                </span>
              </div>
              <p className={styles.cardMeta}>
                {formatType(jewelleryType)} · {p.metalColor === 'ROSE' ? 'Rose' : 'Yellow'} Gold
                {p.assetType.startsWith('PRESENTER_') && presenterName ? ` · ${presenterName}` : ''}
              </p>

              <div className={styles.modeToggle}>
                <button
                  type="button"
                  className={!isCustomising ? sharedStyles.buttonPrimary : sharedStyles.button}
                  onClick={() => resetToRecommended(p.assetType)}
                >
                  Use Recommended
                </button>
                <button
                  type="button"
                  className={isCustomising ? sharedStyles.buttonPrimary : sharedStyles.button}
                  onClick={() => startCustomising(p.assetType)}
                >
                  Customise Prompt
                </button>
              </div>

              {isCustomising && (
                <div className={styles.creativeFields}>
                  {CREATIVE_FIELDS.map(({ key, label }) => (
                    <label key={key} className={sharedStyles.field}>
                      {label}
                      <textarea
                        rows={4}
                        placeholder={p.creativeInstructions[key] || undefined}
                        value={override?.[key] ?? ''}
                        onChange={(e) => updateOverrideField(p.assetType, key, e.target.value)}
                      />
                    </label>
                  ))}
                  <button
                    type="button"
                    className={sharedStyles.buttonLink}
                    onClick={() => resetToRecommended(p.assetType)}
                  >
                    Reset to Recommended
                  </button>
                </div>
              )}

              <button
                type="button"
                className={sharedStyles.buttonLink}
                onClick={() => setExpandedAssetType(isExpanded ? null : p.assetType)}
              >
                {isExpanded ? 'Hide Final Prompt' : 'Preview Final Prompt'}
              </button>

              {isExpanded && (
                <div className={styles.promptPreview}>
                  <PromptSection title="Locked Product Rules" items={p.lockedProductRules} />
                  {p.categoryPlacementRules.length > 0 && (
                    <PromptSection title="Category Placement Rules" items={p.categoryPlacementRules} />
                  )}
                  <PromptSection title="Creative Instructions" items={Object.values(p.creativeInstructions).filter(Boolean)} />
                  <PromptSection title="Negative Instructions" items={p.negativeInstructions} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PromptSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className={styles.promptSection}>
      <p className={styles.promptSectionTitle}>{title}</p>
      <ul className={styles.promptSectionList}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
