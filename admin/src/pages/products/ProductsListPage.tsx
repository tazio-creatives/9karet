import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { fetchAdminProducts, deleteProduct, setFeatured, setBestSeller, bulkSetCollection } from '../../api/products';
import { fetchAdminCollections } from '../../api/collections';
import { fetchAdminCategories } from '../../api/categories';
import type { ProductStatus } from '../../api/types';
import { formatPrice } from '../../utils/formatPrice';
import { categoryPathOptions } from '../../utils/categoryTree';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Toast } from '../../components/Toast';
import sharedStyles from '../../styles/shared.module.css';
import styles from './ProductsListPage.module.css';

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3.3l2.5 5.3 5.8.6-4.3 3.9 1.2 5.7-5.2-3-5.2 3 1.2-5.7-4.3-3.9 5.8-.6L12 3.3z" />
    </svg>
  );
}

function FlameIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2.5c1.2 2.6-.5 4-1.6 5.3C9.2 9 8.5 10.3 8.5 12a3.5 3.5 0 0 0 7 0c0-1-.4-1.8-1-2.5.9.6 2 1.8 2 3.8a5 5 0 0 1-10 0c0-3.4 2.3-5 3.6-6.6C11 5.4 11.6 4.2 12 2.5z" />
    </svg>
  );
}

const STATUSES: ProductStatus[] = ['DRAFT', 'AI_PROCESSING', 'AI_READY', 'PUBLISHED', 'FAILED'];

const STATUS_CLASS: Record<string, string> = {
  PUBLISHED: 'badgeSuccess',
  DRAFT: 'badgeNeutral',
  AI_PROCESSING: 'badgeWarning',
  AI_READY: 'badgeWarning',
  FAILED: 'badgeDanger',
};

export function ProductsListPage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<ProductStatus | ''>('');
  const [category, setCategory] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('');
  // Bulk selection — kept across pages, filters and searches so products can
  // be gathered from anywhere before one "Add to collection".
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCollectionId, setBulkCollectionId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  // Save on the product form navigates here with a flash message in route
  // state (rather than local state) since the form unmounts immediately —
  // cleared via replace so a back-navigation or refresh doesn't re-show it.
  const [flashMessage, setFlashMessage] = useState<string | null>(
    (location.state as { flashMessage?: string } | null)?.flashMessage ?? null,
  );
  useEffect(() => {
    if ((location.state as { flashMessage?: string } | null)?.flashMessage) {
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-products', { status, category, collectionFilter, search, page }],
    queryFn: () =>
      fetchAdminProducts({
        status: status || undefined,
        category: category || undefined,
        collectionId: collectionFilter || undefined,
        search: search || undefined,
        page,
        limit: 20,
      }),
  });

  const { data: categoriesData } = useQuery({ queryKey: ['admin-categories'], queryFn: fetchAdminCategories });
  const categoryOptions = categoryPathOptions(categoriesData?.categories ?? []);
  const { data: collectionsData } = useQuery({ queryKey: ['admin-collections'], queryFn: fetchAdminCollections });
  const collections = collectionsData?.collections ?? [];
  const collectionName = (id: string | null | undefined) => (id ? (collections.find((c) => c.id === id)?.name ?? '—') : '—');

  const pageIds = data?.products.map((p) => p.id) ?? [];
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });

  const bulkCollectionMutation = useMutation({
    mutationFn: ({ collectionId }: { collectionId: string | null }) => bulkSetCollection([...selected], collectionId),
    onSuccess: (result, { collectionId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      const name = collectionId ? collectionName(collectionId) : null;
      setFlashMessage(
        name
          ? `${result.updated} product${result.updated === 1 ? '' : 's'} added to “${name}”.`
          : `${result.updated} product${result.updated === 1 ? '' : 's'} removed from their collection.`,
      );
      setSelected(new Set());
      setBulkCollectionId('');
    },
    onError: (err) => window.alert(err instanceof Error ? err.message : 'Could not update collection.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setPendingDelete(null);
    },
    onError: (err) => {
      window.alert(err instanceof Error ? err.message : 'Could not delete product.');
      setPendingDelete(null);
    },
  });

  const featuredMutation = useMutation({
    mutationFn: ({ id, featured }: { id: string; featured: boolean }) => setFeatured(id, featured),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-products'] }),
    onError: (err) => window.alert(err instanceof Error ? err.message : 'Could not update featured status.'),
  });

  const bestSellerMutation = useMutation({
    mutationFn: ({ id, bestSeller }: { id: string; bestSeller: boolean }) => setBestSeller(id, bestSeller),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-products'] }),
    onError: (err) => window.alert(err instanceof Error ? err.message : 'Could not update best seller status.'),
  });

  return (
    <div>
      {flashMessage && <Toast message={flashMessage} variant="success" onDismiss={() => setFlashMessage(null)} />}
      <div className={sharedStyles.pageHeader}>
        <h1 className={sharedStyles.pageTitle}>Products</h1>
        <Link to="/products/new" className={sharedStyles.buttonPrimary}>
          Add Product
        </Link>
      </div>

      <div className={styles.filters}>
        <input
          type="search"
          placeholder="Search by name or SKU"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ProductStatus | '');
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All categories</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.pathLabel}
            </option>
          ))}
        </select>
        <select
          value={collectionFilter}
          onChange={(e) => {
            setCollectionFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All collections</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {selected.size > 0 && (
        <div className={styles.bulkBar} role="region" aria-label="Bulk actions">
          <strong>{selected.size} selected</strong>
          <select value={bulkCollectionId} onChange={(e) => setBulkCollectionId(e.target.value)} aria-label="Collection">
            <option value="">Choose collection…</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.isActive === false ? ' (inactive)' : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={sharedStyles.buttonPrimary}
            disabled={!bulkCollectionId || bulkCollectionMutation.isPending}
            onClick={() => bulkCollectionMutation.mutate({ collectionId: bulkCollectionId })}
          >
            {bulkCollectionMutation.isPending ? 'Saving…' : 'Add to collection'}
          </button>
          <button
            type="button"
            className={sharedStyles.button}
            disabled={bulkCollectionMutation.isPending}
            onClick={() => bulkCollectionMutation.mutate({ collectionId: null })}
          >
            Remove from collection
          </button>
          <button type="button" className={styles.clearLink} onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      <div className={sharedStyles.card}>
        {isLoading && <p className={sharedStyles.empty}>Loading…</p>}
        {!isLoading && data && data.products.length === 0 && (
          <p className={sharedStyles.empty}>No products match this filter.</p>
        )}
        {!isLoading && data && data.products.length > 0 && (
          <table className={`${sharedStyles.table} ${styles.table}`}>
            <thead>
              <tr>
                <th className={styles.checkCell}>
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={togglePage}
                    aria-label="Select all products on this page"
                  />
                </th>
                <th colSpan={2}>Name</th>
                <th>Metal</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Collection</th>
                <th>Status</th>
                <th>Featured</th>
                <th>Best Seller</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((product) => (
                <tr key={product.id} className={selected.has(product.id) ? styles.rowSelected : undefined}>
                  <td className={styles.checkCell}>
                    <input
                      type="checkbox"
                      checked={selected.has(product.id)}
                      onChange={() => toggleOne(product.id)}
                      aria-label={`Select ${product.name}`}
                    />
                  </td>
                  <td className={styles.thumbCell}>
                    {product.primaryImageUrl ? (
                      <img src={product.primaryImageUrl} alt="" className={styles.thumb} />
                    ) : (
                      <div className={styles.thumbPlaceholder} />
                    )}
                  </td>
                  <td>
                    <Link to={`/products/${product.id}/edit`} className={styles.nameLink}>
                      {product.name}
                    </Link>
                  </td>
                  <td>
                    {product.purity ? `${product.purity} ` : ''}
                    {product.purity ?? '9K'} Gold
                  </td>
                  <td>{formatPrice(product.sellingPrice)}</td>
                  <td>{product.availableStock}</td>
                  <td>{collectionName(product.collectionId)}</td>
                  <td>
                    <span className={sharedStyles[STATUS_CLASS[product.status ?? 'DRAFT'] ?? 'badgeNeutral']}>
                      {(product.status ?? 'DRAFT').replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`${styles.featuredButton} ${product.isFeatured ? styles.featuredActive : ''}`}
                      aria-label={product.isFeatured ? `Remove ${product.name} from Featured Product` : `Show ${product.name} in Featured Product`}
                      aria-pressed={product.isFeatured}
                      disabled={featuredMutation.isPending}
                      onClick={() => featuredMutation.mutate({ id: product.id, featured: !product.isFeatured })}
                    >
                      <StarIcon filled={product.isFeatured} />
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`${styles.bestSellerButton} ${product.isBestSeller ? styles.bestSellerActive : ''}`}
                      aria-label={product.isBestSeller ? `Remove ${product.name} from Best Sellers` : `Mark ${product.name} as a Best Seller`}
                      aria-pressed={product.isBestSeller}
                      disabled={bestSellerMutation.isPending}
                      onClick={() => bestSellerMutation.mutate({ id: product.id, bestSeller: !product.isBestSeller })}
                    >
                      <FlameIcon filled={product.isBestSeller} />
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.deleteButton}
                      aria-label={`Delete ${product.name}`}
                      onClick={() => setPendingDelete({ id: product.id, name: product.name })}
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className={sharedStyles.pagination}>
          <button
            type="button"
            className={sharedStyles.button}
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span>
            Page {data.page} of {data.totalPages}
          </span>
          <button
            type="button"
            className={sharedStyles.button}
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete product"
          message={`Delete "${pendingDelete.name}"? This cannot be undone.`}
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
