import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAdminCategories } from '../../api/categories';
import { fetchAdminCollections } from '../../api/collections';
import { fetchAdminProducts } from '../../api/products';
import { uploadHomepageImage } from '../../api/homepage';
import type { HomepageItem, HomepageItemInput, HomepageSectionType } from '../../api/types';
import { ApiError } from '../../api/client';
import sharedStyles from '../../styles/shared.module.css';

// This one shared form's "Heading" field means something different per
// section type — from the actual storefront banner title (NEW_ARRIVALS) to
// a small eyebrow line above a title that comes from elsewhere
// (COLLECTION_SHOWCASE) to entirely unused (CATEGORY_PRODUCTS, whose own
// helper text above this form already says so). The plain "Heading" label
// alone doesn't say which — easy to mistake for the section-level "Heading"
// field up in the section row, which is admin-only and never rendered on
// the storefront for any type. Spelling out "(shown on the storefront...)"
// here makes that distinction visible right where the confusion happens.
const HEADING_LABEL: Partial<Record<HomepageSectionType, string>> = {
  COLLECTION_SHOWCASE: 'Heading (shown on the storefront as a small eyebrow line above the banner title)',
  NEW_ARRIVALS: 'Heading (shown on the storefront as the banner title)',
  CATEGORY_PRODUCTS: 'Heading (not used for this section type — see note above)',
  SHOP_BY_BOND: 'Heading (the label shown under the photo, e.g. "Mother")',
};

interface HomepageItemFormProps {
  sectionType: HomepageSectionType;
  initial?: HomepageItem;
  onSubmit: (input: HomepageItemInput) => Promise<unknown>;
  onCancel: () => void;
}

export function HomepageItemForm({ sectionType, initial, onSubmit, onCancel }: HomepageItemFormProps) {
  const { data: categoriesData } = useQuery({ queryKey: ['admin-categories'], queryFn: fetchAdminCategories });
  const { data: collectionsData } = useQuery({ queryKey: ['admin-collections'], queryFn: fetchAdminCollections });
  const { data: productsData } = useQuery({
    queryKey: ['admin-products', 'for-homepage'],
    queryFn: () => fetchAdminProducts({ limit: 100 }),
  });

  const [heading, setHeading] = useState(initial?.heading ?? '');
  const [subheading, setSubheading] = useState(initial?.subheading ?? '');
  const [ctaLabel, setCtaLabel] = useState(initial?.ctaLabel ?? '');
  const [ctaUrl, setCtaUrl] = useState(initial?.ctaUrl ?? '');
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [imageUrlMobile, setImageUrlMobile] = useState(initial?.imageUrlMobile ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [collectionId, setCollectionId] = useState(initial?.collectionId ?? '');
  const [productId, setProductId] = useState(initial?.productId ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingMobile, setIsUploadingMobile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setIsUploading(true);
    try {
      const { url } = await uploadHomepageImage(file);
      setImageUrl(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload image.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleMobileFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setIsUploadingMobile(true);
    try {
      const { url } = await uploadHomepageImage(file);
      setImageUrlMobile(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload mobile image.');
    } finally {
      setIsUploadingMobile(false);
      if (mobileFileInputRef.current) mobileFileInputRef.current.value = '';
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        heading: heading || null,
        subheading: subheading || null,
        ctaLabel: ctaLabel || null,
        ctaUrl: ctaUrl || null,
        imageUrl: imageUrl || null,
        imageUrlMobile: imageUrlMobile || null,
        categoryId: categoryId || null,
        collectionId: collectionId || null,
        productId: productId || null,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save item.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={sharedStyles.cardPadded}>
      <div className={sharedStyles.formGrid}>
        <label className={sharedStyles.field}>
          {HEADING_LABEL[sectionType] ?? 'Heading'}
          <input value={heading} onChange={(e) => setHeading(e.target.value)} />
        </label>
        <label className={sharedStyles.field}>
          Subheading (short description, e.g. hero banners)
          <input value={subheading} onChange={(e) => setSubheading(e.target.value)} />
        </label>
        <label className={sharedStyles.field}>
          CTA Label
          <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
        </label>
        <label className={sharedStyles.field}>
          CTA URL (optional — overrides linked category/collection/product)
          <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="/rings" />
        </label>
      </div>

      <div className={`${sharedStyles.formGrid} ${sharedStyles.formSection}`}>
        <label className={sharedStyles.field}>
          Link to Category
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— None —</option>
            {categoriesData?.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className={sharedStyles.field}>
          Link to Collection
          <select value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
            <option value="">— None —</option>
            {collectionsData?.collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className={sharedStyles.field}>
          Link to Product
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">— None —</option>
            {productsData?.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={`${sharedStyles.formGrid} ${sharedStyles.formSection}`}>
        <div className={sharedStyles.field}>
          Banner image — desktop
          {imageUrl && (
            <img
              src={imageUrl}
              alt=""
              style={{ maxWidth: 320, maxHeight: 160, objectFit: 'cover', display: 'block', margin: '4px 0 8px' }}
            />
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={isUploading}
          />
          {isUploading && <p>Uploading…</p>}
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="…or paste an image URL directly"
            style={{ marginTop: 6 }}
          />
        </div>

        <div className={sharedStyles.field}>
          Banner image — mobile (recommended, 4:5 portrait crop)
          {imageUrlMobile && (
            <img
              src={imageUrlMobile}
              alt=""
              style={{ maxWidth: 160, maxHeight: 200, objectFit: 'cover', display: 'block', margin: '4px 0 8px' }}
            />
          )}
          <input
            ref={mobileFileInputRef}
            type="file"
            accept="image/*"
            onChange={handleMobileFileChange}
            disabled={isUploadingMobile}
          />
          {isUploadingMobile && <p>Uploading…</p>}
          <input
            value={imageUrlMobile}
            onChange={(e) => setImageUrlMobile(e.target.value)}
            placeholder="…or paste an image URL directly (falls back to desktop image if empty)"
            style={{ marginTop: 6 }}
          />
        </div>
      </div>

      {error && <p className={sharedStyles.error}>{error}</p>}

      <div className={sharedStyles.formActions}>
        <button type="submit" className={sharedStyles.buttonPrimary} disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save Item'}
        </button>
        <button type="button" className={sharedStyles.button} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
