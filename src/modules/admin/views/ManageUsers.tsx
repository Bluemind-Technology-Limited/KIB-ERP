import { useEffect, useState } from 'react';
import { Users, Plus, Shield, Check, Copy, X, Edit2, Trash2 } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton, HeaderSkeleton } from '../../../components/ui/Skeleton';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';

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
    <div className="space-y-6 text-[#171717]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#171717]">User Accounts Management</h2>
          <p className="text-xs text-[#737373]">Provision new dashboard accounts, manage role policies and view generated credentials.</p>
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
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>
      )}

      <div className="bg-white border border-[#E9E9E9] rounded-lg p-5">
        <h3 className="text-sm font-bold text-[#313131] flex items-center gap-2 mb-4">
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
            <div className="py-12 text-center text-xs text-slate-400">No users found.</div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F2F2F2] border-b border-[#E9E9E9] text-[#313131]">
                  <th className="py-3.5 px-4 font-semibold">Full Name</th>
                  <th className="py-3.5 px-3 font-semibold">Email Address</th>
                  <th className="py-3.5 px-3 font-semibold">System Access Role</th>
                  <th className="py-3.5 px-3 font-semibold">Authentication</th>
                  <th className="py-3.5 px-3 font-semibold">Status</th>
                  <th className="py-3.5 px-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9E9E9]">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-4 font-semibold text-[#313131]">{u.fullName}</td>
                    <td className="py-4 px-3 text-[#737373] font-medium">{u.email}</td>
                    <td className="py-4 px-3">
                      <span className="inline-flex items-center gap-1 text-[9px] bg-slate-100 text-[#171717] px-2 py-0.5 rounded font-bold border border-slate-200">
                        <Shield className="w-2.5 h-2.5 opacity-60" />
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-[#737373] font-mono text-[11px]">Supabase Auth</td>
                    <td className="py-4 px-3">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border ${u.isActive ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border-rose-500/20'}`}>
                        {u.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEditClick(u)}
                        className="h-7 w-7 rounded border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                        title="Edit user"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(u)}
                        className="h-7 w-7 rounded border border-rose-200 hover:bg-rose-50 text-rose-600 hover:text-rose-700 flex items-center justify-center transition-colors cursor-pointer"
                        title="Delete user"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {isModalOpen && (
        <Modal onClose={() => setIsModalOpen(false)}>
          <div className="bg-white border border-[#E9E9E9] rounded-lg w-full max-w-md p-6 relative flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-[#171717] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#EA4335]" />
              Provision New User
            </h3>

            {lastTempPass && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                <p className="text-[10px] font-semibold text-emerald-700">User created. Temporary password:</p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm font-bold font-mono text-emerald-800">{lastTempPass}</code>
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="h-7 px-2 border border-emerald-200 hover:bg-emerald-100 text-xs font-semibold rounded-md flex items-center gap-1 transition-colors cursor-pointer bg-white"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-emerald-700" />}
                  </button>
                </div>
                <p className="text-[9px] text-emerald-600 mt-1">Copy and provide this to the user now — it is shown only once.</p>
              </div>
            )}

            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1">First Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Isaac"
                    value={newUser.firstName}
                    onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-[#171717] focus:outline-none focus:border-[#EA4335]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1">Last Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Wayne"
                    value={newUser.lastName}
                    onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-[#171717] focus:outline-none focus:border-[#EA4335]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="name@kib.group"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-[#171717] focus:outline-none focus:border-[#EA4335]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1">Access Role Policy</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-[#171717] focus:outline-none focus:border-[#EA4335]"
                >
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="EXECUTIVE_ADMIN">Executive Admin</option>
                  <option value="PRODUCTION_MANAGER">Production Manager</option>
                  <option value="STORE_OFFICER">Store Officer</option>
                  <option value="PROCUREMENT_OFFICER">Procurement Officer</option>
                  <option value="QA_INSPECTOR">QA Inspector</option>
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
          <div className="bg-white border border-[#E9E9E9] rounded-lg w-full max-w-md p-6 relative flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-[#171717] flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-[#EA4335]" />
              Edit User
            </h3>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1">First Name</label>
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-[#171717] focus:outline-none focus:border-[#EA4335]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1">Last Name</label>
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-[#171717] focus:outline-none focus:border-[#EA4335]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1">Email Address</label>
                <input
                  type="email"
                  value={editingUser.email}
                  disabled
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs text-[#737373] cursor-not-allowed"
                />
                <p className="text-[9px] text-[#737373] mt-1">Email cannot be changed</p>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1">Access Role Policy</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-[#171717] focus:outline-none focus:border-[#EA4335]"
                >
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="EXECUTIVE_ADMIN">Executive Admin</option>
                  <option value="PRODUCTION_MANAGER">Production Manager</option>
                  <option value="STORE_OFFICER">Store Officer</option>
                  <option value="PROCUREMENT_OFFICER">Procurement Officer</option>
                  <option value="QA_INSPECTOR">QA Inspector</option>
                </select>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 h-[40px] border border-slate-200 hover:bg-slate-50 rounded-lg font-bold text-xs text-[#171717] transition-colors cursor-pointer"
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

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <ConfirmationModal
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
