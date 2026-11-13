import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import styles from './ReviewFormModal.module.css';

const MAX_IMAGES = 5;

interface ReviewFormModalProps {
  productName: string;
  isEditing: boolean;
  initialRating: number;
  initialTitle: string;
  initialBody: string;
  initialImages: string[];
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (_input: { rating: number; title: string; body: string; keptImageUrls: string[]; newImages: File[] }) => void;
  onClose: () => void;
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h7l1 1.5H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

// Mirrors features/checkout/AddressFormModal.tsx's shell (centered on
// desktop, bottom sheet on mobile, Escape-to-close, body-scroll lock) —
// same established modal pattern, not a bespoke one.
export function ReviewFormModal({
  productName,
  isEditing,
  initialRating,
  initialTitle,
  initialBody,
  initialImages,
  isSubmitting,
  error,
  onSubmit,
  onClose,
}: ReviewFormModalProps) {
  const [rating, setRating] = useState(initialRating);
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [keptImageUrls, setKeptImageUrls] = useState(initialImages);
  const [newImages, setNewImages] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const newImagePreviews = useMemo(() => newImages.map((f) => URL.createObjectURL(f)), [newImages]);
  useEffect(() => {
    return () => newImagePreviews.forEach((url) => URL.revokeObjectURL(url));
  }, [newImagePreviews]);

  const totalImageCount = keptImageUrls.length + newImages.length;

  function handleFilesChosen(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_IMAGES - totalImageCount;
    setNewImages((prev) => [...prev, ...Array.from(files).slice(0, room)]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ rating, title, body, keptImageUrls, newImages });
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? 'Edit Review' : 'Write a Review'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 className={styles.title}>{isEditing ? 'Edit Review' : 'Write a Review'}</h2>
            <p className={styles.productName}>{productName}</p>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.starsInput}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={n <= rating ? styles.starActive : styles.star}
                onClick={() => setRating(n)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
              >
                ★
              </button>
            ))}
          </div>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Title (optional)</span>
            <input
              className={styles.input}
              placeholder="Sum up your review"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Your review (optional)</span>
            <textarea
              className={styles.textarea}
              placeholder="Share your thoughts about this product…"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              Photos (optional) {totalImageCount > 0 && `· ${totalImageCount}/${MAX_IMAGES}`}
            </span>
            <div className={styles.photoGrid}>
              {keptImageUrls.map((url) => (
                <div key={url} className={styles.photoThumb}>
                  <img src={url} alt="" />
                  <button
                    type="button"
                    className={styles.photoRemove}
                    aria-label="Remove photo"
                    onClick={() => setKeptImageUrls((prev) => prev.filter((u) => u !== url))}
                  >
                    <CloseIcon />
                  </button>
                </div>
              ))}
              {newImages.map((file, i) => (
                <div key={`${file.name}-${i}`} className={styles.photoThumb}>
                  <img src={newImagePreviews[i]} alt="" />
                  <button
                    type="button"
                    className={styles.photoRemove}
                    aria-label="Remove photo"
                    onClick={() => setNewImages((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <CloseIcon />
                  </button>
                </div>
              ))}
              {totalImageCount < MAX_IMAGES && (
                <button type="button" className={styles.photoAdd} onClick={() => fileInputRef.current?.click()}>
                  <CameraIcon />
                  <span>Add photo</span>
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => handleFilesChosen(e.target.files)}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Submit Review'}
            </button>
            <button type="button" className={styles.cancelButton} onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
