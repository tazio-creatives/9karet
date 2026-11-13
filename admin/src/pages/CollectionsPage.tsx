import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  fetchAdminCollections,
  createCollection,
  updateCollection,
  deleteCollection,
} from '../api/collections';
import { fetchAdminProducts, updateProduct } from '../api/products';
import type { Collection, ProductListItem } from '../api/types';
import { ApiError } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import sharedStyles from '../styles/shared.module.css';
import categoryStyles from './CategoriesPage.module.css';
import styles from './CollectionsPage.module.css';

type Mode = { type: 'none' } | { type: 'add' } | { type: 'edit'; collection: Collection };

function CollectionForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Collection;
  onSubmit: (input: Partial<Collection>) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({ name, slug: slug || undefined, description: description || null, isActive });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save collection.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={sharedStyles.cardPadded}>
      <div className={sharedStyles.formGrid2}>
        <label className={sharedStyles.field}>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className={sharedStyles.field}>
          Slug (optional)
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto from name" />
        </label>
      </div>
      <label className={`${sharedStyles.field} ${sharedStyles.formSection}`}>
        Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </label>
      <label className={`${sharedStyles.field} ${sharedStyles.checkboxField} ${sharedStyles.formSection}`}>
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Active
      </label>
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

function ProductRow({
  product,
  actionLabel,
  onAction,
  isActing,
}: {
  product: ProductListItem;
  actionLabel: string;
  onAction: () => void;
  isActing: boolean;
}) {
  return (
    <div className={styles.productRow}>
      {product.primaryImageUrl ? (
        <img src={product.primaryImageUrl} alt="" className={styles.productThumb} />
      ) : (
        <span className={styles.productThumbPlaceholder} />
      )}
      <span className={styles.productName}>{product.name}</span>
      <button type="button" className={sharedStyles.buttonLink} onClick={onAction} disabled={isActing}>
        {actionLabel}
      </button>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

// Compact horizontal chip — used for the assigned-products list, which can
// realistically run to 50+ products; a full-width row per product (like
// ProductRow above, kept for the much shorter search-results list) would
// make the panel unreasonably tall. Wraps into as many short rows as needed
// instead of one row per product.
function ProductChip({
  product,
  onRemove,
  isRemoving,
}: {
  product: ProductListItem;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  return (
    <div className={styles.chip}>
      {product.primaryImageUrl ? (
        <img src={product.primaryImageUrl} alt="" className={styles.chipThumb} />
      ) : (
        <span className={styles.chipThumbPlaceholder} />
      )}
      <span className={styles.chipName}>{product.name}</span>
      <button
        type="button"
        className={styles.chipRemoveButton}
        onClick={onRemove}
        disabled={isRemoving}
        aria-label={`Remove ${product.name} from collection`}
        title="Remove from collection"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

// Expanded per-collection panel — shows every product currently assigned to
// this collection (products.collection_id, a single FK — a product belongs
// to at most one collection today) with a Remove action per row, plus a
// search-to-add picker below it. Both actions are just updateProduct PATCHes
// setting/clearing collectionId; there's no separate join-table endpoint
// since the schema doesn't have one.
function CollectionProductsPanel({ collection }: { collection: Collection }) {
  const queryClient = useQueryClient();
  const productsQueryKey = ['admin-collection-products', collection.id];
  const { data, isLoading } = useQuery({
    queryKey: productsQueryKey,
    queryFn: () => fetchAdminProducts({ collectionId: collection.id, limit: 100 }),
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ProductListItem[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: productsQueryKey });

  const removeMutation = useMutation({
    mutationFn: (productId: string) => updateProduct(productId, { collectionId: null }),
    onSuccess: invalidate,
  });
  const addMutation = useMutation({
    mutationFn: (productId: string) => updateProduct(productId, { collectionId: collection.id }),
    onSuccess: () => {
      invalidate();
      setSearchResults(null);
      setSearchTerm('');
    },
  });

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    const term = searchTerm.trim();
    if (!term) return;
    setSearchError(null);
    setIsSearching(true);
    try {
      const result = await fetchAdminProducts({ search: term, limit: 20 });
      setSearchResults(result.products);
    } catch (err) {
      setSearchError(err instanceof ApiError ? err.message : 'Could not search products.');
    } finally {
      setIsSearching(false);
    }
  }

  const products = data?.products ?? [];
  const assignedIds = new Set(products.map((p) => p.id));

  return (
    <div className={styles.productsPanel}>
      {isLoading ? (
        <p className={sharedStyles.empty}>Loading products…</p>
      ) : products.length === 0 ? (
        <p className={sharedStyles.empty}>No products in this collection yet.</p>
      ) : (
        <div className={styles.chipGrid}>
          {products.map((product) => (
            <ProductChip
              key={product.id}
              product={product}
              onRemove={() => removeMutation.mutate(product.id)}
              isRemoving={removeMutation.isPending && removeMutation.variables === product.id}
            />
          ))}
        </div>
      )}

      <form onSubmit={handleSearch} className={styles.addProductForm}>
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search products by name or SKU to add…"
        />
        <button type="submit" className={sharedStyles.button} disabled={isSearching}>
          {isSearching ? 'Searching…' : 'Search'}
        </button>
      </form>
      {searchError && <p className={sharedStyles.error}>{searchError}</p>}

      {searchResults && (
        <div className={styles.searchResults}>
          {searchResults.length === 0 ? (
            <p className={sharedStyles.empty}>No matching products.</p>
          ) : (
            searchResults.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                actionLabel={assignedIds.has(product.id) ? 'Already added' : 'Add'}
                onAction={() => addMutation.mutate(product.id)}
                isActing={
                  assignedIds.has(product.id) ||
                  (addMutation.isPending && addMutation.variables === product.id)
                }
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function CollectionsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-collections'], queryFn: fetchAdminCollections });
  const [mode, setMode] = useState<Mode>({ type: 'none' });
  const [pendingDelete, setPendingDelete] = useState<Collection | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-collections'] });

  const createMutation = useMutation({
    mutationFn: (input: Partial<Collection>) => createCollection(input),
    onSuccess: () => {
      invalidate();
      setMode({ type: 'none' });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Collection> }) => updateCollection(id, input),
    onSuccess: () => {
      invalidate();
      setMode({ type: 'none' });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCollection(id),
    onSuccess: () => {
      invalidate();
      setPendingDelete(null);
    },
    onError: (err) => {
      window.alert(err instanceof Error ? err.message : 'Could not delete collection.');
      setPendingDelete(null);
    },
  });

  if (isLoading) return <p>Loading…</p>;
  const collections = data?.collections ?? [];

  return (
    <div>
      <div className={sharedStyles.pageHeader}>
        <h1 className={sharedStyles.pageTitle}>Collections</h1>
        {mode.type === 'none' && (
          <button type="button" className={sharedStyles.buttonPrimary} onClick={() => setMode({ type: 'add' })}>
            Add Collection
          </button>
        )}
      </div>

      {mode.type === 'add' && (
        <div className={categoryStyles.formWrapper}>
          <CollectionForm onSubmit={(input) => createMutation.mutateAsync(input)} onCancel={() => setMode({ type: 'none' })} />
        </div>
      )}
      {mode.type === 'edit' && (
        <div className={categoryStyles.formWrapper}>
          <CollectionForm
            initial={mode.collection}
            onSubmit={(input) => updateMutation.mutateAsync({ id: mode.collection.id, input })}
            onCancel={() => setMode({ type: 'none' })}
          />
        </div>
      )}

      <div className={sharedStyles.card}>
        {collections.length === 0 && <p className={sharedStyles.empty}>No collections yet.</p>}
        {collections.map((collection) => (
          <div key={collection.id}>
            <div className={categoryStyles.row}>
              <span className={categoryStyles.name}>{collection.name}</span>
              <span className={categoryStyles.slug}>/{collection.slug}</span>
              <span className={collection.isActive ? sharedStyles.badgeSuccess : sharedStyles.badgeNeutral}>
                {collection.isActive ? 'Active' : 'Inactive'}
              </span>
              <div className={categoryStyles.actions}>
                <button
                  type="button"
                  className={sharedStyles.buttonLink}
                  onClick={() => setExpandedId(expandedId === collection.id ? null : collection.id)}
                >
                  {expandedId === collection.id ? 'Hide Products' : 'Manage Products'}
                </button>
                <button type="button" className={sharedStyles.buttonLink} onClick={() => setMode({ type: 'edit', collection })}>
                  Edit
                </button>
                <button type="button" className={sharedStyles.buttonLink} onClick={() => setPendingDelete(collection)}>
                  Delete
                </button>
              </div>
            </div>
            {expandedId === collection.id && <CollectionProductsPanel collection={collection} />}
          </div>
        ))}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete collection"
          message={`Delete "${pendingDelete.name}"? This cannot be undone.`}
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
