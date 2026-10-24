import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPresenters, fetchPresenter, type PresenterSummary } from '../../api/presenters';
import type { CustomerCategory, JewelleryType } from '../../api/aiStudio';
import { Modal } from '../../components/Modal';
import sharedStyles from '../../styles/shared.module.css';
import styles from './PresenterStep.module.css';
import { presenterRequired } from './generationRules';
import { GenerationSummary } from './GenerationSummary';

interface PresenterStepProps {
  jewelleryType: JewelleryType | '';
  presenterId: string | null;
  onChange: (_v: string | null) => void;
  generateRoseGold: boolean;
  customerCategory: CustomerCategory | '';
  references?: { angle45: boolean; side: boolean };
}

export function PresenterStep({
  jewelleryType,
  presenterId,
  onChange,
  generateRoseGold,
  customerCategory,
  references,
}: PresenterStepProps) {
  const [viewingPresenterId, setViewingPresenterId] = useState<string | null>(null);

  // Fetch every active presenter (not filtered server-side) — unsupported
  // ones must still render, just disabled, rather than disappear.
  const { data } = useQuery({
    queryKey: ['ai-studio-presenters'],
    queryFn: () => fetchPresenters(),
  });
  const presenters = data?.presenters ?? [];

  const { data: viewingData } = useQuery({
    queryKey: ['presenter-detail', viewingPresenterId],
    queryFn: () => fetchPresenter(viewingPresenterId as string),
    enabled: !!viewingPresenterId,
  });

  const selectedPresenter = presenters.find((p) => p.id === presenterId) ?? null;
  // Every job includes 2 presenter images, so for Women/Unisex a presenter
  // must be picked; Gents/Kids models are described by the AI instead.
  const required = presenterRequired(jewelleryType, customerCategory);

  return (
    <div>
      <p>
        {required
          ? 'Choose the presenter for both presenter images — the same person appears in both.'
          : customerCategory === 'KIDS'
            ? 'Optionally pick a child presenter as the reference for both images. Without one, the first child image is generated and then used as the reference for the second.'
            : 'The presenter images use one AI-generated male presenter for both images. Picking a presenter is optional.'}
      </p>
      {required && presenters.length === 0 && (
        <p className={sharedStyles.error}>No presenters are set up yet. Add one under AI Studio → Presenters first.</p>
      )}

      <div className={styles.grid}>
        {!required && (
        <button
          type="button"
          className={presenterId === null ? styles.cardSelected : styles.card}
          onClick={() => onChange(null)}
          aria-pressed={presenterId === null}
        >
          {presenterId === null && <span className={styles.checkmark}>✓</span>}
          <div className={styles.noPresenterPreview}>No Presenter</div>
          <p className={styles.cardTitle}>{customerCategory === 'KIDS' ? 'No child presenter' : 'AI-generated presenter'}</p>
          <p className={styles.cardBody}>
            {customerCategory === 'KIDS' ? 'The first image becomes the reference for the second.' : 'One generated identity, used in both images.'}
          </p>
        </button>
        )}

        {presenters.map((presenter) => {
          const supported = !jewelleryType || presenter.supportedJewelleryTypes.includes(jewelleryType);
          return (
            <PresenterCard
              key={presenter.id}
              presenter={presenter}
              selected={presenterId === presenter.id}
              disabled={!supported}
              onSelect={() => onChange(presenter.id)}
              onViewReferences={() => setViewingPresenterId(presenter.id)}
            />
          );
        })}
      </div>

      <div className={styles.summary}>
        <h3 className={styles.summaryTitle}>Generation Summary</h3>
        <dl className={styles.summaryList}>
          <div className={styles.summaryRow}>
            <dt>Presenter</dt>
            <dd>{selectedPresenter ? selectedPresenter.displayName : required ? 'Not chosen yet' : 'AI-described model'}</dd>
          </div>
          <div className={styles.summaryRow}>
            <dt>Rose Gold</dt>
            <dd>{generateRoseGold ? 'On' : 'Off'}</dd>
          </div>
        </dl>
        <GenerationSummary
          generateRoseGold={generateRoseGold}
          customerCategory={customerCategory}
          jewelleryType={jewelleryType}
          hasPresenter={!!presenterId}
          references={references}
        />
      </div>

      {viewingPresenterId && viewingData && (
        <Modal title={viewingData.presenter.displayName} onClose={() => setViewingPresenterId(null)}>
          <p className={styles.modalStyle}>
            {viewingData.presenter.styleLabel} — supports{' '}
            {viewingData.presenter.supportedJewelleryTypes.join(', ')}
          </p>
          <div className={styles.referenceGrid}>
            <ReferenceTile label="Front Portrait" url={viewingData.presenter.frontPortraitUrl} />
            <ReferenceTile label="45° Face Angle" url={viewingData.presenter.face45Url} />
            <ReferenceTile label="Side Profile" url={viewingData.presenter.sideProfileUrl} />
            <ReferenceTile label="Jewellery Placement" url={viewingData.presenter.jewelleryPlacementUrl} />
          </div>
          <div className={styles.modalActions}>
            <button
              type="button"
              className={sharedStyles.buttonPrimary}
              onClick={() => {
                onChange(viewingData.presenter.id);
                setViewingPresenterId(null);
              }}
            >
              Select Presenter
            </button>
            <button type="button" className={sharedStyles.button} onClick={() => setViewingPresenterId(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ReferenceTile({ label, url }: { label: string; url: string }) {
  return (
    <div className={styles.referenceTile}>
      <img src={url} alt={label} className={styles.referenceImg} />
      <p className={styles.referenceLabel}>{label}</p>
    </div>
  );
}

function PresenterCard({
  presenter,
  selected,
  disabled,
  onSelect,
  onViewReferences,
}: {
  presenter: PresenterSummary;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onViewReferences: () => void;
}) {
  const cardClass = disabled ? styles.cardDisabled : selected ? styles.cardSelected : styles.card;
  return (
    <div className={cardClass}>
      {selected && !disabled && <span className={styles.checkmark}>✓</span>}
      <button
        type="button"
        className={styles.cardImageButton}
        onClick={onSelect}
        disabled={disabled}
        aria-pressed={selected}
      >
        <img src={presenter.mainPreviewImageUrl} alt={presenter.displayName} className={styles.cardImage} />
      </button>
      <p className={styles.cardTitle}>{presenter.displayName}</p>
      <p className={styles.cardStyle}>{presenter.styleLabel}</p>
      <p className={styles.cardTypes}>{presenter.supportedJewelleryTypes.join(', ')}</p>
      {disabled ? (
        <p className={styles.notAvailable}>Not available for this jewellery type.</p>
      ) : (
        <div className={styles.cardFooter}>
          <label className={styles.radioLabel}>
            <input type="radio" name="presenter" checked={selected} onChange={onSelect} />
            Select
          </label>
          <button type="button" className={sharedStyles.buttonLink} onClick={onViewReferences}>
            View References
          </button>
        </div>
      )}
    </div>
  );
}
