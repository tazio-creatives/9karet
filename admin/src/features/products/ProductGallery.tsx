import { useRef, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  fetchProductImages,
  uploadProductImage,
  setPrimaryImage,
  reorderImages,
  deleteProductImage,
  attachExistingImage,
  type ImageGroup,
} from '../../api/productImages';
import { ApiError } from '../../api/client';
import { ImageLibraryPicker } from './ImageLibraryPicker';
import sharedStyles from '../../styles/shared.module.css';
import styles from './ProductGallery.module.css';

function thumbUrl(group: ImageGroup): string | null {
  const preferred = group.variants.find((v) => v.variant === 'small' && v.format === 'webp');
  return preferred?.url ?? group.variants[0]?.url ?? null;
}

// Pure manual photo management (upload, reorder, set primary, delete) — no
// AI generation UI here. That lives in AiVariantsPanel, under the separate
// "Generate with AI" card, so the two flows never visually mix.
export function ProductGallery({ productId }: { productId: string }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  const { data: imagesData, isLoading: isImagesLoading } = useQuery({
    queryKey: ['admin-product-images', productId],
    queryFn: () => fetchProductImages(productId),
  });

  const invalidateImages = () => queryClient.invalidateQueries({ queryKey: ['admin-product-images', productId] });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadProductImage(productId, file),
    onSuccess: () => {
      invalidateImages();
      setUploadError(null);
    },
    onError: (err) => setUploadError(err instanceof ApiError ? err.message : 'Upload failed.'),
  });

  const primaryMutation = useMutation({
    mutationFn: (sortOrder: number) => setPrimaryImage(productId, sortOrder),
    onSuccess: invalidateImages,
  });

  const deleteMutation = useMutation({
    mutationFn: (sortOrder: number) => deleteProductImage(productId, sortOrder),
    onSuccess: invalidateImages,
  });

  const reorderMutation = useMutation({
    mutationFn: (order: number[]) => reorderImages(productId, order),
    onSuccess: invalidateImages,
  });

  const attachMutation = useMutation({
    mutationFn: (source: { sourceProductId: string; sourceSortOrder: number }) =>
      attachExistingImage(productId, source),
    onSuccess: () => {
      invalidateImages();
      setUploadError(null);
      setIsLibraryOpen(false);
    },
    onError: (err) => setUploadError(err instanceof ApiError ? err.message : 'Could not attach image.'),
  });

  function move(groups: ImageGroup[], index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= groups.length) return;
    const order = groups.map((g) => g.sortOrder);
    [order[index], order[target]] = [order[target], order[index]];
    reorderMutation.mutate(order);
  }

  const groups = imagesData?.images ?? [];

  return (
    <div>
      <div className={styles.uploadRow}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadMutation.mutate(file);
            e.target.value = '';
          }}
          hidden
        />
        <button
          type="button"
          className={sharedStyles.button}
          disabled={uploadMutation.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploadMutation.isPending ? 'Uploading…' : 'Upload Photo'}
        </button>
        <button type="button" className={sharedStyles.button} onClick={() => setIsLibraryOpen(true)}>
          Choose Existing
        </button>
      </div>
      {uploadError && <p className={sharedStyles.error}>{uploadError}</p>}

      {isLibraryOpen && (
        <ImageLibraryPicker
          excludeProductId={productId}
          isAttaching={attachMutation.isPending}
          onSelect={(source) => attachMutation.mutate(source)}
          onClose={() => setIsLibraryOpen(false)}
        />
      )}

      {isImagesLoading && <p className={sharedStyles.empty}>Loading gallery…</p>}

      {!isImagesLoading && groups.length === 0 && (
        <p className={sharedStyles.empty}>No photos yet — upload one to get started.</p>
      )}

      {groups.length > 0 && (
        <div className={styles.grid}>
          {groups.map((group, i) => {
            const url = thumbUrl(group);
            return (
              <div key={group.sortOrder} className={styles.card}>
                <div className={styles.thumbWrapper}>
                  {url ? <img src={url} alt="" className={styles.thumb} /> : <div className={styles.thumbEmpty} />}
                  {group.isPrimary && <span className={styles.primaryBadge}>Primary</span>}
                  <span className={styles.typeBadge}>{group.type === 'AI_GENERATED' ? 'AI' : 'Photo'}</span>
                </div>
                <div className={styles.cardActions}>
                  <button type="button" onClick={() => move(groups, i, -1)} disabled={i === 0} aria-label="Move left">
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => move(groups, i, 1)}
                    disabled={i === groups.length - 1}
                    aria-label="Move right"
                  >
                    →
                  </button>
                  {!group.isPrimary && (
                    <button type="button" onClick={() => primaryMutation.mutate(group.sortOrder)}>
                      Set Primary
                    </button>
                  )}
                  <button type="button" onClick={() => deleteMutation.mutate(group.sortOrder)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
