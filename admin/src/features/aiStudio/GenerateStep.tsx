import { useEffect, useState } from 'react';
import sharedStyles from '../../styles/shared.module.css';
import type { StudioAsset, StudioJob, JewelleryType } from '../../api/aiStudio';
import summaryStyles from './GenerationSummary.module.css';
import { SHOT_LABELS, ringShotLabel, groupForAssetType, metalColorForAssetType, type AssetGroup } from './generationRules';
import styles from './GenerateStep.module.css';

const GROUP_ORDER: AssetGroup[] = ['Yellow Gold', 'Rose Gold', 'Presenter'];

function elapsedLabel(startedAt: string | null, completedAt: string | null) {
  if (!startedAt) return null;
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((end - new Date(startedAt).getTime()) / 1000));
  return `${seconds}s`;
}

interface GenerateStepProps {
  assets: StudioAsset[];
  jewelleryType?: JewelleryType | null;
  generateRoseGold?: boolean;
  // Six-slot jobs: completed slots out of 6 (null on older jobs).
  progress?: StudioJob['progress'];
  onRegenerate: (_assetId: string) => void;
  regeneratingAssetIds: Set<string>;
}

// No fixed time estimate — real per-asset start/complete timestamps are
// recorded server-side, and this just ticks a clock against them.
export function GenerateStep({ assets, jewelleryType, generateRoseGold, progress, onRegenerate, regeneratingAssetIds }: GenerateStepProps) {
  const [, forceTick] = useState(0);
  const isRing = jewelleryType === 'RING';
  // Six-slot jobs list their images in slot order, like Ring.
  const isSlotted = isRing || assets.some((a) => a.slotKey);

  useEffect(() => {
    const anyInFlight = assets.some((a) => a.status === 'GENERATING');
    if (!anyInFlight) return;
    const timer = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [assets]);

  return (
    <div>
      <p>Generating {assets.length} image{assets.length === 1 ? '' : 's'} — this typically takes a few minutes per image.</p>
      {progress && (
        <div className={summaryStyles.progress}>
          <p className={summaryStyles.progressLabel}>
            {progress.completed} of {progress.expected} images ready ({progress.percent}%)
          </p>
          <div
            className={summaryStyles.progressBar}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.expected}
            aria-valuenow={progress.completed}
          >
            <div className={summaryStyles.progressFill} style={{ width: `${progress.percent}%` }} />
          </div>
        </div>
      )}

      {isSlotted ? (
        <div className={styles.group}>
          <h3 className={styles.groupTitle}>{isRing ? 'Ring' : 'Images'}</h3>
          <div className={styles.grid}>
            {assets.map((asset) => (
              <GenerateTile
                key={asset.id}
                asset={asset}
                label={`${asset.displayOrder + 1}. ${ringShotLabel(asset.assetType, generateRoseGold ?? true)}`}
                metalLabel={`${metalColorForAssetType(asset.assetType, generateRoseGold ?? true)} Gold`}
                onRegenerate={onRegenerate}
                isRegenerating={regeneratingAssetIds.has(asset.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        GROUP_ORDER.map((group) => {
          const groupAssets = assets.filter((a) => groupForAssetType(a.assetType) === group);
          if (groupAssets.length === 0) return null;
          return (
            <div key={group} className={styles.group}>
              <h3 className={styles.groupTitle}>{group}</h3>
              <div className={styles.grid}>
                {groupAssets.map((asset) => (
                  <GenerateTile
                    key={asset.id}
                    asset={asset}
                    label={SHOT_LABELS[asset.assetType]}
                    metalLabel={`${metalColorForAssetType(asset.assetType)} Gold`}
                    onRegenerate={onRegenerate}
                    isRegenerating={regeneratingAssetIds.has(asset.id)}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function GenerateTile({
  asset,
  label,
  metalLabel,
  onRegenerate,
  isRegenerating,
}: {
  asset: StudioAsset;
  label: string;
  metalLabel: string;
  onRegenerate: (_assetId: string) => void;
  isRegenerating: boolean;
}) {
  return (
    <div className={styles.tile}>
      <p className={styles.shotLabel}>{label}</p>
      <p className={styles.metalLabel}>{metalLabel}</p>
      <div className={styles.thumbWrapper}>
        {asset.imageUrl ? (
          <img src={asset.imageUrl} alt={label} className={styles.thumb} />
        ) : (
          <span className={sharedStyles.badgeNeutral}>{asset.status}</span>
        )}
      </div>
      {asset.status === 'GENERATING' && (
        <span className={sharedStyles.badgeNeutral}>
          Generating… {elapsedLabel(asset.generationStartedAt, asset.generationCompletedAt)}
        </span>
      )}
      {asset.status === 'READY' && <span className={sharedStyles.badgeSuccess}>Ready</span>}
      {asset.status === 'FAILED' && <span className={sharedStyles.badgeDanger}>Failed</span>}
      {asset.status === 'PENDING' && <span className={sharedStyles.badgeNeutral}>Waiting…</span>}

      {['READY', 'FAILED'].includes(asset.status) && (
        <button
          type="button"
          className={sharedStyles.buttonLink}
          disabled={isRegenerating}
          onClick={() => onRegenerate(asset.id)}
        >
          {isRegenerating ? 'Requesting…' : asset.status === 'FAILED' ? 'Retry' : 'Regenerate'}
        </button>
      )}
    </div>
  );
}
