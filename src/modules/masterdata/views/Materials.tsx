import { useEffect, useState } from 'react';
import { Package, Plus, Search, Pencil, QrCode } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';

interface Material {
  id: string;
  name: string;
  sku: string;
  type: 'RAW' | 'PACKAGING' | 'FINISHED';
  category?: string | null;
  unitOfMeasure: string;
  barcode?: string | null;
  shelfLifeDays?: number | null;
  requiresLot: boolean;
  attachments?: { name?: string; url?: string; kind?: string }[] | null;
  status: string;
  suppliers?: Array<{ supplier: { id: string; name: string } }>;
}

interface SupplierOption {
  id: string;
  name: string;
}

const typeBadge: Record<string, string> = {
  RAW: 'bg-amber-50 text-amber-700 border-amber-200',
  PACKAGING: 'bg-sky-50 text-sky-700 border-sky-200',
  FINISHED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};
const statusBadge: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  INACTIVE: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function Materials({ searchQuery = '' }: { searchQuery?: string }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [filter, setFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [form, setForm] = useState({
    name: '',
    sku: '',
    type: 'RAW',
    category: '',
    unitOfMeasure: '',
    barcode: '',
    shelfLifeDays: '',
    requiresLot: true,
    nafdacUrl: '',
    msdsUrl: '',
    supplierIds: [] as string[],
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get<{ materials: Material[] }>('/master-data/materials', {
        params: { type: filter || undefined, supplierId: supplierFilter || undefined },
      });
      setMaterials(res.data.materials);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load materials. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter, supplierFilter]);

  // Suppliers for the tag filter + modal multi-select.
  useEffect(() => {
    axiosClient
      .get<{ suppliers: SupplierOption[] }>('/master-data/suppliers')
      .then((res) => setSuppliers(res.data.suppliers))
      .catch(() => {});
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', sku: '', type: 'RAW', category: '', unitOfMeasure: '', barcode: '', shelfLifeDays: '', requiresLot: true, nafdacUrl: '', msdsUrl: '', supplierIds: [] });
    setShowModal(true);
  };

  const openEdit = (m: Material) => {
    setEditing(m);
    setForm({
      name: m.name,
      sku: m.sku,
      type: m.type,
      category: m.category ?? '',
      unitOfMeasure: m.unitOfMeasure,
      barcode: m.barcode ?? '',
      shelfLifeDays: m.shelfLifeDays ? String(m.shelfLifeDays) : '',
      requiresLot: m.requiresLot,
      nafdacUrl: (m.attachments?.find((a) => a.kind === 'NAFDAC')?.url) ?? '',
      msdsUrl: (m.attachments?.find((a) => a.kind === 'MSDS')?.url) ?? '',
      supplierIds: (m.suppliers ?? []).map((s) => s.supplier.id),
    });
    setShowModal(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.sku || !form.unitOfMeasure) {
      setError('Name, SKU and Unit of Measure are required');
      return;
    }
    const attachments = [
      form.nafdacUrl ? { kind: 'NAFDAC', url: form.nafdacUrl, name: 'NAFDAC Certificate' } : null,
      form.msdsUrl ? { kind: 'MSDS', url: form.msdsUrl, name: 'Material Safety Data Sheet' } : null,
    ].filter(Boolean);

    try {
      if (editing) {
        await axiosClient.patch(`/master-data/materials/${editing.id}`, {
          ...form,
          shelfLifeDays: form.shelfLifeDays ? Number(form.shelfLifeDays) : null,
          attachments,
        });
      } else {
        await axiosClient.post('/master-data/materials', {
          ...form,
          shelfLifeDays: form.shelfLifeDays ? Number(form.shelfLifeDays) : null,
          attachments,
        });
      }
      setShowModal(false);
      setError('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save material');
    }
  };

  const filtered = materials.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.barcode ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Material Master</h2>
          <p className="text-[#737373] text-xs">Raw, Packaging and Finished materials with barcodes, attachments & expiry parameters.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Type (RAW/PACKAGING/FINISHED)"
              className="pl-9 pr-3 h-9 rounded-lg border border-[#E9E9E9] bg-white text-xs text-[#171717] w-56 focus:outline-none focus:border-[#EA4335]"
            />
          </div>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="h-9 rounded-lg border border-[#E9E9E9] bg-white px-2.5 text-xs text-[#171717] focus:outline-none focus:border-[#EA4335]"
          >
            <option value="">All suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button onClick={openAdd} className="btn-3d px-4 h-9">
            <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
              <Plus className="w-3.5 h-3.5" /> Add Material
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
          <TableSkeleton cols={8} rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No materials found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-semibold">Material</th>
                  <th className="px-4 py-3 font-semibold">SKU</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Suppliers</th>
                  <th className="px-4 py-3 font-semibold">UoM</th>
                  <th className="px-4 py-3 font-semibold">Expiry</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-[#EA4335]/10 flex items-center justify-center shrink-0">
                          <Package className="w-3.5 h-3.5 text-[#EA4335]" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#171717] leading-none">{m.name}</p>
                          {m.barcode && (
                            <p className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-1">
                              <QrCode className="w-2.5 h-2.5" /> {m.barcode}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-mono text-slate-500">{m.sku}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${typeBadge[m.type]}`}>{m.type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {(m.suppliers ?? []).length === 0 ? (
                          <span className="text-[10px] text-slate-400">—</span>
                        ) : (
                          (m.suppliers ?? []).map(({ supplier }) => (
                            <span key={supplier.id} className="text-[9px] font-semibold text-[#171717] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                              {supplier.name}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{m.unitOfMeasure}</td>
                    <td className="px-4 py-3">
                      {m.requiresLot ? (
                        <span className="text-[10px] text-slate-500">
                          {m.shelfLifeDays ? `${m.shelfLifeDays} days` : 'Lot tracked'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">No lot</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusBadge[m.status] || statusBadge.ACTIVE}`}>{m.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(m)} className="text-slate-400 hover:text-[#EA4335] p-1">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowModal(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="bg-white rounded-xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#171717]">{editing ? 'Edit Material' : 'Add Material'}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SKU *</label>
                <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Type *</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                  <option value="RAW">Raw</option>
                  <option value="PACKAGING">Packaging</option>
                  <option value="FINISHED">Finished</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Category</label>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Flavour, Chemical" className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Unit of Measure *</label>
                <input value={form.unitOfMeasure} onChange={(e) => setForm({ ...form, unitOfMeasure: e.target.value })} placeholder="kg / liters / units" className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Barcode</label>
                <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Shelf Life (days)</label>
                <input value={form.shelfLifeDays} onChange={(e) => setForm({ ...form, shelfLifeDays: e.target.value })} type="number" placeholder="e.g. 365" className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1 flex items-end">
                <label className="flex items-center gap-2 h-9 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={form.requiresLot} onChange={(e) => setForm({ ...form, requiresLot: e.target.checked })} className="accent-[#EA4335]" />
                  Batch/Lot tracking
                </label>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">NAFDAC Certificate URL</label>
                <input value={form.nafdacUrl} onChange={(e) => setForm({ ...form, nafdacUrl: e.target.value })} placeholder="https://…" className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">MSDS URL</label>
                <input value={form.msdsUrl} onChange={(e) => setForm({ ...form, msdsUrl: e.target.value })} placeholder="https://…" className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">
                Cancel
              </button>
              <button type="submit" className="btn-3d px-4 h-9">
                <span className="text-white text-xs font-semibold">{editing ? 'Save Changes' : 'Create Material'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
