import { useEffect, useState } from 'react';
import { Handshake, Plus, Pencil, Mail, Trash2 } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { DetailsModal, ViewButton, detailValue } from '../../../components/ui/DetailsModal';
import { PageDescription } from '../../../components/ui/PageDescription';

interface Supplier {
  id: string;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string | null;
  /** SOP KIB/QCA/010 — alphabetic vendor code used in the lot code (e.g. "A"). */
  vendorCode?: string | null;
  status: string;
}

const statusBadge: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
  INACTIVE: 'bg-surface-3 text-ink-muted border-line',
};

export default function Suppliers({ searchQuery = '' }: { searchQuery?: string }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [viewing, setViewing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: '', contactPerson: '', email: '', phone: '', address: '', taxId: '', vendorCode: '' });
  const [createConfirmation, setCreateConfirmation] = useState(false);
  const [updateConfirmation, setUpdateConfirmation] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get<{ suppliers: Supplier[] }>('/master-data/suppliers');
      setSuppliers(res.data.suppliers);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load suppliers. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', contactPerson: '', email: '', phone: '', address: '', taxId: '', vendorCode: '' });
    setShowModal(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({ name: s.name, contactPerson: s.contactPerson ?? '', email: s.email ?? '', phone: s.phone ?? '', address: s.address ?? '', taxId: s.taxId ?? '', vendorCode: s.vendorCode ?? '' });
    setShowModal(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      setError('Supplier name is required');
      return;
    }
    if (editing) {
      setUpdateConfirmation(true);
    } else {
      setCreateConfirmation(true);
    }
  };

  const confirmSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await axiosClient.patch(`/master-data/suppliers/${editing.id}`, form);
        setUpdateConfirmation(false);
      } else {
        await axiosClient.post('/master-data/suppliers', form);
        setCreateConfirmation(false);
      }
      setShowModal(false);
      setError('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save supplier');
      setCreateConfirmation(false);
      setUpdateConfirmation(false);
    } finally {
      setSaving(false);
    }
  };

  const deleteSupplier = async (id: string) => {
    setDeleteConfirmation(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    setIsDeleting(true);
    try {
      await axiosClient.delete(`/master-data/suppliers/${deleteConfirmation}`);
      setError('');
      setDeleteConfirmation(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete supplier');
      setDeleteConfirmation(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.contactPerson ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.email ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-ink">Supplier Directory</h2>
          <PageDescription>Supplier profiles used by the procurement workflow (requisitions → purchase orders).</PageDescription>
        </div>
        <div className="flex gap-2">
          <button onClick={openAdd} className="btn-3d px-4 h-9">
            <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
              <Plus className="w-3.5 h-3.5" /> Add Supplier
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>
      )}

      {/* 2. Table */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        {loading ? (
          <TableSkeleton cols={6} rows={6} hasAvatar={false} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No suppliers found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint">
                  <th className="px-4 py-3 font-semibold">Supplier</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 font-semibold">Address</th>
                  <th className="px-4 py-3 font-semibold">Tax ID</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-line hover:bg-surface-2/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-[#EA4335]/10 flex items-center justify-center shrink-0">
                          <Handshake className="w-3.5 h-3.5 text-[#EA4335]" />
                        </div>
                        <p title={s.name} className="text-xs font-bold text-ink leading-none max-w-[180px] truncate">{s.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p title={s.contactPerson || '—'} className="text-xs text-ink-muted max-w-[180px] truncate">{s.contactPerson || '—'}</p>
                        {s.email && (
                          <p title={s.email} className="text-[10px] text-ink-faint mt-0.5 flex items-center gap-1 max-w-[180px]">
                            <Mail className="w-2.5 h-2.5 shrink-0" /> <span className="truncate">{s.email}</span>
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-muted">{s.phone || '—'}</td>
                    <td className="px-4 py-3 text-xs text-ink-muted max-w-[180px] truncate" title={s.address || '—'}>{s.address || '—'}</td>
                    <td className="px-4 py-3">
                      {s.taxId ? <span className="text-[10px] font-mono text-ink-muted">{s.taxId}</span> : <span className="text-[10px] text-ink-faint">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusBadge[s.status] || statusBadge.ACTIVE}`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ViewButton onClick={() => setViewing(s)} />
                        <button onClick={() => openEdit(s)} className="text-ink-faint hover:text-indigo-600 p-1 transition-colors dark:hover:text-indigo-300">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteSupplier(s.id)} className="text-ink-faint hover:text-rose-600 p-1 transition-colors dark:hover:text-rose-300">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {viewing && (
        <DetailsModal
          title={viewing.name}
          subtitle={viewing.vendorCode ? <span className="font-mono">Vendor code {viewing.vendorCode}</span> : undefined}
          status={{ label: viewing.status, className: statusBadge[viewing.status] || statusBadge.ACTIVE }}
          onClose={() => setViewing(null)}
          sections={[
            {
              title: 'Contact',
              fields: [
                { label: 'Supplier', value: detailValue(viewing.name) },
                { label: 'Contact person', value: detailValue(viewing.contactPerson) },
                { label: 'Email', value: detailValue(viewing.email) },
                { label: 'Phone', value: detailValue(viewing.phone) },
              ],
            },
            {
              title: 'Address',
              fields: [{ label: 'Address', value: detailValue(viewing.address), wide: true }],
            },
            {
              title: 'Compliance',
              fields: [
                { label: 'Tax ID', value: viewing.taxId ? <span className="font-mono">{viewing.taxId}</span> : '—' },
                {
                  label: 'Vendor code',
                  value: viewing.vendorCode ? <span className="font-mono">{viewing.vendorCode}</span> : '—',
                },
                {
                  label: 'Status',
                  value: (
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border inline-block ${statusBadge[viewing.status] || statusBadge.ACTIVE}`}>
                      {viewing.status}
                    </span>
                  ),
                },
              ],
            },
          ]}
        />
      )}

      {/* 3. Add/Edit Modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <form onSubmit={submit} className="bg-surface rounded-xl w-full max-w-md p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">{editing ? 'Edit Supplier' : 'Add Supplier'}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-ink-faint hover:text-ink-muted">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 w-full rounded-lg border border-line px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Contact Person</label>
                <input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className="h-9 w-full rounded-lg border border-line px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Email</label>
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9 w-full rounded-lg border border-line px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-9 w-full rounded-lg border border-line px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Tax ID</label>
                <input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} className="h-9 w-full rounded-lg border border-line px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Vendor Code</label>
                <input value={form.vendorCode} onChange={(e) => setForm({ ...form, vendorCode: e.target.value })} placeholder="e.g. A" className="h-9 w-full rounded-lg border border-line px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
                <p className="text-[9px] text-ink-faint">Used in lot codes (SOP KIB/QCA/010). Optional.</p>
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Address</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="h-9 w-full rounded-lg border border-line px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="h-9 px-4 rounded-lg border border-line text-xs font-semibold text-ink-muted">
                Cancel
              </button>
              <button type="submit" className="btn-3d px-4 h-9">
                <span className="text-white text-xs font-semibold">{editing ? 'Save Changes' : 'Add Supplier'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create Confirmation Modal */}
      {createConfirmation && (
        <ConfirmationModal
          type="create"
          title="Create Supplier"
          description="Add this new supplier to the system directory."
          onConfirm={confirmSave}
          onCancel={() => setCreateConfirmation(false)}
          isLoading={saving}
        />
      )}

      {/* Update Confirmation Modal */}
      {updateConfirmation && (
        <ConfirmationModal
          type="update"
          title="Update Supplier"
          description="Save changes to this supplier's information."
          onConfirm={confirmSave}
          onCancel={() => setUpdateConfirmation(false)}
          isLoading={saving}
          confirmText="Save"
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <ConfirmationModal
          type="delete"
          title="Delete Supplier"
          description="This supplier will be permanently deleted. This action cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirmation(null)}
          isLoading={isDeleting}
        />
      )}
    </div>
  );
}
