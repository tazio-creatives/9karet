import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { fetchMe, updateMe } from '../../api/customers';
import { ApiError } from '../../api/client';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import styles from './AccountProfilePage.module.css';

export function AccountProfilePage() {
  useDocumentTitle('Profile Details');
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['me'], queryFn: fetchMe });

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.customer) {
      setFullName(data.customer.fullName ?? '');
      setEmail(data.customer.email ?? '');
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: () => updateMe({ fullName, email }),
    onSuccess: (result) => {
      queryClient.setQueryData(['me'], result);
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => {
      setSaved(false);
      setError(err instanceof ApiError ? err.message : 'Could not save changes.');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    updateMutation.mutate();
  }

  if (isLoading) {
    return (
      <div aria-busy="true">
        <h2 className={styles.subheading}>Profile Details</h2>
        <div className={styles.skeletonCard} />
      </div>
    );
  }

  const customer = data?.customer;

  return (
    <div>
      <h2 className={styles.subheading}>Profile Details</h2>
      <form className={styles.card} onSubmit={handleSubmit}>
        <label className={styles.field}>
          Full Name
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
        </label>
        <label className={styles.field}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label className={styles.field}>
          Mobile Number
          {/* Phone is the OTP-verified identity, not editable from a plain
              profile form — changing it goes through PHONE_CHANGE OTP
              verification (see otpService.js), a separate flow this page
              doesn't build a UI for yet. */}
          <input value={customer?.mobileNumber ?? ''} disabled />
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className={styles.success} aria-live="polite">
            Profile updated.
          </p>
        )}

        <button type="submit" className={styles.submit} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
