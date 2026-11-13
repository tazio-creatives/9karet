import { useRef, useState } from 'react';
import type { ReferenceRole, ReferenceUpload } from '../../api/aiStudio';
import sharedStyles from '../../styles/shared.module.css';
import styles from './UploadStep.module.css';

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_FILE_SIZE_MB = 10;

// Three fixed reference roles. Only the main/front image is required; each
// file is uploaded with its role, so the backend never has to guess from
// upload order which image is the angled or the side view.
const SLOTS: { role: ReferenceRole; label: string; required: boolean }[] = [
  { role: 'main_front', label: '1. Main / Front Reference', required: true },
  { role: 'angle_45', label: '2. 45° Angled Reference', required: false },
  { role: 'side_profile', label: '3. Side-Profile Reference', required: false },
];

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) return 'Please choose a PNG, JPG, JPEG, or WebP image.';
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) return `Image must be smaller than ${MAX_FILE_SIZE_MB}MB.`;
  return null;
}

interface UploadStepProps {
  onSubmit: (_references: ReferenceUpload[]) => void;
  isPending: boolean;
  error: string | null;
}

export function UploadStep({ onSubmit, isPending, error }: UploadStepProps) {
  const [files, setFiles] = useState<(File | null)[]>([null, null, null]);
  const [previews, setPreviews] = useState<(string | null)[]>([null, null, null]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const fileInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  function setSlot(index: number, file: File) {
    const err = validateFile(file);
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    setFiles((s) => s.map((f, i) => (i === index ? file : f)));
    setPreviews((p) => p.map((url, i) => (i === index ? URL.createObjectURL(file) : url)));
  }

  // Only the optional references can be removed; the main one can only be
  // replaced.
  function clearSlot(index: number) {
    if (SLOTS[index].required) return;
    setFiles((s) => s.map((f, i) => (i === index ? null : f)));
    setPreviews((p) => p.map((url, i) => (i === index ? null : url)));
  }

  const hasMain = !!files[0];

  return (
    <div>
      <p className={styles.helper}>
        The main/front image is required. Angled and side images are optional but improve product accuracy when
        generating different catalogue views.
      </p>

      <div className={styles.slotGrid}>
        {SLOTS.map(({ role, label, required }, i) => (
          <div key={role} className={styles.slot}>
            <p className={styles.slotLabel}>
              {label}
              <span className={required ? styles.primaryBadge : styles.optionalBadge}>{required ? 'Required' : 'Optional'}</span>
            </p>
            {/* Visually hidden (not display:none) and activated by its <label>
                below — some browsers (notably Safari) ignore a script-triggered
                .click() on a display:none file input, so the picker never opened. */}
            <input
              id={`studio-upload-${role}`}
              ref={fileInputRefs[i]}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className={styles.fileInput}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setSlot(i, file);
                e.target.value = '';
              }}
            />
            {previews[i] ? (
              <div className={styles.filled}>
                <img src={previews[i] as string} alt={label} className={styles.previewImg} />
                <div className={styles.slotActions}>
                  <label htmlFor={`studio-upload-${role}`} className={sharedStyles.buttonLink} style={{ cursor: 'pointer' }}>
                    Replace
                  </label>
                  {!required && (
                    <button type="button" className={sharedStyles.buttonLink} onClick={() => clearSlot(i)}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <label
                htmlFor={`studio-upload-${role}`}
                className={`${styles.empty} ${dragOver === i ? styles.emptyDragOver : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(i);
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  const file = e.dataTransfer.files?.[0];
                  if (file) setSlot(i, file);
                }}
              >
                <span>Click to upload</span>
                <span className={styles.hint}>or drag a photo here</span>
                <span className={styles.hint}>
                  PNG, JPG, JPEG, or WebP — up to {MAX_FILE_SIZE_MB}MB
                </span>
              </label>
            )}
          </div>
        ))}
      </div>

      {(validationError || error) && <p className={sharedStyles.error}>{validationError ?? error}</p>}

      <div className={styles.actions}>
        <button
          type="button"
          className={sharedStyles.buttonPrimary}
          disabled={!hasMain || isPending}
          onClick={() =>
            onSubmit(
              SLOTS.flatMap(({ role }, i) => (files[i] ? [{ file: files[i] as File, role }] : [])),
            )
          }
        >
          {isPending ? 'Uploading…' : 'Analyse Jewellery'}
        </button>
      </div>
    </div>
  );
}
