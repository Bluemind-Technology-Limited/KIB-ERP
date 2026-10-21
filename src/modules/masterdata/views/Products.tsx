import { useEffect, useState } from 'react';
import { Package, Plus, Pencil, Trash2 } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { DetailsModal, ViewButton, detailDate, detailValue } from '../../../components/ui/DetailsModal';
import { PageDescription } from '../../../components/ui/PageDescription';

interface Product {
  id: string;
  name: string;
  sku: string;
  category?: string | null;
  unitOfMeasure: string;
  /** SOP KIB/QCA/010 — numeric ingredient code used in the lot code. */
  traceabilityCode?: string | null;
  barcode?: string | null;
  defaultExpiryDate?: string | null;
  requiresLot: boolean;
  status: string;
}

const statusBadge: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  INACTIVE: 'bg-slate-100 text-slate-500 border-slate-200',
};

const emptyForm = () => ({
  name: '',
  sku: '',
  category: '',
  unitOfMeasure: '',
  requiresLot: true,
});

export default function Products({ searchQuery = '' }: { searchQuery?: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [viewing, setViewing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [createConfirmation, setCreateConfirmation] = useState(false);
  const [updateConfirmation, setUpdateConfirmation] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get<{ materials: Product[] }>('/master-data/materials', {
        params: { type: 'FINISHED' },
      });
      setProducts(res.data.materials);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load products. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku,
      category: p.category ?? '',
      unitOfMeasure: p.unitOfMeasure,
      requiresLot: p.requiresLot,
    });
    setShowModal(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.unitOfMeasure) {
      setError('Name and Unit of Measure are required');
      return;
    }
    if (editing) setUpdateConfirmation(true);
    else setCreateConfirmation(true);
  };

  const confirmSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, type: 'FINISHED' };
      if (editing) {
        await axiosClient.patch(`/master-data/materials/${editing.id}`, payload);
        setUpdateConfirmation(false);
      } else {
        await axiosClient.post('/master-data/materials', payload);
        setCreateConfirmation(false);
      }
      setShowModal(false);
      setError('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save product');
      setCreateConfirmation(false);
      setUpdateConfirmation(false);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    setIsDeleting(true);
    try {
      await axiosClient.delete(`/master-data/materials/${deleteConfirmation}`);
      setError('');
      setDeleteConfirmation(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete product');
      setDeleteConfirmation(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.category ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Products</h2>
          <PageDescription>Finished products produced from batch formulations and sold as finished goods.</PageDescription>
        </div>
        <button onClick={openAdd} className="btn-3d px-4 h-9 shrink-0 self-start md:self-auto">
          <span className="flex items-center gap-1.5 text-white text-xs font-semibold whitespace-nowrap">
            <Plus className="w-3.5 h-3.5 shrink-0" /> Add Product
          </span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>
      )}

      {/* 2. Products Table */}
      <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
        {loading ? (
          <TableSkeleton cols={7} rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No products found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">SKU</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">UoM</th>
                  <th className="px-4 py-3 font-semibold">Lot Tracking</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <Package className="w-3.5 h-3.5 text-emerald-600" />
                        </div>
                        <p title={p.name} className="text-xs font-bold text-[#171717] leading-none max-w-[180px] truncate">{p.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-mono text-slate-500">{p.sku}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span title={p.category ?? '—'} className="text-[11px] text-slate-500 inline-block max-w-[180px] truncate">{p.category ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{p.unitOfMeasure}</td>
                    <td className="px-4 py-3">
                      {p.requiresLot ? (
                        <span className="text-[10px] text-slate-500">Lot tracked</span>
                      ) : (
                        <span className="text-[10px] text-slate-400">No lot</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusBadge[p.status] || statusBadge.ACTIVE}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ViewButton onClick={() => setViewing(p)} />
                        <button onClick={() => openEdit(p)} className="text-slate-400 hover:text-indigo-600 p-1 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteConfirmation(p.id)} className="text-slate-400 hover:text-rose-600 p-1 transition-colors">
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
          subtitle={<span className="font-mono">{viewing.sku}</span>}
          status={{ label: viewing.status, className: statusBadge[viewing.status] || statusBadge.ACTIVE }}
          onClose={() => setViewing(null)}
          sections={[
            {
              title: 'Overview',
              fields: [
                { label: 'Product', value: detailValue(viewing.name) },
                { label: 'SKU', value: <span className="font-mono">{viewing.sku}</span> },
                { label: 'Category', value: detailValue(viewing.category) },
                { label: 'Unit of measure', value: detailValue(viewing.unitOfMeasure) },
              ],
            },
            {
              title: 'Traceability',
              fields: [
                {
                  label: 'Traceability code',
                  value: viewing.traceabilityCode ? <span className="font-mono">{viewing.traceabilityCode}</span> : '—',
                },
                { label: 'Barcode', value: viewing.barcode ? <span className="font-mono">{viewing.barcode}</span> : '—' },
                { label: 'Lot tracking', value: viewing.requiresLot ? 'Lot tracked' : 'No lot' },
                { label: 'Default expiry', value: detailDate(viewing.defaultExpiryDate) },
              ],
            },
          ]}
        />
      )}

      {/* 3. Add/Edit Modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <form onSubmit={submit} className="bg-white rounded-xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#171717]">{editing ? 'Edit Product' : 'Add Product'}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SKU</label>
                <input
                  value={editing ? form.sku : 'Auto-generated'}
                  disabled
                  className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs bg-slate-50 text-slate-500 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Category</label>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Seasoning, Beverage" className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Unit of Measure *</label>
                <input value={form.unitOfMeasure} onChange={(e) => setForm({ ...form, unitOfMeasure: e.target.value })} placeholder="kg / units / cartons" className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1 flex items-end">
                <label className="flex items-center gap-2 h-9 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={form.requiresLot} onChange={(e) => setForm({ ...form, requiresLot: e.target.checked })} className="accent-[#EA4335]" />
                  Batch/Lot tracking
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">
                Cancel
              </button>
              <button type="submit" className="btn-3d px-4 h-9">
                <span className="text-white text-xs font-semibold">{editing ? 'Save Changes' : 'Create Product'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {createConfirmation && (
        <ConfirmationModal
          type="create"
          title="Create Product"
          description="Add this new finished product to the system."
          onConfirm={confirmSave}
          onCancel={() => setCreateConfirmation(false)}
          isLoading={saving}
        />
      )}

      {updateConfirmation && (
        <ConfirmationModal
          type="update"
          title="Update Product"
          description="Save changes to this product's information."
          onConfirm={confirmSave}
          onCancel={() => setUpdateConfirmation(false)}
          isLoading={saving}
          confirmText="Save"
        />
      )}

      {deleteConfirmation && (
        <ConfirmationModal
          type="delete"
          title="Delete Product"
          description="This product will be permanently deleted. This action cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirmation(null)}
          isLoading={isDeleting}
        />
      )}
    </div>
  );
}
