import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchAdminCustomers } from '../../api/customers';
import sharedStyles from '../../styles/shared.module.css';
import styles from './CustomersListPage.module.css';

export function CustomersListPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-customers', { search, page }],
    queryFn: () => fetchAdminCustomers(search || undefined, page, 20),
  });

  return (
    <div>
      <div className={sharedStyles.pageHeader}>
        <h1 className={sharedStyles.pageTitle}>Customers</h1>
      </div>

      <div className={styles.filters}>
        <input
          type="search"
          placeholder="Search by name, mobile, or email"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className={sharedStyles.card}>
        {isLoading && <p className={sharedStyles.empty}>Loading…</p>}
        {!isLoading && data && data.customers.length === 0 && (
          <p className={sharedStyles.empty}>No customers found.</p>
        )}
        {!isLoading && data && data.customers.length > 0 && (
          <table className={sharedStyles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile</th>
                <th>Email</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {data.customers.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <Link to={`/customers/${customer.id}`}>{customer.fullName ?? '—'}</Link>
                  </td>
                  <td>{customer.mobileNumber}</td>
                  <td>{customer.email ?? '—'}</td>
                  <td>{new Date(customer.createdAt).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className={sharedStyles.pagination}>
          <button type="button" className={sharedStyles.button} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
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
    </div>
  );
}
