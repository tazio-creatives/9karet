import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  fetchAdminUsers,
  fetchAdminRoles,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  createAdminRole,
  updateAdminRole,
} from '../../api/adminUsers';
import type { AdminRole, AdminRoleInput, AdminUser, AdminUserInput } from '../../api/types';
import { useAdmin } from '../../features/auth/useAdmin';
import { ApiError } from '../../api/client';
import { ADMIN_PERMISSION_MODULES, PERMISSION_LABELS } from '../../utils/permissions';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import sharedStyles from '../../styles/shared.module.css';
import styles from './AdminUsersListPage.module.css';

type Mode = { type: 'none' } | { type: 'add' } | { type: 'edit'; adminUser: AdminUser };
type RoleMode = { type: 'none' } | { type: 'add' } | { type: 'edit'; role: AdminRole };

function AdminUserForm({
  initial,
  roles,
  onSubmit,
  onCancel,
  isSelf,
}: {
  initial?: AdminUser;
  roles: AdminRole[];
  onSubmit: (_input: AdminUserInput) => Promise<unknown>;
  onCancel: () => void;
  isSelf?: boolean;
}) {
  const [email, setEmail] = useState(initial?.email ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [roleId, setRoleId] = useState(initial?.role.id ?? roles[0]?.id ?? '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const input: AdminUserInput = initial
        ? { fullName, roleId, isActive, ...(password ? { password } : {}) }
        : { email, password, fullName, roleId };
      await onSubmit(input);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save admin user.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={sharedStyles.cardPadded}>
      <div className={sharedStyles.formGrid2}>
        <label className={sharedStyles.field}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!!initial}
            required
          />
        </label>
        <label className={sharedStyles.field}>
          Full Name
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </label>
        <label className={sharedStyles.field}>
          {initial ? 'New Password (optional)' : 'Password'}
          <div className={styles.passwordRow}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={10}
              required={!initial}
              placeholder={initial ? 'Leave blank to keep current' : 'At least 10 characters'}
            />
            <button
              type="button"
              className={styles.togglePassword}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>
        <label className={sharedStyles.field}>
          Role
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} disabled={isSelf} required>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {isSelf && <p className={styles.hint}>You cannot change your own role.</p>}
      {initial && (
        <label className={`${sharedStyles.field} ${sharedStyles.checkboxField} ${sharedStyles.formSection}`}>
          <input
            type="checkbox"
            checked={isActive}
            disabled={isSelf}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active {isSelf && '(you cannot deactivate your own account)'}
        </label>
      )}
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

const PROTECTED_ROLE_NAME = 'SUPER_ADMIN';

function RoleForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: AdminRole;
  onSubmit: (_input: AdminRoleInput) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [permissions, setPermissions] = useState<Set<string>>(new Set(initial?.permissions ?? []));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function togglePermission(module: string) {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (permissions.size === 0) {
      setError('Select at least one permission.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({ name, permissions: Array.from(permissions) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save role.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={sharedStyles.cardPadded}>
      <label className={sharedStyles.field}>
        Role Name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Order Manager" required />
      </label>

      <div className={sharedStyles.formSection}>
        <span className={sharedStyles.field}>Can access</span>
        <div className={styles.permissionGrid}>
          {ADMIN_PERMISSION_MODULES.map((module) => (
            <label key={module} className={styles.permissionCheckbox}>
              <input
                type="checkbox"
                checked={permissions.has(module)}
                onChange={() => togglePermission(module)}
              />
              {PERMISSION_LABELS[module]}
            </label>
          ))}
        </div>
      </div>

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

export function AdminUsersListPage() {
  const queryClient = useQueryClient();
  const { admin: currentAdmin } = useAdmin();
  const { data, isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: () => fetchAdminUsers() });
  const { data: rolesData } = useQuery({ queryKey: ['admin-roles'], queryFn: fetchAdminRoles });
  const [mode, setMode] = useState<Mode>({ type: 'none' });
  const [roleMode, setRoleMode] = useState<RoleMode>({ type: 'none' });
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  const invalidateRoles = () => queryClient.invalidateQueries({ queryKey: ['admin-roles'] });

  const createMutation = useMutation({
    mutationFn: (input: AdminUserInput) => createAdminUser(input),
    // A new user changes its role's adminUserCount too — the Roles table
    // below reads the same list, so it goes stale without this.
    onSuccess: () => {
      invalidate();
      invalidateRoles();
      setMode({ type: 'none' });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdminUserInput }) => updateAdminUser(id, input),
    // Same reasoning — reassigning a user's role shifts the count on both
    // the old and new role.
    onSuccess: () => {
      invalidate();
      invalidateRoles();
      setMode({ type: 'none' });
    },
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Could not update admin user.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAdminUser(id),
    onSuccess: () => {
      invalidate();
      invalidateRoles();
      setPendingDelete(null);
    },
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Could not delete admin user.'),
  });

  const createRoleMutation = useMutation({
    mutationFn: (input: AdminRoleInput) => createAdminRole(input),
    onSuccess: () => {
      invalidateRoles();
      setRoleMode({ type: 'none' });
    },
  });
  const updateRoleMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdminRoleInput }) => updateAdminRole(id, input),
    onSuccess: () => {
      invalidateRoles();
      setRoleMode({ type: 'none' });
    },
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Could not update role.'),
  });

  if (isLoading) return <p>Loading…</p>;
  const adminUsers = data?.adminUsers ?? [];
  const roles = rolesData?.roles ?? [];

  return (
    <div>
      <div className={sharedStyles.pageHeader}>
        <h1 className={sharedStyles.pageTitle}>Admin Users</h1>
        {mode.type === 'none' && roles.length > 0 && (
          <button type="button" className={sharedStyles.buttonPrimary} onClick={() => setMode({ type: 'add' })}>
            Add Admin User
          </button>
        )}
      </div>

      {mode.type === 'add' && (
        <div className={styles.formWrapper}>
          <AdminUserForm
            roles={roles}
            onSubmit={(input) => createMutation.mutateAsync(input)}
            onCancel={() => setMode({ type: 'none' })}
          />
        </div>
      )}
      {mode.type === 'edit' && (
        <div className={styles.formWrapper}>
          <AdminUserForm
            initial={mode.adminUser}
            roles={roles}
            isSelf={mode.adminUser.id === currentAdmin?.id}
            onSubmit={(input) => updateMutation.mutateAsync({ id: mode.adminUser.id, input })}
            onCancel={() => setMode({ type: 'none' })}
          />
        </div>
      )}

      <div className={sharedStyles.card}>
        {adminUsers.length === 0 && <p className={sharedStyles.empty}>No admin users yet.</p>}
        {adminUsers.length > 0 && (
          <table className={sharedStyles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {adminUsers.map((adminUser) => (
                <tr key={adminUser.id}>
                  <td>
                    {adminUser.fullName}
                    {adminUser.id === currentAdmin?.id && <span className={styles.youBadge}>you</span>}
                  </td>
                  <td>{adminUser.email}</td>
                  <td>{adminUser.role.name}</td>
                  <td>
                    <span className={adminUser.isActive ? sharedStyles.badgeSuccess : sharedStyles.badgeNeutral}>
                      {adminUser.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={sharedStyles.buttonLink}
                        onClick={() => setMode({ type: 'edit', adminUser })}
                      >
                        Edit
                      </button>
                      {adminUser.id !== currentAdmin?.id && (
                        <button
                          type="button"
                          className={sharedStyles.buttonLink}
                          onClick={() => setPendingDelete(adminUser)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete admin user"
          message={`Delete ${pendingDelete.fullName} (${pendingDelete.email})? This cannot be undone — they will immediately lose admin access.`}
          confirmLabel="Delete"
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      <div className={styles.sectionHeader}>
        <h2 className={sharedStyles.pageTitle}>Roles</h2>
        {roleMode.type === 'none' && (
          <button type="button" className={sharedStyles.buttonPrimary} onClick={() => setRoleMode({ type: 'add' })}>
            Add Role
          </button>
        )}
      </div>

      {roleMode.type === 'add' && (
        <div className={styles.formWrapper}>
          <RoleForm
            onSubmit={(input) => createRoleMutation.mutateAsync(input)}
            onCancel={() => setRoleMode({ type: 'none' })}
          />
        </div>
      )}
      {roleMode.type === 'edit' && (
        <div className={styles.formWrapper}>
          <RoleForm
            initial={roleMode.role}
            onSubmit={(input) => updateRoleMutation.mutateAsync({ id: roleMode.role.id, input })}
            onCancel={() => setRoleMode({ type: 'none' })}
          />
        </div>
      )}

      <div className={sharedStyles.card}>
        {roles.length === 0 && <p className={sharedStyles.empty}>No roles yet.</p>}
        {roles.length > 0 && (
          <table className={sharedStyles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Permissions</th>
                <th>Admins</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id}>
                  <td>{role.name}</td>
                  <td>
                    {role.permissions.includes('*')
                      ? 'All'
                      : role.permissions.map((p) => PERMISSION_LABELS[p as keyof typeof PERMISSION_LABELS] ?? p).join(', ')}
                  </td>
                  <td>{role.adminUserCount ?? 0}</td>
                  <td>
                    {role.name === PROTECTED_ROLE_NAME ? (
                      <span className={styles.protectedNote}>System role</span>
                    ) : (
                      <button
                        type="button"
                        className={sharedStyles.buttonLink}
                        onClick={() => setRoleMode({ type: 'edit', role })}
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
