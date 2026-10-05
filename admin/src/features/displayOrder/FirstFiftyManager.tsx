import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  fetchDisplayOrder,
  resetDisplayOrder,
  saveDisplayOrder,
  searchPlacementProducts,
  type DisplayOrderItem,
  type DisplayOrderProduct,
  type PlacementType,
} from '../../api/displayOrder';
import { ApiError } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { formatPrice } from '../../utils/formatPrice';
import sharedStyles from '../../styles/shared.module.css';
import styles from './FirstFiftyManager.module.css';

const MAX = 50;
const RESET_MESSAGE =
  'Reset the first 50 product order? The storefront will return to its existing default product order. Products will not be deleted.';

// A selected row — saved rows carry warnings; rows added in this session
// come from search results, which only ever return eligible products.
type Row = DisplayOrderProduct & { warnings: string[]; isHidden: boolean };

function toRow(p: DisplayOrderItem | DisplayOrderProduct): Row {
  return 'warnings' in p ? p : { ...p, warnings: p.availableStock <= 0 ? ['Out of stock'] : [], isHidden: false };
}

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function Thumb({ url }: { url: string | null }) {
  return url ? <img src={url} alt="" className={styles.thumb} /> : <span className={styles.thumb} aria-hidden="true" />;
}

function SortableRow({
  row,
  index,
  total,
  onRemove,
  onMove,
}: {
  row: Row;
  index: number;
  total: number;
  onRemove: () => void;
  onMove: (_to: 'top' | 'bottom') => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.productId });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${styles.row} ${isDragging ? styles.rowDragging : ''} ${row.isHidden ? styles.rowHidden : ''}`}
    >
      <span className={styles.position}>{index + 1}</span>
      <button
        type="button"
        className={styles.handle}
        aria-label={`Reorder ${row.name ?? 'product'} (position ${index + 1}). Press space, then arrow keys to move.`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <Thumb url={row.imageUrl} />
      <span className={styles.info}>
        <span className={styles.name}>{row.name ?? 'Deleted product'}</span>
        <span className={styles.meta}>
          {row.sku ?? '—'} · {formatPrice(row.sellingPrice)}
        </span>
        {row.warnings.length > 0 && (
          <span className={styles.warnings}>
            {row.warnings.map((w) => (
              <span key={w} className={w === 'Out of stock' ? sharedStyles.badgeNeutral : sharedStyles.badgeWarning}>
                {w}
              </span>
            ))}
            {row.isHidden && <span className={styles.hiddenNote}>Skipped on storefront</span>}
          </span>
        )}
      </span>
      <span className={styles.rowActions}>
        <button type="button" className={styles.iconButton} onClick={() => onMove('top')} disabled={index === 0} title="Move to top">
          ⤒
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => onMove('bottom')}
          disabled={index === total - 1}
          title="Move to bottom"
        >
          ⤓
        </button>
        <button type="button" className={styles.removeButton} onClick={onRemove} title="Remove">
          Remove
        </button>
      </span>
    </li>
  );
}

// "Manage First 50 Products" for one homepage collection or one category.
export function FirstFiftyManager({
  placementType,
  placementId,
  onClose,
}: {
  placementType: PlacementType;
  placementId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const queryKey = ['display-order', placementType, placementId];
  const { data, isLoading, error: loadError } = useQuery({
    queryKey,
    queryFn: () => fetchDisplayOrder(placementType, placementId),
  });

  const [rows, setRows] = useState<Row[] | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(searchInput.trim(), 300);

  useEffect(() => {
    if (data && rows === null) {
      setRows(data.items.map(toRow));
      setSavedIds(data.items.map((i) => i.productId));
    }
  }, [data, rows]);
  useEffect(() => setPage(1), [search]);

  const current = useMemo(() => rows ?? [], [rows]);
  const selectedIds = useMemo(() => new Set(current.map((r) => r.productId)), [current]);
  const isDirty = current.map((r) => r.productId).join() !== savedIds.join();
  const isFull = current.length >= MAX;

  // Unsaved-change warning when leaving the page entirely.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const { data: results, isFetching: isSearching } = useQuery({
    queryKey: ['display-order-search', placementType, placementId, search, page],
    queryFn: () => searchPlacementProducts(placementType, placementId, { search: search || undefined, page }),
    placeholderData: keepPreviousData,
  });

  const applyServer = (res: { items: DisplayOrderItem[] }) => {
    setRows(res.items.map(toRow));
    setSavedIds(res.items.map((i) => i.productId));
    queryClient.setQueryData(queryKey, res);
  };

  const saveMutation = useMutation({
    mutationFn: () => saveDisplayOrder(placementType, placementId, current.map((r) => r.productId)),
    onSuccess: (res) => {
      applyServer(res);
      setMessage({ kind: 'success', text: 'First 50 product order saved successfully.' });
    },
    // The unsaved arrangement stays on screen so nothing is lost.
    onError: (err) =>
      setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Could not save the order. Please try again.' }),
  });

  const resetMutation = useMutation({
    mutationFn: () => resetDisplayOrder(placementType, placementId),
    onSuccess: (res) => {
      applyServer(res);
      setConfirmReset(false);
      setMessage({ kind: 'success', text: 'Order reset — the storefront now uses its default product order.' });
    },
    onError: (err) => {
      setConfirmReset(false);
      setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Could not reset the order.' });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function update(next: Row[]) {
    setRows(next);
    setMessage(null);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = current.findIndex((r) => r.productId === active.id);
    const to = current.findIndex((r) => r.productId === over.id);
    update(arrayMove(current, from, to));
  }

  function add(product: DisplayOrderProduct) {
    if (isFull || selectedIds.has(product.productId)) return;
    update([...current, toRow(product)]);
  }

  function move(index: number, to: 'top' | 'bottom') {
    update(arrayMove(current, index, to === 'top' ? 0 : current.length - 1));
  }

  function close() {
    if (isDirty && !window.confirm('You have unsaved changes to this order. Close without saving?')) return;
    onClose();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmReset) close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const placementLabel = placementType === 'category' ? 'Category' : 'Homepage collection';

  return (
    <div className={styles.overlay}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Manage First 50 Products">
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Manage First 50 Products</h2>
            <p className={styles.subtitle}>
              {placementLabel}: <strong>{data?.placement.name ?? '…'}</strong>
            </p>
          </div>
          <button type="button" className={styles.close} onClick={close} aria-label="Close">
            ×
          </button>
        </div>

        {isLoading || rows === null ? (
          <p className={styles.state}>{loadError ? 'Could not load the saved order.' : 'Loading…'}</p>
        ) : (
          <div className={styles.columns}>
            <section className={styles.column} aria-label="Available products">
              <h3 className={styles.columnTitle}>Available products</h3>
              <input
                type="search"
                className={styles.search}
                placeholder="Search by product name or SKU…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <ul className={styles.results} aria-busy={isSearching}>
                {results?.products.map((p) => {
                  const isSelected = selectedIds.has(p.productId);
                  return (
                    <li key={p.productId} className={styles.resultRow}>
                      <Thumb url={p.imageUrl} />
                      <span className={styles.info}>
                        <span className={styles.name}>{p.name}</span>
                        <span className={styles.meta}>
                          {p.sku} · {formatPrice(p.sellingPrice)} ·{' '}
                          {p.availableStock > 0 ? 'In stock' : 'Out of stock'}
                        </span>
                      </span>
                      <button
                        type="button"
                        className={sharedStyles.button}
                        disabled={isSelected || isFull}
                        onClick={() => add(p)}
                      >
                        {isSelected ? 'Added' : 'Add'}
                      </button>
                    </li>
                  );
                })}
                {results && results.products.length === 0 && <li className={styles.state}>No matching products.</li>}
              </ul>
              {results && results.totalPages > 1 && (
                <div className={styles.pager}>
                  <button type="button" className={sharedStyles.button} disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    ← Prev
                  </button>
                  <span className={styles.meta}>
                    Page {page} of {results.totalPages} · {results.total} products
                  </span>
                  <button
                    type="button"
                    className={sharedStyles.button}
                    disabled={page >= results.totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Next →
                  </button>
                </div>
              )}
            </section>

            <section className={styles.column} aria-label="Selected products">
              <h3 className={styles.columnTitle}>
                Selected products{' '}
                <span className={isFull ? styles.counterFull : styles.counter}>
                  {current.length}/{MAX} selected
                </span>
              </h3>
              {isFull && (
                <p className={styles.fullNote}>The list is full — remove a product before adding another.</p>
              )}
              {current.length === 0 ? (
                <p className={styles.state}>
                  No products selected. The storefront uses its default order. Add products from the left to pin them to
                  the top, in the order you set here.
                </p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={current.map((r) => r.productId)} strategy={verticalListSortingStrategy}>
                    <ol className={styles.selected}>
                      {current.map((row, i) => (
                        <SortableRow
                          key={row.productId}
                          row={row}
                          index={i}
                          total={current.length}
                          onRemove={() => update(current.filter((r) => r.productId !== row.productId))}
                          onMove={(to) => move(i, to)}
                        />
                      ))}
                    </ol>
                  </SortableContext>
                </DndContext>
              )}
              <p className={styles.hint}>
                Products after the ones you pin continue in the default order. Customer sorting (price, newest…) ignores
                this order.
              </p>
            </section>
          </div>
        )}

        <div className={styles.footer}>
          {message && (
            <p className={message.kind === 'success' ? styles.success : sharedStyles.error} role="status">
              {message.text}
            </p>
          )}
          {isDirty && !message && <p className={styles.meta}>You have unsaved changes.</p>}
          <div className={styles.footerActions}>
            <button
              type="button"
              className={sharedStyles.buttonDanger}
              disabled={resetMutation.isPending || saveMutation.isPending || (savedIds.length === 0 && !isDirty)}
              onClick={() => setConfirmReset(true)}
            >
              Reset Order
            </button>
            <button
              type="button"
              className={sharedStyles.buttonPrimary}
              disabled={saveMutation.isPending || !isDirty || rows === null}
              onClick={() => {
                setMessage(null);
                saveMutation.mutate();
              }}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save Order'}
            </button>
          </div>
        </div>
      </div>

      {confirmReset && (
        <ConfirmDialog
          title="Reset order?"
          message={RESET_MESSAGE}
          confirmLabel="Reset Order"
          isPending={resetMutation.isPending}
          onConfirm={() => resetMutation.mutate()}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}
