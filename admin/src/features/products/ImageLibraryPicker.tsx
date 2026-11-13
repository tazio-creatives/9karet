import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchImageLibrary } from '../../api/productImages';
import { Modal } from '../../components/Modal';
import sharedStyles from '../../styles/shared.module.css';
import styles from './ImageLibraryPicker.module.css';

interface ImageLibraryPickerProps {
  excludeProductId?: string;
  onSelect: (source: { sourceProductId: string; sourceSortOrder: number }) => void;
  onClose: () => void;
  isAttaching: boolean;
}

// Lets an admin reuse a photo already uploaded for another product instead
// of uploading the same shot again — opened from "Choose Existing" next to
// Upload Photo on the product gallery.
export function ImageLibraryPicker({ excludeProductId, onSelect, onClose, isAttaching }: ImageLibraryPickerProps) {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-image-library', search, excludeProductId],
    queryFn: () => fetchImageLibrary({ search: search || undefined, excludeProductId }),
  });

  const images = data?.images ?? [];

  return (
    <Modal title="Choose an Existing Image" onClose={onClose}>
      <input
        type="text"
        className={styles.search}
        placeholder="Search by product name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />

      {isLoading && <p className={sharedStyles.empty}>Loading images…</p>}
      {!isLoading && images.length === 0 && (
        <p className={sharedStyles.empty}>
          {search ? 'No images match that search.' : 'No product images exist yet.'}
        </p>
      )}

      {images.length > 0 && (
        <div className={styles.grid}>
          {images.map((img) => (
            <button
              key={`${img.productId}-${img.sortOrder}`}
              type="button"
              className={styles.card}
              disabled={isAttaching}
              onClick={() => onSelect({ sourceProductId: img.productId, sourceSortOrder: img.sortOrder })}
            >
              {img.thumbnailUrl ? (
                <img src={img.thumbnailUrl} alt="" className={styles.thumb} />
              ) : (
                <div className={styles.thumbEmpty} />
              )}
              <span className={styles.productName}>{img.productName}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
