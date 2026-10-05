import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { Category, CategoryInput } from '../../api/types';
import { ApiError } from '../../api/client';
import { uploadCategoryImage } from '../../api/categories';
import sharedStyles from '../../styles/shared.module.css';

interface CategoryFormProps {
  initial?: Category;
  categories: Category[];
  defaultParentId?: string | null;
  onSubmit: (input: Partial<CategoryInput>) => Promise<unknown>;
  onCancel: () => void;
}

export function CategoryForm({ initial, categories, defaultParentId, onSubmit, onCancel }: CategoryFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [parentId, setParentId] = useState<string>(initial?.parentId ?? defaultParentId ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isNonReturnable, setIsNonReturnable] = useState(initial?.isNonReturnable ?? false);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const banner = initial?.banner;
  const [bannerEnabled, setBannerEnabled] = useState(banner?.enabled ?? false);
  const [bannerEyebrow, setBannerEyebrow] = useState(banner?.eyebrow ?? '');
  const [bannerDescription, setBannerDescription] = useState(banner?.description ?? '');
  const [bannerImageUrl, setBannerImageUrl] = useState(banner?.imageUrl ?? '');
  const [bannerImageUrlMobile, setBannerImageUrlMobile] = useState(banner?.imageUrlMobile ?? '');
  const [bannerAltText, setBannerAltText] = useState(banner?.altText ?? '');
  const [bannerTextColor, setBannerTextColor] = useState<'LIGHT' | 'DARK'>(banner?.textColor ?? 'LIGHT');
  const [bannerTextPosition, setBannerTextPosition] = useState<'LEFT' | 'CENTER' | 'RIGHT'>(
    banner?.textPosition ?? 'LEFT',
  );
  const [bannerFocalPosition, setBannerFocalPosition] = useState<'LEFT' | 'CENTER' | 'RIGHT'>(
    banner?.focalPosition ?? 'CENTER',
  );
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isUploadingBannerMobile, setIsUploadingBannerMobile] = useState(false);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  const bannerMobileFileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setIsUploading(true);
    try {
      const { url } = await uploadCategoryImage(file);
      setImageUrl(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload image.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleBannerFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setIsUploadingBanner(true);
    try {
      const { url } = await uploadCategoryImage(file);
      setBannerImageUrl(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload banner image.');
    } finally {
      setIsUploadingBanner(false);
      if (bannerFileInputRef.current) bannerFileInputRef.current.value = '';
    }
  }

  async function handleBannerMobileFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setIsUploadingBannerMobile(true);
    try {
      const { url } = await uploadCategoryImage(file);
      setBannerImageUrlMobile(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload mobile banner image.');
    } finally {
      setIsUploadingBannerMobile(false);
      if (bannerMobileFileInputRef.current) bannerMobileFileInputRef.current.value = '';
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        name,
        slug: slug || undefined,
        parentId: parentId || null,
        description: description || null,
        imageUrl: imageUrl || null,
        isActive,
        isNonReturnable,
        sortOrder,
        bannerEnabled,
        bannerEyebrow: bannerEyebrow || null,
        bannerDescription: bannerDescription || null,
        bannerImageUrl: bannerImageUrl || null,
        bannerImageUrlMobile: bannerImageUrlMobile || null,
        bannerAltText: bannerAltText || null,
        bannerTextColor,
        bannerTextPosition,
        bannerFocalPosition,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save category.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={sharedStyles.cardPadded}>
      <div className={sharedStyles.formGrid}>
        <label className={sharedStyles.field}>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className={sharedStyles.field}>
          Slug (optional)
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto from name" />
        </label>
        <label className={sharedStyles.field}>
          Parent Category
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— None (top-level) —</option>
            {categories
              .filter((c) => c.id !== initial?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
      </div>

      <div className={`${sharedStyles.formGrid} ${sharedStyles.formSection}`}>
        <label className={sharedStyles.field}>
          Sort Order
          <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
        </label>
        <label className={`${sharedStyles.field} ${sharedStyles.checkboxField}`}>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>
        <label className={`${sharedStyles.field} ${sharedStyles.checkboxField}`}>
          <input
            type="checkbox"
            checked={isNonReturnable}
            onChange={(e) => setIsNonReturnable(e.target.checked)}
          />
          Non-returnable (e.g. solitaires) — applies to every product in this category and its subcategories
        </label>
      </div>

      <label className={`${sharedStyles.field} ${sharedStyles.formSection}`}>
        Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </label>

      <div className={`${sharedStyles.field} ${sharedStyles.formSection}`}>
        Category image (optional)
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            style={{ maxWidth: 240, maxHeight: 140, objectFit: 'cover', display: 'block', margin: '4px 0 8px' }}
          />
        )}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} disabled={isUploading} />
        {isUploading && <p>Uploading…</p>}
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="…or paste an image URL directly"
          style={{ marginTop: 6 }}
        />
      </div>

      <div className={sharedStyles.formSection}>
        <label className={sharedStyles.checkboxField}>
          <input type="checkbox" checked={bannerEnabled} onChange={(e) => setBannerEnabled(e.target.checked)} />
          Enable Category Banner (full-width banner shown above the product listing on this category's page)
        </label>
      </div>

      {bannerEnabled && (
        <>
          <div className={`${sharedStyles.formGrid} ${sharedStyles.formSection}`}>
            <label className={sharedStyles.field}>
              Banner Eyebrow (optional)
              <input value={bannerEyebrow} onChange={(e) => setBannerEyebrow(e.target.value)} />
            </label>
            <label className={sharedStyles.field}>
              Banner Alt Text
              <input
                value={bannerAltText}
                onChange={(e) => setBannerAltText(e.target.value)}
                placeholder="Describe the banner image for screen readers"
              />
            </label>
          </div>

          <label className={`${sharedStyles.field} ${sharedStyles.formSection}`}>
            Banner Description
            <textarea value={bannerDescription} onChange={(e) => setBannerDescription(e.target.value)} rows={2} />
          </label>

          <div className={`${sharedStyles.formGrid} ${sharedStyles.formSection}`}>
            <label className={sharedStyles.field}>
              Text Colour
              <select
                value={bannerTextColor}
                onChange={(e) => setBannerTextColor(e.target.value as 'LIGHT' | 'DARK')}
              >
                <option value="LIGHT">Light (for a darker photo)</option>
                <option value="DARK">Dark (for a lighter photo)</option>
              </select>
            </label>
            <label className={sharedStyles.field}>
              Text Position
              <select
                value={bannerTextPosition}
                onChange={(e) => setBannerTextPosition(e.target.value as 'LEFT' | 'CENTER' | 'RIGHT')}
              >
                <option value="LEFT">Left</option>
                <option value="CENTER">Centre</option>
                <option value="RIGHT">Right</option>
              </select>
            </label>
            <label className={sharedStyles.field}>
              Image Focal Position
              <select
                value={bannerFocalPosition}
                onChange={(e) => setBannerFocalPosition(e.target.value as 'LEFT' | 'CENTER' | 'RIGHT')}
              >
                <option value="LEFT">Left</option>
                <option value="CENTER">Centre</option>
                <option value="RIGHT">Right</option>
              </select>
            </label>
          </div>

          <div className={`${sharedStyles.formGrid} ${sharedStyles.formSection}`}>
            <div className={sharedStyles.field}>
              Desktop Banner Image (recommended 1920×600, ~3.2:1)
              {bannerImageUrl && (
                <>
                  <img
                    src={bannerImageUrl}
                    alt=""
                    style={{ maxWidth: 320, maxHeight: 100, objectFit: 'cover', display: 'block', margin: '4px 0 8px' }}
                  />
                  <button
                    type="button"
                    className={sharedStyles.buttonLink}
                    style={{ marginBottom: 8 }}
                    onClick={() => setBannerImageUrl('')}
                  >
                    Remove image
                  </button>
                </>
              )}
              <input
                ref={bannerFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleBannerFileChange}
                disabled={isUploadingBanner}
              />
              {isUploadingBanner && <p>Uploading…</p>}
              <input
                value={bannerImageUrl}
                onChange={(e) => setBannerImageUrl(e.target.value)}
                placeholder="…or paste an image URL directly"
                style={{ marginTop: 6 }}
              />
            </div>

            <div className={sharedStyles.field}>
              Mobile Banner Image (optional — recommended 800×1000, 4:5; falls back to desktop image if empty)
              {bannerImageUrlMobile && (
                <>
                  <img
                    src={bannerImageUrlMobile}
                    alt=""
                    style={{ maxWidth: 160, maxHeight: 200, objectFit: 'cover', display: 'block', margin: '4px 0 8px' }}
                  />
                  <button
                    type="button"
                    className={sharedStyles.buttonLink}
                    style={{ marginBottom: 8 }}
                    onClick={() => setBannerImageUrlMobile('')}
                  >
                    Remove image
                  </button>
                </>
              )}
              <input
                ref={bannerMobileFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleBannerMobileFileChange}
                disabled={isUploadingBannerMobile}
              />
              {isUploadingBannerMobile && <p>Uploading…</p>}
              <input
                value={bannerImageUrlMobile}
                onChange={(e) => setBannerImageUrlMobile(e.target.value)}
                placeholder="…or paste an image URL directly"
                style={{ marginTop: 6 }}
              />
            </div>
          </div>
        </>
      )}

      {error && <p className={sharedStyles.error}>{error}</p>}

      <div className={sharedStyles.formActions}>
        <button type="submit" className={sharedStyles.buttonPrimary} disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className={sharedStyles.button} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
