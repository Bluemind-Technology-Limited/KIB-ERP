import { useEffect, useState } from 'react';
import { Handshake, Plus, Pencil, Mail } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';

interface Supplier {
  id: string;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string | null;
  status: string;
}

const statusBadge: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  INACTIVE: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function Suppliers({ searchQuery = '' }: { searchQuery?: string }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: '', contactPerson: '', email: '', phone: '', address: '', taxId: '' });

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
    setForm({ name: '', contactPerson: '', email: '', phone: '', address: '', taxId: '' });
    setShowModal(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({ name: s.name, contactPerson: s.contactPerson ?? '', email: s.email ?? '', phone: s.phone ?? '', address: s.address ?? '', taxId: s.taxId ?? '' });
    setShowModal(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      setError('Supplier name is required');
      return;
    }
    try {
      if (editing) {
        await axiosClient.patch(`/master-data/suppliers/${editing.id}`, form);
      } else {
        await axiosClient.post('/master-data/suppliers', form);
      }
      setShowModal(false);
      setError('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save supplier');
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
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Supplier Directory</h2>
          <p className="text-[#737373] text-xs">Supplier profiles used by the procurement workflow (requisitions → purchase orders).</p>
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
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>
      )}

      {/* 2. Table */}
      <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
        {loading ? (
          <TableSkeleton cols={6} rows={6} hasAvatar={false} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No suppliers found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
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
                  <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-[#EA4335]/10 flex items-center justify-center shrink-0">
                          <Handshake className="w-3.5 h-3.5 text-[#EA4335]" />
                        </div>
                        <p className="text-xs font-bold text-[#171717] leading-none">{s.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-xs text-slate-600">{s.contactPerson || '—'}</p>
                        {s.email && (
                          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <Mail className="w-2.5 h-2.5" /> {s.email}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{s.phone || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[220px] truncate">{s.address || '—'}</td>
                    <td className="px-4 py-3">
                      {s.taxId ? <span className="text-[10px] font-mono text-slate-500">{s.taxId}</span> : <span className="text-[10px] text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusBadge[s.status] || statusBadge.ACTIVE}`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(s)} className="text-slate-400 hover:text-[#EA4335] p-1">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Add/Edit Modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <form onSubmit={submit} data-lenis-prevent className="kib-scroll bg-white rounded-xl w-full max-w-md p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#171717]">{editing ? 'Edit Supplier' : 'Add Supplier'}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Contact Person</label>
                <input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email</label>
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tax ID</label>
                <input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Address</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">
                Cancel
              </button>
              <button type="submit" className="btn-3d px-4 h-9">
                <span className="text-white text-xs font-semibold">{editing ? 'Save Changes' : 'Add Supplier'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
