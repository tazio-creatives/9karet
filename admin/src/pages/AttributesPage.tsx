import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  fetchAttributes,
  createAttribute,
  updateAttribute,
  createAttributeValue,
  updateAttributeValue,
  type Attribute,
} from '../api/attributes';
import { ApiError } from '../api/client';
import sharedStyles from '../styles/shared.module.css';
import styles from './AttributesPage.module.css';

// Product variation types (Purity, Gold Color, and whatever's added
// here) — the one place an admin can introduce a
// genuinely new variation axis (e.g. "Chain Length") without a developer
// running a migration. Size is deliberately not managed here — its values
// are per-product free text, entered on the product form itself.
export function AttributesPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [showNewAttributeForm, setShowNewAttributeForm] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [valueDrafts, setValueDrafts] = useState<Record<string, { value: string; label: string }>>({});

  const { data, isLoading } = useQuery({ queryKey: ['admin-attributes'], queryFn: fetchAttributes });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-attributes'] });

  const createAttributeMutation = useMutation({
    mutationFn: createAttribute,
    onSuccess: () => {
      invalidate();
      setShowNewAttributeForm(false);
      setNewCode('');
      setNewName('');
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not create attribute.'),
  });

  const updateAttributeMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateAttribute(id, { isActive }),
    onSuccess: invalidate,
  });

  const createValueMutation = useMutation({
    mutationFn: ({ attributeId, value, label }: { attributeId: string; value: string; label: string }) =>
      createAttributeValue(attributeId, { value, label }),
    onSuccess: (_data, { attributeId }) => {
      invalidate();
      setValueDrafts((prev) => ({ ...prev, [attributeId]: { value: '', label: '' } }));
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not add value.'),
  });

  const updateValueMutation = useMutation({
    mutationFn: ({ valueId, isActive }: { valueId: string; isActive: boolean }) =>
      updateAttributeValue(valueId, { isActive }),
    onSuccess: invalidate,
  });

  const attributes = (data?.attributes ?? []).filter((a) => a.code !== 'size');

  function draftFor(attributeId: string) {
    return valueDrafts[attributeId] ?? { value: '', label: '' };
  }

  return (
    <div>
      <div className={sharedStyles.pageHeader}>
        <h1 className={sharedStyles.pageTitle}>Attributes</h1>
        {!showNewAttributeForm && (
          <button type="button" className={sharedStyles.buttonPrimary} onClick={() => setShowNewAttributeForm(true)}>
            Add Attribute
          </button>
        )}
      </div>
      <p className={styles.pageSubtext}>
        Product variation types — Purity (always 9K) and Gold Color are built in. Add a new one here (e.g.
        "Chain Length") to make it available on every product's variation form.
      </p>

      {error && <p className={sharedStyles.error}>{error}</p>}

      {showNewAttributeForm && (
        <section className={`${sharedStyles.cardPadded} ${styles.newAttributeForm}`}>
          <div className={styles.formRow}>
            <label className={styles.field}>
              Code
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="chain_length"
                className={styles.textInput}
              />
              <span className={styles.hint}>Lowercase letters, numbers, underscores only</span>
            </label>
            <label className={styles.field}>
              Display Name
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Chain Length"
                className={styles.textInput}
              />
            </label>
          </div>
          <div className={styles.formActions}>
            <button
              type="button"
              className={sharedStyles.buttonPrimary}
              disabled={!newCode.trim() || !newName.trim() || createAttributeMutation.isPending}
              onClick={() => createAttributeMutation.mutate({ code: newCode.trim(), name: newName.trim() })}
            >
              {createAttributeMutation.isPending ? 'Creating…' : 'Create'}
            </button>
            <button type="button" className={sharedStyles.buttonLink} onClick={() => setShowNewAttributeForm(false)}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {isLoading && <p className={sharedStyles.empty}>Loading…</p>}

      {attributes.map((attribute: Attribute) => {
        const draft = draftFor(attribute.id);
        return (
          <section key={attribute.id} className={`${sharedStyles.cardPadded} ${styles.section}`}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionHeading}>{attribute.name}</h2>
                <p className={styles.sectionSubtext}>code: {attribute.code}</p>
              </div>
              <span className={attribute.isActive ? sharedStyles.badgeSuccess : sharedStyles.badgeNeutral}>
                {attribute.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            {attribute.code === 'purity' && (
              <p className={styles.sectionSubtext}>
                9Karet sells 9K gold only — every product is 9K, so no other purity can be added.
              </p>
            )}

            {attribute.values.length === 0 && <p className={sharedStyles.empty}>No values yet.</p>}
            {attribute.values.length > 0 && (
              <table className={sharedStyles.table}>
                <thead>
                  <tr>
                    <th>Value</th>
                    <th>Label</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {attribute.values.map((v) => (
                    <tr key={v.id}>
                      <td>{v.refId ? '—' : v.value}</td>
                      <td>{v.label}</td>
                      <td>
                        <span className={v.isActive ? sharedStyles.badgeSuccess : sharedStyles.badgeNeutral}>
                          {v.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className={styles.rowActions}>
                        <button
                          type="button"
                          className={sharedStyles.buttonLink}
                          disabled={updateValueMutation.isPending}
                          onClick={() => updateValueMutation.mutate({ valueId: v.id, isActive: !v.isActive })}
                        >
                          {v.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {attribute.code !== 'purity' && (
            <div className={styles.addValueRow}>
              <input
                value={draft.value}
                onChange={(e) => setValueDrafts((prev) => ({ ...prev, [attribute.id]: { ...draft, value: e.target.value } }))}
                placeholder="Value (e.g. 18)"
                className={styles.textInput}
              />
              <input
                value={draft.label}
                onChange={(e) => setValueDrafts((prev) => ({ ...prev, [attribute.id]: { ...draft, label: e.target.value } }))}
                placeholder="Label (e.g. 18 inch)"
                className={styles.textInput}
              />
              <button
                type="button"
                className={sharedStyles.button}
                disabled={!draft.value.trim() || !draft.label.trim() || createValueMutation.isPending}
                onClick={() =>
                  createValueMutation.mutate({ attributeId: attribute.id, value: draft.value.trim(), label: draft.label.trim() })
                }
              >
                Add Value
              </button>
            </div>
            )}

            <button
              type="button"
              className={sharedStyles.buttonLink}
              onClick={() => updateAttributeMutation.mutate({ id: attribute.id, isActive: !attribute.isActive })}
            >
              {attribute.isActive ? 'Deactivate this attribute' : 'Activate this attribute'}
            </button>
          </section>
        );
      })}
    </div>
  );
}
