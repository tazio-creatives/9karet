import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  fetchAdminProduct,
  fetchProductVariants,
  updateProductVariant,
  bulkUpdateProductVariants,
  type ProductVariantRow,
} from '../../api/products';
import { formatPrice } from '../../utils/formatPrice';
import sharedStyles from '../../styles/shared.module.css';
import styles from './ProductVariantsPage.module.css';

interface RowDraft {
  stockQuantity: string;
  goldWeightGrams: string;
  priceOverride: string;
  isAvailable: boolean;
}

function toDraft(v: ProductVariantRow): RowDraft {
  return {
    stockQuantity: String(v.stockQuantity),
    goldWeightGrams: v.goldWeightGrams == null ? '' : String(v.goldWeightGrams),
    priceOverride: v.priceOverride == null ? '' : String(v.priceOverride),
    isAvailable: v.isAvailable,
  };
}

type StatusFilter = 'all' | 'active' | 'excluded' | 'overridden';

// Per-combination editor — every real sellable combination for this product
// gets its own row here (stock, optional weight/price overrides,
// availability), each priced live via the same engine the storefront uses.
// New combinations are created by checking boxes on the product edit form
// (Product Variations); this page edits existing ones, one at a time or in
// bulk via the toolbar below.
export function ProductVariantsPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [savedRowId, setSavedRowId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [attrFilters, setAttrFilters] = useState<Record<string, string>>({});
  const [bulkStock, setBulkStock] = useState('');
  const [bulkWeight, setBulkWeight] = useState('');

  const { data: productData } = useQuery({
    queryKey: ['admin-product', id],
    queryFn: () => fetchAdminProduct(id as string),
    enabled: !!id,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-product-variants', id],
    queryFn: () => fetchProductVariants(id as string),
    enabled: !!id,
  });

  useEffect(() => {
    if (!data) return;
    setDrafts(Object.fromEntries(data.variants.map((v) => [v.id, toDraft(v)])));
  }, [data]);

  function setVariantsCache(rows: ProductVariantRow[]) {
    queryClient.setQueryData<{ variants: ProductVariantRow[] } | undefined>(['admin-product-variants', id], (prev) => {
      if (!prev) return prev;
      const byId = new Map(rows.map((r) => [r.id, r]));
      return { variants: prev.variants.map((v) => byId.get(v.id) ?? v) };
    });
  }

  const updateMutation = useMutation({
    mutationFn: ({ variantId, input }: { variantId: string; input: Parameters<typeof updateProductVariant>[2] }) =>
      updateProductVariant(id as string, variantId, input),
    onSuccess: (result) => {
      setVariantsCache([result.variant]);
      setSavedRowId(result.variant.id);
      setTimeout(() => setSavedRowId((cur) => (cur === result.variant.id ? null : cur)), 1500);
    },
  });

  const bulkMutation = useMutation({
    mutationFn: (fields: Parameters<typeof bulkUpdateProductVariants>[2]) =>
      bulkUpdateProductVariants(id as string, [...selected], fields),
    onSuccess: (result) => {
      setVariantsCache(result.variants);
      setSelected(new Set());
      setBulkStock('');
      setBulkWeight('');
    },
  });

  function updateDraft(variantId: string, patch: Partial<RowDraft>) {
    setDrafts((prev) => ({ ...prev, [variantId]: { ...prev[variantId], ...patch } }));
  }

  function saveRow(variantId: string) {
    const draft = drafts[variantId];
    if (!draft) return;
    updateMutation.mutate({
      variantId,
      input: {
        stockQuantity: Number(draft.stockQuantity) || 0,
        goldWeightGrams: draft.goldWeightGrams.trim() === '' ? null : Number(draft.goldWeightGrams),
        priceOverride: draft.priceOverride.trim() === '' ? null : Number(draft.priceOverride),
        isAvailable: draft.isAvailable,
      },
    });
  }

  const variants = data?.variants ?? [];
  const attributeGroups = productData?.product.attributes ?? [];

  const filteredVariants = useMemo(() => {
    return variants.filter((v) => {
      if (search && !v.label.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter === 'active' && !v.isAvailable) return false;
      if (statusFilter === 'excluded' && v.isAvailable) return false;
      if (statusFilter === 'overridden' && v.goldWeightGrams == null && !v.isPriceOverridden) return false;
      for (const valueId of Object.values(attrFilters)) {
        if (valueId && !v.attributeValueIds.includes(valueId)) return false;
      }
      return true;
    });
  }, [variants, search, statusFilter, attrFilters]);

  const allVisibleSelected = filteredVariants.length > 0 && filteredVariants.every((v) => selected.has(v.id));

  function toggleSelectAll() {
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        for (const v of filteredVariants) next.delete(v.id);
        return next;
      }
      const next = new Set(prev);
      for (const v of filteredVariants) next.add(v.id);
      return next;
    });
  }

  function toggleRow(variantId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(variantId)) next.delete(variantId);
      else next.add(variantId);
      return next;
    });
  }

  return (
    <div>
      <div className={sharedStyles.pageHeader}>
        <div>
          <h1 className={sharedStyles.pageTitle}>Variants — {productData?.product.name ?? '…'}</h1>
          <p className={styles.subtext}>
            Every real combination shoppers can buy, each with its own stock, optional weight/price override, and
            live price. Weight and price left blank inherit the product's defaults.
          </p>
        </div>
        {id && <Link to={`/products/${id}/edit`} className={sharedStyles.buttonLink}>← Back to Product</Link>}
      </div>

      {isLoading && <p className={sharedStyles.empty}>Loading…</p>}
      {!isLoading && variants.length === 0 && (
        <p className={sharedStyles.empty}>
          This product has no variations configured — it sells as a single fixed configuration.
        </p>
      )}

      {variants.length > 0 && (
        <>
          <div className={styles.toolbar}>
            <input
              className={styles.searchInput}
              type="search"
              placeholder="Search combinations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              <option value="all">All statuses</option>
              <option value="active">Active only</option>
              <option value="excluded">Excluded only</option>
              <option value="overridden">Overridden only</option>
            </select>
            {attributeGroups.map((attr) => (
              <select
                key={attr.code}
                className={styles.filterSelect}
                value={attrFilters[attr.code] ?? ''}
                onChange={(e) => setAttrFilters((prev) => ({ ...prev, [attr.code]: e.target.value }))}
              >
                <option value="">All {attr.name}</option>
                {attr.values.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            ))}
            <span className={styles.resultCount}>
              {filteredVariants.length} of {variants.length}
            </span>
          </div>

          {selected.size > 0 && (
            <div className={styles.bulkBar}>
              <span className={styles.bulkCount}>{selected.size} selected</span>
              <div className={styles.bulkAction}>
                <input
                  type="number"
                  min={0}
                  placeholder="Stock"
                  className={styles.bulkInput}
                  value={bulkStock}
                  onChange={(e) => setBulkStock(e.target.value)}
                />
                <button
                  type="button"
                  className={sharedStyles.button}
                  disabled={bulkStock.trim() === '' || bulkMutation.isPending}
                  onClick={() => bulkMutation.mutate({ stockQuantity: Number(bulkStock) || 0 })}
                >
                  Set Stock
                </button>
              </div>
              <div className={styles.bulkAction}>
                <input
                  type="number"
                  min={0}
                  step="0.001"
                  placeholder="Weight (g)"
                  className={styles.bulkInput}
                  value={bulkWeight}
                  onChange={(e) => setBulkWeight(e.target.value)}
                />
                <button
                  type="button"
                  className={sharedStyles.button}
                  disabled={bulkWeight.trim() === '' || bulkMutation.isPending}
                  onClick={() => bulkMutation.mutate({ goldWeightGrams: Number(bulkWeight) })}
                >
                  Copy Weight to Selected
                </button>
              </div>
              <button
                type="button"
                className={sharedStyles.button}
                disabled={bulkMutation.isPending}
                onClick={() => bulkMutation.mutate({ isAvailable: true })}
              >
                Set Active
              </button>
              <button
                type="button"
                className={sharedStyles.button}
                disabled={bulkMutation.isPending}
                onClick={() => bulkMutation.mutate({ isAvailable: false })}
              >
                Set Excluded
              </button>
              <button
                type="button"
                className={sharedStyles.buttonLink}
                disabled={bulkMutation.isPending}
                onClick={() =>
                  bulkMutation.mutate({
                    goldWeightGrams: null,
                    priceOverride: null,
                  })
                }
              >
                Reset Selected to Inherited
              </button>
            </div>
          )}

          <table className={sharedStyles.table}>
            <thead>
              <tr>
                <th>
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} aria-label="Select all visible" />
                </th>
                <th>Combination</th>
                <th>Stock</th>
                <th>Gold Weight (g)</th>
                <th>Price Override (₹)</th>
                <th>Available</th>
                <th>Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredVariants.map((v) => {
                const draft = drafts[v.id] ?? toDraft(v);
                const isRowPending = updateMutation.isPending && updateMutation.variables?.variantId === v.id;
                return (
                  <tr key={v.id} className={v.excludedByRuleId ? styles.ruleExcludedRow : undefined}>
                    <td>
                      <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggleRow(v.id)} aria-label={`Select ${v.label}`} />
                    </td>
                    <td>
                      {v.label}
                      {v.excludedByRuleId && <span className={styles.ruleTag}>Rule</span>}
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        className={styles.cellInput}
                        value={draft.stockQuantity}
                        onChange={(e) => updateDraft(v.id, { stockQuantity: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step="0.001"
                        placeholder="inherit"
                        className={styles.cellInput}
                        value={draft.goldWeightGrams}
                        onChange={(e) => updateDraft(v.id, { goldWeightGrams: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="auto"
                        className={`${styles.cellInput} ${v.isPriceOverridden ? styles.cellInputOverridden : ''}`}
                        value={draft.priceOverride}
                        onChange={(e) => updateDraft(v.id, { priceOverride: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={draft.isAvailable}
                        onChange={(e) => updateDraft(v.id, { isAvailable: e.target.checked })}
                      />
                    </td>
                    <td>{formatPrice(v.sellingPrice)}</td>
                    <td>
                      <button
                        type="button"
                        className={sharedStyles.button}
                        disabled={isRowPending}
                        onClick={() => saveRow(v.id)}
                      >
                        {isRowPending ? 'Saving…' : savedRowId === v.id ? 'Saved ✓' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
