import { useState, type ReactNode } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { fetchAdminCategories, createCategory, updateCategory, deleteCategory } from '../api/categories';
import type { Category, CategoryInput } from '../api/types';
import { buildCategoryTree, type CategoryTreeNode } from '../utils/categoryTree';
import { CategoryForm } from '../features/categories/CategoryForm';
import { Toast } from '../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FirstFiftyManager } from '../features/displayOrder/FirstFiftyManager';
import sharedStyles from '../styles/shared.module.css';
import styles from './CategoriesPage.module.css';

type Mode = { type: 'none' } | { type: 'add'; parentId: string | null } | { type: 'edit'; category: Category };

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-categories'], queryFn: fetchAdminCategories });
  const [mode, setMode] = useState<Mode>({ type: 'none' });
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CategoryTreeNode | null>(null);
  const [orderingCategoryId, setOrderingCategoryId] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-categories'] });

  const createMutation = useMutation({
    mutationFn: (input: Partial<CategoryInput>) => createCategory(input),
    onSuccess: () => {
      invalidate();
      setMode({ type: 'none' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CategoryInput> }) => updateCategory(id, input),
    onSuccess: () => {
      invalidate();
      setMode({ type: 'none' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      invalidate();
      setPendingDelete(null);
    },
    onError: (err) => {
      setErrorToast(err instanceof Error ? err.message : 'Could not delete category.');
      setPendingDelete(null);
    },
  });

  if (isLoading) return <p>Loading…</p>;
  const categories = data?.categories ?? [];
  const tree = buildCategoryTree(categories);

  function renderNode(node: CategoryTreeNode): ReactNode {
    return (
      <div key={node.id}>
        <div className={styles.row} style={{ paddingLeft: node.depth * 24 }}>
          {node.imageUrl ? (
            <img src={node.imageUrl} alt="" className={styles.thumb} />
          ) : (
            <span className={styles.thumbPlaceholder} />
          )}
          <span className={styles.name}>{node.name}</span>
          <span className={styles.slug}>/{node.slug}</span>
          <span className={node.isActive ? sharedStyles.badgeSuccess : sharedStyles.badgeNeutral}>
            {node.isActive ? 'Active' : 'Inactive'}
          </span>
          <div className={styles.actions}>
            <button
              type="button"
              className={sharedStyles.buttonLink}
              onClick={() => setMode({ type: 'add', parentId: node.id })}
            >
              + Subcategory
            </button>
            <button
              type="button"
              className={sharedStyles.buttonLink}
              onClick={() => setMode({ type: 'edit', category: node })}
            >
              Edit
            </button>
            <button type="button" className={sharedStyles.buttonLink} onClick={() => setOrderingCategoryId(node.id)}>
              Manage First 50 Products
            </button>
            <button type="button" className={sharedStyles.buttonLink} onClick={() => setPendingDelete(node)}>
              Delete
            </button>
          </div>
        </div>
        {node.children.map(renderNode)}
      </div>
    );
  }

  return (
    <div>
      <div className={sharedStyles.pageHeader}>
        <h1 className={sharedStyles.pageTitle}>Categories</h1>
        {mode.type === 'none' && (
          <button
            type="button"
            className={sharedStyles.buttonPrimary}
            onClick={() => setMode({ type: 'add', parentId: null })}
          >
            Add Category
          </button>
        )}
      </div>

      {mode.type === 'add' && (
        <div className={styles.formWrapper}>
          <CategoryForm
            categories={categories}
            defaultParentId={mode.parentId}
            onSubmit={(input) => createMutation.mutateAsync(input)}
            onCancel={() => setMode({ type: 'none' })}
          />
        </div>
      )}
      {mode.type === 'edit' && (
        <div className={styles.formWrapper}>
          <CategoryForm
            initial={mode.category}
            categories={categories}
            onSubmit={(input) => updateMutation.mutateAsync({ id: mode.category.id, input })}
            onCancel={() => setMode({ type: 'none' })}
          />
        </div>
      )}

      <div className={sharedStyles.card}>
        {tree.length === 0 && <p className={sharedStyles.empty}>No categories yet.</p>}
        {tree.map(renderNode)}
      </div>

      {errorToast && <Toast message={errorToast} variant="error" onDismiss={() => setErrorToast(null)} />}

      {orderingCategoryId && (
        <FirstFiftyManager
          placementType="category"
          placementId={orderingCategoryId}
          onClose={() => setOrderingCategoryId(null)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete category"
          message={`Delete "${pendingDelete.name}"? This cannot be undone.`}
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
