import { useEffect, useState } from 'react';
import { Package, Plus, Pencil, Trash2 } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { DetailsModal, ViewButton, detailValue } from '../../../components/ui/DetailsModal';
import { PageDescription } from '../../../components/ui/PageDescription';

interface Product {
  id: string;
  name: string;
  sku: string;
  category?: string | null;
  /** Rendered pack label, e.g. "100 G". */
  unitOfMeasure: string;
  packSize?: string | number | null;
  packUnit?: string | null;
  /** SOP KIB/QCA/010 — numeric ingredient code used in the lot code. */
  traceabilityCode?: string | null;
  barcode?: string | null;
  defaultExpiryDate?: string | null;
  shelfLifeDays?: number | null;
  requiresLot: boolean;
  status: string;
}

const statusBadge: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
  INACTIVE: 'bg-surface-3 text-ink-muted border-line',
};

const emptyForm = () => ({
  name: '',
  sku: '',
  category: '',
  packSize: '1',
  packUnit: 'KG',
  requiresLot: true,
  /** Shelf life in days — 730 (2 years) unless edited. */
  shelfLifeDays: '730',
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
      packSize: String(p.packSize ?? 1),
      packUnit: p.packUnit ?? 'KG',
      requiresLot: p.requiresLot,
      shelfLifeDays: String(p.shelfLifeDays ?? 730),
    });
    setShowModal(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !(Number(form.packSize) > 0)) {
      setError('Name and a pack size greater than zero are required');
      return;
    }
    if (editing) setUpdateConfirmation(true);
    else setCreateConfirmation(true);
  };

  const confirmSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        type: 'FINISHED',
        packSize: Number(form.packSize),
        shelfLifeDays: form.shelfLifeDays === '' ? null : Number(form.shelfLifeDays),
      };
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
          <h2 className="text-xl font-bold tracking-tight text-ink">Products</h2>
          <PageDescription>Finished products produced from batch formulations and sold as finished goods.</PageDescription>
        </div>
        <button onClick={openAdd} className="btn-3d px-4 h-9 shrink-0 self-start md:self-auto">
          <span className="flex items-center gap-1.5 text-white text-xs font-semibold whitespace-nowrap">
            <Plus className="w-3.5 h-3.5 shrink-0" /> Add Product
          </span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>
      )}

      {/* 2. Products Table */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        {loading ? (
          <TableSkeleton cols={7} rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No products found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint">
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
                  <tr key={p.id} className="border-b border-line hover:bg-surface-2/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0 dark:bg-emerald-500/10">
                          <Package className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />
                        </div>
                        <p title={p.name} className="text-xs font-bold text-ink leading-none max-w-[180px] truncate">{p.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-mono text-ink-muted">{p.sku}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span title={p.category ?? '—'} className="text-[11px] text-ink-muted inline-block max-w-[180px] truncate">{p.category ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-muted">{p.unitOfMeasure}</td>
                    <td className="px-4 py-3">
                      {p.requiresLot ? (
                        <span className="text-[10px] text-ink-muted">Lot tracked</span>
                      ) : (
                        <span className="text-[10px] text-ink-faint">No lot</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusBadge[p.status] || statusBadge.ACTIVE}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ViewButton onClick={() => setViewing(p)} />
                        <button onClick={() => openEdit(p)} className="text-ink-faint hover:text-indigo-600 p-1 transition-colors dark:hover:text-indigo-300">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteConfirmation(p.id)} className="text-ink-faint hover:text-rose-600 p-1 transition-colors dark:hover:text-rose-300">
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
                { label: 'Pack', value: `${viewing.packSize ?? 1} ${viewing.packUnit ?? 'KG'}` },
              ],
            },
            {
              title: 'Traceability',
              fields: [
                {
                  label: 'Traceability code',
                  value: viewing.traceabilityCode ? (
                    <span className="font-mono">{viewing.traceabilityCode}</span>
                  ) : (
                    <span className="text-ink-faint">Not set</span>
                  ),
                },
                { label: 'Lot tracking', value: viewing.requiresLot ? 'Lot tracked' : 'No lot' },
                {
                  label: 'Expiry period',
                  value: viewing.shelfLifeDays
                    ? `${viewing.shelfLifeDays} days`
                    : <span className="text-ink-faint">Not set</span>,
                },
              ],
            },
          ]}
        />
      )}

      {/* 3. Add/Edit Modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <form onSubmit={submit} className="bg-surface rounded-xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">{editing ? 'Edit Product' : 'Add Product'}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-ink-faint hover:text-ink-muted">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 w-full rounded-lg border border-line px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">SKU</label>
                <input
                  value={editing ? form.sku : 'Auto-generated'}
                  disabled
                  className="h-9 w-full rounded-lg border border-line px-3 text-xs bg-surface-2 text-ink-muted focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Category</label>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Seasoning, Beverage" className="h-9 w-full rounded-lg border border-line px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Unit of Measure *</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0.0001"
                    step="any"
                    value={form.packSize}
                    onChange={(e) => setForm({ ...form, packSize: e.target.value })}
                    placeholder="100"
                    className="h-9 w-24 rounded-lg border border-line px-3 text-xs focus:outline-none focus:border-[#EA4335]"
                  />
                  <select
                    value={form.packUnit}
                    onChange={(e) => setForm({ ...form, packUnit: e.target.value })}
                    className="h-9 flex-1 rounded-lg border border-line bg-surface px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                  >
                    <option value="KG">KG</option>
                    <option value="G">G</option>
                    <option value="PCS">PCS</option>
                  </select>
                </div>
                <p className="text-[9px] text-ink-faint">
                  One unit = {form.packSize || '0'} {form.packUnit}. Quantities are counted in these units.
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Expiry Period (days)</label>
                <input
                  value={form.shelfLifeDays}
                  onChange={(e) => setForm({ ...form, shelfLifeDays: e.target.value })}
                  type="number"
                  min="1"
                  placeholder="730"
                  className="h-9 w-full rounded-lg border border-line px-3 text-xs focus:outline-none focus:border-[#EA4335]"
                />
                <p className="text-[9px] text-ink-faint">Defaults to 730 days (2 years) unless edited.</p>
              </div>
              <div className="space-y-1 flex items-end">
                <label className="flex items-center gap-2 h-9 text-xs text-ink-muted cursor-pointer">
                  <input type="checkbox" checked={form.requiresLot} onChange={(e) => setForm({ ...form, requiresLot: e.target.checked })} className="accent-[#EA4335]" />
                  Batch/Lot tracking
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="h-9 px-4 rounded-lg border border-line text-xs font-semibold text-ink-muted">
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
