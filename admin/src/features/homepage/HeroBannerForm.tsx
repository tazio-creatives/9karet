import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAdminCategories } from '../../api/categories';
import { fetchAdminCollections } from '../../api/collections';
import { fetchAdminProduct, fetchAdminProducts } from '../../api/products';
import { uploadHomepageImage } from '../../api/homepage';
import type { HeroRedirectType, HomepageItem, HomepageItemInput } from '../../api/types';
import { ApiError } from '../../api/client';
import { SearchableSelect, type SearchableSelectOption } from '../../components/SearchableSelect';
import { categoryPathOptions } from '../../utils/categoryTree';
import sharedStyles from '../../styles/shared.module.css';

interface HeroBannerFormProps {
  initial?: HomepageItem;
  onSubmit: (input: HomepageItemInput) => Promise<unknown>;
  onCancel: () => void;
}

// Simplified Hero Slider form — the banner image itself already carries the
// heading/description/CTA artwork, so this form only captures what the
// storefront can't get from the image: an internal-only name, the two
// images, where the whole banner links to, and its enabled state. Kept as
// its own component (rather than branching inside HomepageItemForm) so the
// generic form used by every other section type is untouched.
export function HeroBannerForm({ initial, onSubmit, onCancel }: HeroBannerFormProps) {
  const { data: categoriesData } = useQuery({ queryKey: ['admin-categories'], queryFn: fetchAdminCategories });
  const { data: collectionsData } = useQuery({ queryKey: ['admin-collections'], queryFn: fetchAdminCollections });
  const { data: initialProductData } = useQuery({
    queryKey: ['admin-product', initial?.productId],
    queryFn: () => fetchAdminProduct(initial!.productId as string),
    enabled: !!initial?.productId,
  });

  const [name, setName] = useState(initial?.name ?? '');
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [imageUrlMobile, setImageUrlMobile] = useState(initial?.imageUrlMobile ?? '');
  const [redirectType, setRedirectType] = useState<HeroRedirectType>(initial?.redirectType ?? 'NONE');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [collectionId, setCollectionId] = useState(initial?.collectionId ?? '');
  const [productId, setProductId] = useState(initial?.productId ?? '');
  const [productLabel, setProductLabel] = useState('');
  const [openInNewTab, setOpenInNewTab] = useState(initial?.openInNewTab ?? false);
  const [isEnabled, setIsEnabled] = useState(initial?.isEnabled ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingMobile, setIsUploadingMobile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialProductData?.product) setProductLabel(initialProductData.product.name);
  }, [initialProductData]);

  function handleRedirectTypeChange(next: HeroRedirectType) {
    setRedirectType(next);
    setCategoryId('');
    setCollectionId('');
    setProductId('');
    setProductLabel('');
  }

  function loadCategoryOptions(query: string): SearchableSelectOption[] {
    const q = query.trim().toLowerCase();
    // Matches on the full path, so typing a parent ("Rings") finds its
    // subcategories too.
    return categoryPathOptions(categoriesData?.categories ?? [])
      .filter((c) => c.isActive && (!q || c.pathLabel.toLowerCase().includes(q)))
      .slice(0, 50)
      .map((c) => ({ id: c.id, label: c.pathLabel }));
  }

  function loadCollectionOptions(query: string): SearchableSelectOption[] {
    const q = query.trim().toLowerCase();
    return (collectionsData?.collections ?? [])
      .filter((c) => c.isActive && (!q || c.name.toLowerCase().includes(q)))
      .slice(0, 50)
      .map((c) => ({ id: c.id, label: c.name }));
  }

  async function loadProductOptions(query: string): Promise<SearchableSelectOption[]> {
    const res = await fetchAdminProducts({ search: query || undefined, status: 'PUBLISHED', limit: 20 });
    return res.products.map((p) => ({ id: p.id, label: p.name }));
  }

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
    if (!name.trim()) return setError('Internal Banner Name is required.');
    if (!imageUrl) return setError('Desktop Banner Image is required.');
    if (redirectType === 'CATEGORY' && !categoryId) return setError('Select a category for the redirect destination.');
    if (redirectType === 'COLLECTION' && !collectionId)
      return setError('Select a collection for the redirect destination.');
    if (redirectType === 'PRODUCT' && !productId) return setError('Select a product for the redirect destination.');

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        imageUrl,
        imageUrlMobile: imageUrlMobile || null,
        redirectType,
        categoryId: redirectType === 'CATEGORY' ? categoryId : null,
        collectionId: redirectType === 'COLLECTION' ? collectionId : null,
        productId: redirectType === 'PRODUCT' ? productId : null,
        openInNewTab,
        isEnabled,
        // The old heading/subheading/CTA fields no longer render anywhere
        // for Hero banners — clear them so saving through this form never
        // leaves stale, invisible copy behind on an item created before
        // this rewrite.
        heading: null,
        subheading: null,
        ctaLabel: null,
        ctaUrl: null,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save banner.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={sharedStyles.cardPadded}>
      <div className={sharedStyles.formGrid}>
        <label className={sharedStyles.field}>
          Internal Banner Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. New Collection 2026"
          />
        </label>
        <label className={sharedStyles.field}>
          Status
          <select value={isEnabled ? 'enabled' : 'disabled'} onChange={(e) => setIsEnabled(e.target.value === 'enabled')}>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
        <label className={sharedStyles.field}>
          Open Link
          <select value={openInNewTab ? 'new' : 'same'} onChange={(e) => setOpenInNewTab(e.target.value === 'new')}>
            <option value="same">Same tab</option>
            <option value="new">New tab</option>
          </select>
        </label>
      </div>

      <div className={`${sharedStyles.formGrid2} ${sharedStyles.formSection}`}>
        <div className={sharedStyles.field}>
          Desktop Banner Image (recommended 1600 × 500px)
          {imageUrl && (
            <>
              <img
                src={imageUrl}
                alt=""
                style={{ maxWidth: 320, maxHeight: 100, objectFit: 'contain', display: 'block', margin: '4px 0 8px', background: '#f5f0ea' }}
              />
              <button
                type="button"
                className={sharedStyles.buttonLink}
                style={{ marginBottom: 8 }}
                onClick={() => setImageUrl('')}
              >
                Remove image
              </button>
            </>
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
          Mobile Banner Image (recommended 800 × 1000px, 4:5 — falls back to the desktop image if left empty)
          {imageUrlMobile && (
            <>
              <img
                src={imageUrlMobile}
                alt=""
                style={{ maxWidth: 160, maxHeight: 200, objectFit: 'contain', display: 'block', margin: '4px 0 8px', background: '#f5f0ea' }}
              />
              <button
                type="button"
                className={sharedStyles.buttonLink}
                style={{ marginBottom: 8 }}
                onClick={() => setImageUrlMobile('')}
              >
                Remove image
              </button>
            </>
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
            placeholder="…or paste an image URL directly (optional)"
            style={{ marginTop: 6 }}
          />
        </div>
      </div>

      <div className={`${sharedStyles.formGrid} ${sharedStyles.formSection}`}>
        <label className={sharedStyles.field}>
          Redirect Type
          <select value={redirectType} onChange={(e) => handleRedirectTypeChange(e.target.value as HeroRedirectType)}>
            <option value="NONE">No Redirect</option>
            <option value="CATEGORY">Category</option>
            <option value="COLLECTION">Collection</option>
            <option value="PRODUCT">Product</option>
          </select>
        </label>

        {redirectType !== 'NONE' && (
          <div className={sharedStyles.field}>
            Redirect Destination
            {redirectType === 'CATEGORY' && (
              <SearchableSelect
                value={categoryId}
                selectedLabel={categoryPathOptions(categoriesData?.categories ?? []).find((c) => c.id === categoryId)?.pathLabel ?? ''}
                onChange={(id) => setCategoryId(id)}
                onClear={() => setCategoryId('')}
                loadOptions={loadCategoryOptions}
                placeholder="Search categories…"
              />
            )}
            {redirectType === 'COLLECTION' && (
              <SearchableSelect
                value={collectionId}
                selectedLabel={collectionsData?.collections.find((c) => c.id === collectionId)?.name ?? ''}
                onChange={(id) => setCollectionId(id)}
                onClear={() => setCollectionId('')}
                loadOptions={loadCollectionOptions}
                placeholder="Search collections…"
              />
            )}
            {redirectType === 'PRODUCT' && (
              <SearchableSelect
                value={productId}
                selectedLabel={productLabel}
                onChange={(id, label) => {
                  setProductId(id);
                  setProductLabel(label);
                }}
                onClear={() => {
                  setProductId('');
                  setProductLabel('');
                }}
                loadOptions={loadProductOptions}
                placeholder="Search published products…"
              />
            )}
          </div>
        )}
      </div>

      {error && <p className={sharedStyles.error}>{error}</p>}

      <div className={sharedStyles.formActions}>
        <button type="submit" className={sharedStyles.buttonPrimary} disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save Banner'}
        </button>
        <button type="button" className={sharedStyles.button} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
