import { useEffect, useState } from 'react';
import { Users, Plus, Shield, Check, Copy, X, Edit2 } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton, HeaderSkeleton } from '../../../components/ui/Skeleton';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { DetailsModal, ViewButton, detailDate, detailValue } from '../../../components/ui/DetailsModal';
import { PageDescription } from '../../../components/ui/PageDescription';
import { Pagination } from '../../../components/ui/Pagination';
import { usePagination } from '../../../hooks/usePagination';

interface ManageUsersProps {
  searchQuery?: string;
}

interface ApiUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export default function ManageUsers({ searchQuery = '' }: ManageUsersProps) {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [lastTempPass, setLastTempPass] = useState('');
  const [newUser, setNewUser] = useState({ firstName: '', lastName: '', email: '', role: 'STORE_OFFICER', tempPass: '' });
  const [editingUser, setEditingUser] = useState<ApiUser | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', role: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [deletingUser, setDeletingUser] = useState<ApiUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewing, setViewing] = useState<ApiUser | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get<{ users: ApiUser[] }>('/auth/users');
      setUsers(res.data.users);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load users. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredUsers = users.filter((u) =>
    u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const { page, totalPages, total, pageItems, setPage } = usePagination(filteredUsers);

  const handleOpenModal = () => {
    setNewUser({ firstName: '', lastName: '', email: '', role: 'STORE_OFFICER', tempPass: '' });
    setLastTempPass('');
    setError('');
    setIsModalOpen(true);
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(lastTempPass);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 1500);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.firstName || !newUser.lastName || !newUser.email) return;
    setProvisioning(true);
    try {
      const res = await axiosClient.post<{ user: ApiUser; tempPass: string }>('/auth/users', {
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        role: newUser.role,
      });
      setUsers((prev) => [res.data.user, ...prev]);
      setLastTempPass(res.data.tempPass);
      setNewUser({ ...newUser, tempPass: res.data.tempPass });
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to provision user');
    } finally {
      setProvisioning(false);
    }
  };

  const handleEditClick = (user: ApiUser) => {
    setEditingUser(user);
    setEditForm({
      firstName: user.fullName.split(' ')[0] || '',
      lastName: user.fullName.split(' ').slice(1).join(' ') || '',
      role: user.role,
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editForm.firstName || !editForm.lastName) return;
    setIsSaving(true);
    try {
      const res = await axiosClient.put<{ user: ApiUser }>(`/auth/users/${editingUser.id}`, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        role: editForm.role,
      });
      setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? res.data.user : u)));
      setIsEditModalOpen(false);
      setEditingUser(null);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update user');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (user: ApiUser) => {
    setDeletingUser(user);
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      await axiosClient.delete(`/auth/users/${deletingUser.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id));
      setDeletingUser(null);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete user');
      setDeletingUser(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 text-ink">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink">User Accounts Management</h2>
          <PageDescription>Provision new dashboard accounts, manage role policies and view generated credentials.</PageDescription>
        </div>
        <button
          onClick={handleOpenModal}
          className="btn-3d h-9 px-4 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
        >
          <Plus className="w-4 h-4 text-white" />
          <span>Provision User</span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>
      )}

      <div className="bg-surface border border-line rounded-lg p-5">
        <h3 className="text-sm font-bold text-ink-2 flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-[#EA4335]" />
          Dashboard Operators Directory
        </h3>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="space-y-6">
              <HeaderSkeleton />
              <TableSkeleton cols={5} rows={6} hasAvatar={false} />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-xs text-ink-faint">No users found.</div>
          ) : (
            <>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-3 border-b border-line text-ink-2">
                  <th className="py-3.5 px-4 font-semibold">Full Name</th>
                  <th className="py-3.5 px-3 font-semibold">Email Address</th>
                  <th className="py-3.5 px-3 font-semibold">System Access Role</th>
                  <th className="py-3.5 px-3 font-semibold">Status</th>
                  <th className="py-3.5 px-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pageItems.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="py-4 px-4 font-semibold text-ink-2">
                      <div className="max-w-[180px] truncate" title={u.fullName}>{u.fullName}</div>
                    </td>
                    <td className="py-4 px-3 text-ink-muted font-medium">
                      <div className="max-w-[180px] truncate" title={u.email}>{u.email}</div>
                    </td>
                    <td className="py-4 px-3">
                      <span className="rounded-full inline-flex items-center justify-center gap-1 min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-slate-600 text-white">
                        <Shield className="w-2.5 h-2.5 opacity-60" />
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-3">
                      <span className={`rounded-full inline-flex items-center justify-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider  ${u.isActive ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                        {u.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ViewButton onClick={() => setViewing(u)} />
                        <button
                          onClick={() => handleEditClick(u)}
                          className="rounded-md bg-sky-600 px-2.5 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-sky-700"
                          title="Edit user"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteClick(u)}
                          className="rounded-md bg-rose-600 px-2.5 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-rose-700"
                          title="Delete user"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
            </>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {isModalOpen && (
        <Modal onClose={() => setIsModalOpen(false)}>
          <div className="bg-surface border border-line rounded-lg w-full max-w-md p-6 relative flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-ink-faint hover:text-ink-2 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-ink flex items-center gap-2">
              <Users className="w-4 h-4 text-[#EA4335]" />
              Provision New User
            </h3>

            {lastTempPass && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">User created. Temporary password:</p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm font-bold font-mono text-emerald-800 dark:text-emerald-300">{lastTempPass}</code>
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="h-7 px-2 border border-emerald-200 hover:bg-emerald-100 text-xs font-semibold rounded-md flex items-center gap-1 transition-colors cursor-pointer bg-surface dark:border-emerald-500/30 dark:hover:bg-emerald-500/15"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" /> : <Copy className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />}
                  </button>
                </div>
                <p className="text-[9px] text-emerald-600 mt-1 dark:text-emerald-300">Copy and provide this to the user now — it is shown only once.</p>
              </div>
            )}

            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-1">First Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Isaac"
                    value={newUser.firstName}
                    onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                    className="w-full bg-surface border border-line rounded-lg py-2 px-3 text-xs text-ink focus:outline-none focus:border-[#EA4335]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-1">Last Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Wayne"
                    value={newUser.lastName}
                    onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                    className="w-full bg-surface border border-line rounded-lg py-2 px-3 text-xs text-ink focus:outline-none focus:border-[#EA4335]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="name@kib.group"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full bg-surface border border-line rounded-lg py-2 px-3 text-xs text-ink focus:outline-none focus:border-[#EA4335]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-1">Access Role Policy</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full bg-surface border border-line rounded-lg py-2 px-3 text-xs text-ink focus:outline-none focus:border-[#EA4335]"
                >
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="EXECUTIVE_ADMIN">Executive Admin</option>
                  <option value="PRODUCTION_MANAGER">Production Manager</option>
                  <option value="PRODUCTION_SUPERVISOR">Production Supervisor</option>
                  <option value="GRINDING_SUPERVISOR">Grinding Supervisor</option>
                  <option value="STORE_OFFICER">Store Officer (Stock Manager)</option>
                  <option value="PROCUREMENT_OFFICER">Procurement Officer</option>
                  <option value="QC">QC</option>
                  <option value="HEAD_OF_QC">Head of QC</option>
                </select>
              </div>

              <div className="mt-6">
                <button
                  type="submit"
                  disabled={provisioning}
                  className="w-full h-[40px] btn-3d flex items-center justify-center gap-1.5 active:scale-98 transition-transform cursor-pointer text-white font-bold text-xs disabled:opacity-50"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>{provisioning ? 'Provisioning…' : 'Provision Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Edit User Modal */}
      {isEditModalOpen && editingUser && (
        <Modal onClose={() => setIsEditModalOpen(false)}>
          <div className="bg-surface border border-line rounded-lg w-full max-w-md p-6 relative flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 text-ink-faint hover:text-ink-2 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-ink flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-[#EA4335]" />
              Edit User
            </h3>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-1">First Name</label>
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    className="w-full bg-surface border border-line rounded-lg py-2 px-3 text-xs text-ink focus:outline-none focus:border-[#EA4335]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-1">Last Name</label>
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    className="w-full bg-surface border border-line rounded-lg py-2 px-3 text-xs text-ink focus:outline-none focus:border-[#EA4335]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-1">Email Address</label>
                <input
                  type="email"
                  value={editingUser.email}
                  disabled
                  className="w-full bg-surface-2 border border-line rounded-lg py-2 px-3 text-xs text-ink-muted cursor-not-allowed"
                />
                <p className="text-[9px] text-ink-muted mt-1">Email cannot be changed</p>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-1">Access Role Policy</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full bg-surface border border-line rounded-lg py-2 px-3 text-xs text-ink focus:outline-none focus:border-[#EA4335]"
                >
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="EXECUTIVE_ADMIN">Executive Admin</option>
                  <option value="PRODUCTION_MANAGER">Production Manager</option>
                  <option value="PRODUCTION_SUPERVISOR">Production Supervisor</option>
                  <option value="GRINDING_SUPERVISOR">Grinding Supervisor</option>
                  <option value="STORE_OFFICER">Store Officer (Stock Manager)</option>
                  <option value="PROCUREMENT_OFFICER">Procurement Officer</option>
                  <option value="QC">QC</option>
                  <option value="HEAD_OF_QC">Head of QC</option>
                </select>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 h-[40px] border border-line hover:bg-surface-2 rounded-lg font-bold text-xs text-ink transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 h-[40px] btn-3d flex items-center justify-center gap-1.5 active:scale-98 transition-transform cursor-pointer text-white font-bold text-xs disabled:opacity-50"
                >
                  <Check className="w-4 h-4 text-white" />
                  <span>{isSaving ? 'Saving…' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Details Modal */}
      {viewing && (
        <DetailsModal
          title={viewing.fullName}
          subtitle={viewing.email}
          status={{
            label: viewing.isActive ? 'ACTIVE' : 'INACTIVE',
            className: viewing.isActive
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600 text-white',
          }}
          onClose={() => setViewing(null)}
          sections={[
            {
              title: 'Account',
              fields: [
                { label: 'Full name', value: detailValue(viewing.fullName) },
                { label: 'Username', value: detailValue(viewing.username) },
                { label: 'Email address', value: detailValue(viewing.email), wide: true },
              ],
            },
            {
              title: 'Access',
              fields: [
                {
                  label: 'System access role',
                  value: viewing.role.replace(/_/g, ' '),
                },
                { label: 'Authentication', value: 'Supabase Auth' },
                { label: 'Status', value: viewing.isActive ? 'Active' : 'Inactive' },
                { label: 'User ID', value: <span className="font-mono text-[10px]">{detailValue(viewing.id)}</span>, wide: true },
              ],
            },
            {
              title: 'Timeline',
              fields: [{ label: 'Account created', value: detailDate(viewing.createdAt, true), wide: true }],
            },
          ]}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <ConfirmationModal
          type="delete"
          isOpen={!!deletingUser}
          title="Delete User"
          message={`Are you sure you want to delete ${deletingUser.fullName}? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          isLoading={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingUser(null)}
          isDangerous
        />
      )}
    </div>
  );
}
