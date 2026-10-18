import { Fragment, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchContactMessages,
  updateContactMessage,
  type ContactMessage,
  type ContactMessageStatus,
} from '../../api/contactMessages';
import { ApiError } from '../../api/client';
import sharedStyles from '../../styles/shared.module.css';
import styles from './MessagesPage.module.css';

const STATUS_BADGE: Record<ContactMessageStatus, string> = {
  NEW: 'badgeWarning',
  READ: 'badgeInfo',
  RESOLVED: 'badgeSuccess',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

// Storefront "Contact Us" inbox. Opening a NEW message marks it READ;
// admins resolve it (with an optional internal note) once handled. Replies
// go out from the support mailbox itself (the Reply button opens an email).
export function MessagesPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ContactMessageStatus | ''>('NEW');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-contact-messages', { status, search, page }],
    queryFn: () => fetchContactMessages({ status: status || undefined, search: search || undefined, page }),
  });

  const mutation = useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: Parameters<typeof updateContactMessage>[1] }) =>
      updateContactMessage(id, fields),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-contact-messages'] }),
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Could not update this message.'),
  });

  // Opening a NEW message marks it READ — but patched into the current page
  // in place rather than refetched, so it doesn't vanish from the "New"
  // filter (taking its open detail panel with it) the moment it's opened.
  const markReadMutation = useMutation({
    mutationFn: (id: string) => updateContactMessage(id, { status: 'READ' }),
    onSuccess: ({ message }) => {
      queryClient.setQueryData(
        ['admin-contact-messages', { status, search, page }],
        (old: Awaited<ReturnType<typeof fetchContactMessages>> | undefined) =>
          old && {
            ...old,
            newCount: Math.max(0, old.newCount - 1),
            messages: old.messages.map((m) => (m.id === message.id ? message : m)),
          },
      );
    },
  });

  function toggle(message: ContactMessage) {
    if (openId === message.id) {
      setOpenId(null);
      return;
    }
    setOpenId(message.id);
    setNoteDraft(message.adminNote ?? '');
    if (message.status === 'NEW') markReadMutation.mutate(message.id);
  }

  const messages = data?.messages ?? [];

  return (
    <div>
      <div className={sharedStyles.pageHeader}>
        <h1 className={sharedStyles.pageTitle}>
          Messages
          {data && data.newCount > 0 && <span className={styles.newCount}>{data.newCount} new</span>}
        </h1>
      </div>

      <div className={styles.filters}>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ContactMessageStatus | '');
            setPage(1);
          }}
        >
          <option value="NEW">New</option>
          <option value="READ">Read</option>
          <option value="RESOLVED">Resolved</option>
          <option value="">All messages</option>
        </select>
        <form
          className={styles.searchForm}
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchDraft.trim());
            setPage(1);
          }}
        >
          <input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search name, email, phone, order no. or message"
          />
          <button type="submit" className={sharedStyles.button}>
            Search
          </button>
        </form>
      </div>

      <div className={sharedStyles.card}>
        {isLoading && <p className={sharedStyles.empty}>Loading…</p>}
        {!isLoading && messages.length === 0 && <p className={sharedStyles.empty}>No messages here.</p>}
        {messages.length > 0 && (
          <table className={sharedStyles.table}>
            <thead>
              <tr>
                <th>From</th>
                <th>Order no.</th>
                <th>Message</th>
                <th>Status</th>
                <th>Received</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <Fragment key={m.id}>
                  <tr
                    className={`${styles.row} ${m.status === 'NEW' ? styles.rowNew : ''}`}
                    onClick={() => toggle(m)}
                    aria-expanded={openId === m.id}
                  >
                    <td>
                      <div className={styles.sender}>{m.name}</div>
                      <div className={styles.meta}>{m.email}</div>
                    </td>
                    <td>{m.orderNumber ?? '—'}</td>
                    <td className={styles.preview}>{m.message}</td>
                    <td>
                      <span className={sharedStyles[STATUS_BADGE[m.status]]}>{m.status}</span>
                    </td>
                    <td className={styles.meta}>{formatDate(m.createdAt)}</td>
                  </tr>
                  {openId === m.id && (
                    <tr className={styles.detailRow}>
                      <td colSpan={5}>
                        <div className={styles.detail}>
                          <div className={styles.detailMain}>
                            <p className={styles.fullMessage}>{m.message}</p>
                            <dl className={styles.facts}>
                              <dt>Email</dt>
                              <dd>
                                <a href={`mailto:${m.email}`}>{m.email}</a>
                              </dd>
                              <dt>Phone</dt>
                              <dd>{m.phone ? <a href={`tel:${m.phone}`}>{m.phone}</a> : '—'}</dd>
                              <dt>Order no.</dt>
                              <dd>{m.orderNumber ?? '—'}</dd>
                              <dt>Received</dt>
                              <dd>{formatDate(m.createdAt)}</dd>
                              {m.resolvedAt && (
                                <>
                                  <dt>Resolved</dt>
                                  <dd>{formatDate(m.resolvedAt)}</dd>
                                </>
                              )}
                            </dl>
                          </div>
                          <div className={styles.detailSide}>
                            <a
                              className={sharedStyles.buttonPrimary}
                              href={`mailto:${m.email}?subject=${encodeURIComponent('Re: Your message to 9Karet')}`}
                            >
                              Reply by email
                            </a>
                            <label className={styles.noteField}>
                              Internal note
                              <textarea
                                rows={3}
                                value={noteDraft}
                                onChange={(e) => setNoteDraft(e.target.value)}
                                placeholder="Only visible to admins"
                                maxLength={2000}
                              />
                            </label>
                            <div className={styles.actions}>
                              <button
                                type="button"
                                className={sharedStyles.button}
                                disabled={mutation.isPending || noteDraft === (m.adminNote ?? '')}
                                onClick={() => mutation.mutate({ id: m.id, fields: { adminNote: noteDraft.trim() || null } })}
                              >
                                Save note
                              </button>
                              {m.status !== 'RESOLVED' ? (
                                <button
                                  type="button"
                                  className={sharedStyles.buttonPrimary}
                                  disabled={mutation.isPending}
                                  onClick={() =>
                                    mutation.mutate({
                                      id: m.id,
                                      fields: { status: 'RESOLVED', adminNote: noteDraft.trim() || null },
                                    })
                                  }
                                >
                                  Mark resolved
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className={sharedStyles.button}
                                  disabled={mutation.isPending}
                                  onClick={() => mutation.mutate({ id: m.id, fields: { status: 'READ' } })}
                                >
                                  Reopen
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
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
