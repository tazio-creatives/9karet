import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { fetchAddresses, createAddress, updateAddress, deleteAddress } from '../../api/addresses';
import type { AddressInput } from '../../api/types';
import { AddressForm } from '../../features/address/AddressForm';
import { AddressCard } from '../../features/address/AddressCard';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import styles from './AccountAddressesPage.module.css';

export function AccountAddressesPage() {
  useDocumentTitle('Addresses');
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['addresses'], queryFn: fetchAddresses });
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['addresses'] });

  const createMutation = useMutation({
    mutationFn: (input: AddressInput) => createAddress(input),
    onSuccess: () => {
      invalidate();
      setIsAdding(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<AddressInput> }) => updateAddress(id, input),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAddress(id),
    onSuccess: invalidate,
  });

  if (isLoading) {
    return (
      <div aria-busy="true">
        <div className={styles.header}>
          <h2 className={styles.subheading}>Addresses</h2>
        </div>
        <div className={styles.list}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard} />
          ))}
        </div>
      </div>
    );
  }
  const addresses = data?.addresses ?? [];

  return (
    <div>
      <div className={styles.header}>
        <h2 className={styles.subheading}>Addresses</h2>
        {!isAdding && (
          <button type="button" className={styles.addButton} onClick={() => setIsAdding(true)}>
            Add Address
          </button>
        )}
      </div>

      {isAdding && (
        <div className={styles.formWrapper}>
          <AddressForm
            onSubmit={(input) => createMutation.mutateAsync(input)}
            onCancel={() => setIsAdding(false)}
            submitLabel="Add Address"
          />
        </div>
      )}

      {addresses.length === 0 && !isAdding && <p className={styles.empty}>No saved addresses yet.</p>}

      <div className={styles.list}>
        {addresses.map((address) =>
          editingId === address.id ? (
            <AddressForm
              key={address.id}
              initial={address}
              onSubmit={(input) => updateMutation.mutateAsync({ id: address.id, input })}
              onCancel={() => setEditingId(null)}
              submitLabel="Save Changes"
            />
          ) : (
            <AddressCard
              key={address.id}
              address={address}
              onEdit={() => setEditingId(address.id)}
              onDelete={() => deleteMutation.mutate(address.id)}
              onSetDefault={() => updateMutation.mutate({ id: address.id, input: { isDefault: true } })}
            />
          ),
        )}
      </div>
    </div>
  );
}
