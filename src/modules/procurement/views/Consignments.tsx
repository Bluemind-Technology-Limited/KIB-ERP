import { useEffect, useState } from 'react';
import { Truck, Plus, ChevronDown, ChevronRight, CheckCircle2, Trash2, Boxes } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';

interface Material {
  id: string;
  name: string;
  sku: string;
  unitOfMeasure: string;
}

interface Supplier {
  id: string;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
}

interface Warehouse {
  id: string;
  name: string;
  location?: string | null;
}

interface WarehouseBin {
  id: string;
  binCode: string;
  capacity?: number | null;
}

interface ConsignmentItem {
  id: string;
  materialId: string;
  quantity: number;
  unitOfMeasure: string;
  distributedQty: number;
  material: Material;
}

interface ConsignmentDistribution {
  id: string;
  consignmentItemId: string;
  quantity: number;
  distributedAt: Date;
  distributedBy?: { fullName: string };
  bin?: { binCode: string };
}

interface Consignment {
  id: string;
  consignmentNumber: string;
  status: string;
  poNumbers?: string | null;
  shipDate?: Date | null;
  expectedDelivery?: Date | null;
  receivedAt?: Date | null;
  distributedAt?: Date | null;
  createdAt: Date;
  supplier: Supplier;
  warehouse: Warehouse;
  createdBy?: { fullName: string };
  receivedBy?: { fullName: string };
  items: ConsignmentItem[];
  distributions?: ConsignmentDistribution[];
}

const consignmentStatusBadge: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  IN_TRANSIT: 'bg-blue-50 text-blue-700 border-blue-200',
  RECEIVED: 'bg-amber-50 text-amber-700 border-amber-200',
  DISTRIBUTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
};

const emptyItem = { materialId: '', quantity: '' };

export default function Consignments({ searchQuery = '' }: { searchQuery?: string }) {
  const [consignments, setConsignments] = useState<Consignment[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [warehouseBins, setWarehouseBins] = useState<WarehouseBin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDistributionModal, setShowDistributionModal] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ consignmentId: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [createConfirmation, setCreateConfirmation] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<{ consignmentId: string; action: string } | null>(null);

  const [form, setForm] = useState({
    supplierId: '',
    warehouseId: '',
    poNumbers: '',
    shipDate: '',
    expectedDelivery: '',
  });
  const [items, setItems] = useState([{ ...emptyItem }]);

  const [distributions, setDistributions] = useState<Array<{ itemId: string; binId: string; quantity: string }>>([]);
  const [selectedConsignmentForDistribution, setSelectedConsignmentForDistribution] = useState<Consignment | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [consRes, supRes, whRes, matRes, binRes] = await Promise.all([
        axiosClient.get<{ consignments: Consignment[] }>('/procurement/consignments'),
        axiosClient.get<{ suppliers: Supplier[] }>('/master-data/suppliers'),
        axiosClient.get<{ warehouses: Warehouse[] }>('/master-data/warehouses'),
        axiosClient.get<{ materials: Material[] }>('/master-data/materials'),
        axiosClient.get<{ bins: WarehouseBin[] }>('/master-data/warehouse-bins'),
      ]);
      setConsignments(consRes.data.consignments);
      setSuppliers(supRes.data.suppliers);
      setWarehouses(whRes.data.warehouses);
      setMaterials(matRes.data.materials);
      setWarehouseBins(binRes.data.bins);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load consignments. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleExpanded = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const openAdd = () => {
    setForm({ supplierId: '', warehouseId: '', poNumbers: '', shipDate: '', expectedDelivery: '' });
    setItems([{ ...emptyItem }]);
    setError('');
    setShowModal(true);
  };

  const updateItem = (i: number, field: keyof typeof emptyItem, value: string) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx !== i ? item : { ...item, [field]: value }))
    );
  };

  const addItemRow = () => setItems((prev) => [...prev, { ...emptyItem }]);
  const removeItemRow = (i: number) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplierId || !form.warehouseId) {
      setError('Supplier and warehouse are required');
      return;
    }
    const validItems = items.filter((item) => item.materialId && item.quantity);
    if (validItems.length === 0) {
      setError('Add at least one material with quantity');
      return;
    }
    setCreateConfirmation(true);
  };

  const confirmCreate = async () => {
    const validItems = items.filter((item) => item.materialId && item.quantity);
    setSaving(true);
    try {
      const csn = await axiosClient.post<{ consignment: Consignment }>('/procurement/consignments', {
        supplierId: form.supplierId,
        warehouseId: form.warehouseId,
        poNumbers: form.poNumbers || null,
        shipDate: form.shipDate ? new Date(form.shipDate) : null,
        expectedDelivery: form.expectedDelivery ? new Date(form.expectedDelivery) : null,
      });
      const csnId = csn.data.consignment.id;

      // Add items to consignment
      for (const item of validItems) {
        await axiosClient.post(`/procurement/consignments/${csnId}/items`, {
          materialId: item.materialId,
          quantity: Number(item.quantity),
          unitOfMeasure: materials.find((m) => m.id === item.materialId)?.unitOfMeasure || 'kg',
        });
      }

      setShowModal(false);
      setCreateConfirmation(false);
      setError('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create consignment');
      setCreateConfirmation(false);
    } finally {
      setSaving(false);
    }
  };

  const openDistributionModal = (consignment: Consignment) => {
    setSelectedConsignmentForDistribution(consignment);
    const bins = warehouseBins.filter((b) => b.warehouseId === consignment.warehouseId || !b.warehouseId);
    setDistributions(
      consignment.items.map((item) => ({
        itemId: item.id,
        binId: bins[0]?.id || '',
        quantity: '',
      }))
    );
    setShowDistributionModal(consignment.id);
  };

  const submitDistribution = async () => {
    if (!selectedConsignmentForDistribution) return;
    setSaving(true);
    try {
      for (const dist of distributions) {
        if (dist.binId && dist.quantity) {
          await axiosClient.post(
            `/procurement/consignments/${selectedConsignmentForDistribution.id}/distribute`,
            {
              consignmentItemId: dist.itemId,
              binId: dist.binId,
              quantity: Number(dist.quantity),
            }
          );
        }
      }
      setShowDistributionModal(null);
      setSelectedConsignmentForDistribution(null);
      setError('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to distribute consignment');
    } finally {
      setSaving(false);
    }
  };

  const receiveConsignment = async (consignmentId: string) => {
    setActionInProgress({ consignmentId, action: 'receive' });
    try {
      await axiosClient.patch(`/procurement/consignments/${consignmentId}`, { status: 'RECEIVED' });
      setError('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to receive consignment');
    } finally {
      setActionInProgress(null);
    }
  };

  const deleteConsignment = (consignmentId: string) => {
    setDeleteConfirmation({ consignmentId });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    setIsDeleting(true);
    try {
      await axiosClient.delete(`/procurement/consignments/${deleteConfirmation.consignmentId}`);
      setDeleteConfirmation(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete consignment');
      setDeleteConfirmation(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = consignments.filter(
    (c) =>
      c.consignmentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.warehouse.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Consignments</h2>
          <p className="text-[#737373] text-xs">Warehouse stocking through grouped shipments with bin-level distribution tracking.</p>
        </div>
        <button onClick={openAdd} className="btn-3d px-4 h-9">
          <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
            <Plus className="w-3.5 h-3.5" /> New Consignment
          </span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>
      )}

      {/* 2. Consignments List */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-lg" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3 w-36" />
                      <Skeleton className="h-2 w-52" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-16 rounded" />
                    <Skeleton className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-[#E9E9E9] rounded-xl">
            <EmptyState title="No consignments found." hint="Create your first consignment shipment." />
          </div>
        ) : (
          filtered.map((csn) => {
            const isOpen = !!expanded[csn.id];
            const undistributedItems = csn.items.filter((item) => item.quantity > item.distributedQty);
            return (
              <div key={csn.id} className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleExpanded(csn.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/60 text-left"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-[#00B4D8]/10 flex items-center justify-center shrink-0">
                      <Truck className="w-4 h-4 text-[#00B4D8]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-[#171717]">{csn.consignmentNumber}</p>
                      <p className="text-[10px] text-slate-400">
                        {csn.supplier.name} → {csn.warehouse.name} · {csn.items.length} items · Scheduled {csn.expectedDelivery ? new Date(csn.expectedDelivery).toLocaleDateString() : 'not set'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${consignmentStatusBadge[csn.status]}`}>
                      {csn.status}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConsignment(csn.id);
                      }}
                      className="text-slate-300 hover:text-rose-600 transition-colors p-1.5"
                      title="Delete consignment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 px-4 py-4 space-y-4">
                    {/* Items Summary */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Items in Consignment</div>
                      <div className="space-y-2">
                        {csn.items.map((item) => (
                          <div key={item.id} className="rounded-lg border border-slate-100 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1">
                                <p className="text-[11px] font-bold text-slate-700">{item.material.name}</p>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  Total: <b>{item.quantity}</b> {item.unitOfMeasure} • Distributed: <b>{item.distributedQty}</b>
                                </p>
                              </div>
                              {item.quantity > item.distributedQty && (
                                <div className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                  {Number(item.quantity - item.distributedQty).toFixed(2)} pending
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                      {csn.status === 'IN_TRANSIT' && (
                        <button
                          onClick={() => receiveConsignment(csn.id)}
                          disabled={actionInProgress?.consignmentId === csn.id}
                          className="btn-3d px-3 h-7"
                        >
                          <span className="flex items-center gap-1 text-white text-[10px] font-semibold">
                            <CheckCircle2 className="w-3 h-3" /> {actionInProgress?.consignmentId === csn.id ? 'Receiving…' : 'Mark Received'}
                          </span>
                        </button>
                      )}
                      {csn.status === 'RECEIVED' && undistributedItems.length > 0 && (
                        <button
                          onClick={() => openDistributionModal(csn)}
                          className="btn-3d px-3 h-7"
                        >
                          <span className="flex items-center gap-1 text-white text-[10px] font-semibold">
                            <Boxes className="w-3 h-3" /> Distribute to Bins
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 3. Create Consignment Modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <form onSubmit={submit} className="bg-white rounded-xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#00B4D8]" />
                <h3 className="text-sm font-bold text-[#171717]">New Consignment</h3>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {/* Consignment Details */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Supplier *</label>
                  <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#00B4D8]">
                    <option value="">Select supplier…</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Warehouse *</label>
                  <select value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#00B4D8]">
                    <option value="">Select warehouse…</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">PO Numbers (CSV)</label>
                <input value={form.poNumbers} onChange={(e) => setForm({ ...form, poNumbers: e.target.value })} placeholder="e.g. PO-001, PO-002" className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#00B4D8]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ship Date</label>
                  <input type="datetime-local" value={form.shipDate} onChange={(e) => setForm({ ...form, shipDate: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#00B4D8]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Expected Delivery</label>
                  <input type="datetime-local" value={form.expectedDelivery} onChange={(e) => setForm({ ...form, expectedDelivery: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#00B4D8]" />
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Materials *</label>
                <span className="text-[9px] text-slate-400">{items.filter((i) => i.materialId && i.quantity).length} added</span>
              </div>

              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 bg-slate-50/40 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500">Item {i + 1}</span>
                      <button type="button" onClick={() => removeItemRow(i)} className="text-slate-300 hover:text-rose-500 p-0.5">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Material *</label>
                      <select value={item.materialId} onChange={(e) => updateItem(i, 'materialId', e.target.value)} className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#00B4D8]">
                        <option value="">Select material…</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Quantity *</label>
                      <input value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} type="number" step="0.0001" placeholder="e.g. 100" className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#00B4D8]" />
                    </div>
                  </div>
                ))}
              </div>

              <button type="button" onClick={addItemRow} className="w-full h-10 rounded-lg border-2 border-dashed border-slate-200 hover:border-[#00B4D8]/50 hover:bg-blue-50/30 text-xs font-bold text-slate-400 hover:text-[#00B4D8] transition-colors flex items-center justify-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add Material
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowModal(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
              <button type="submit" disabled={saving} className="btn-3d px-4 h-9">
                <span className="text-white text-xs font-semibold">{saving ? 'Creating…' : 'Create Consignment'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 4. Distribution Modal */}
      {showDistributionModal && selectedConsignmentForDistribution && (
        <Modal onClose={() => setShowDistributionModal(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-[#00B4D8]" />
                <h3 className="text-sm font-bold text-[#171717]">Distribute to Bins</h3>
              </div>
              <button type="button" onClick={() => setShowDistributionModal(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3">
              {selectedConsignmentForDistribution.items
                .filter((item) => item.quantity > item.distributedQty)
                .map((item, idx) => (
                  <div key={item.id} className="rounded-lg border border-slate-100 p-3 space-y-2">
                    <p className="text-[11px] font-bold text-slate-700">{item.material.name}</p>
                    <p className="text-[10px] text-slate-400">
                      Remaining: <b>{Number(item.quantity - item.distributedQty).toFixed(2)}</b> {item.unitOfMeasure}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Bin *</label>
                        <select
                          value={distributions[idx]?.binId || ''}
                          onChange={(e) => setDistributions((prev) => [...prev.slice(0, idx), { ...prev[idx], binId: e.target.value }, ...prev.slice(idx + 1)])}
                          className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#00B4D8]"
                        >
                          <option value="">Select bin…</option>
                          {warehouseBins
                            .filter((b) => b.warehouseId === selectedConsignmentForDistribution.warehouseId || !b.warehouseId)
                            .map((b) => (
                              <option key={b.id} value={b.id}>{b.binCode}</option>
                            ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Qty *</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={distributions[idx]?.quantity || ''}
                          onChange={(e) => setDistributions((prev) => [...prev.slice(0, idx), { ...prev[idx], quantity: e.target.value }, ...prev.slice(idx + 1)])}
                          placeholder={Number(item.quantity - item.distributedQty).toFixed(2)}
                          className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#00B4D8]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowDistributionModal(null)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
              <button type="button" onClick={submitDistribution} disabled={saving} className="btn-3d px-4 h-9">
                <span className="text-white text-xs font-semibold">{saving ? 'Distributing…' : 'Distribute'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Confirmation Modal */}
      {createConfirmation && (
        <ConfirmationModal
          type="create"
          title="Create Consignment"
          description="Create a new consignment shipment with the specified supplier, warehouse, and materials."
          onConfirm={confirmCreate}
          onCancel={() => setCreateConfirmation(false)}
          isLoading={saving}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <ConfirmationModal
          type="delete"
          title="Delete Consignment"
          description="This consignment will be permanently deleted. This action cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirmation(null)}
          isLoading={isDeleting}
        />
      )}
    </div>
  );
}
