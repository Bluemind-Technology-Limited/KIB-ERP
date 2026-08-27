import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Plus, CheckCircle2, ChevronRight, ChevronLeft, Factory, CalendarDays, Recycle, Search, Check, Trash2 } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';

interface BomIngredientOption {
  id: string;
  quantity: number;
  unitOfMeasure: string;
  isPercentage: boolean;
  material: { id: string; name: string; sku: string; unitOfMeasure: string };
}

interface BomVersionOption {
  id: string;
  bomId: string;
  version: number;
  expectedYield: number;
  yieldUnit: string;
  status: string;
  productName: string;
  finishedSku?: { id: string; name: string; sku: string } | null;
  ingredients: BomIngredientOption[];
}

interface Machine { id: string; name: string; code: string }
interface Shift { id: string; name: string; startTime: string; endTime: string }
interface Warehouse { id: string; name: string; code: string }
interface MaterialOption { id: string; name: string; sku: string; unitOfMeasure: string }

interface ProductionOrder {
  id: string;
  orderNumber: string;
  targetQuantity: number;
  actualYield?: number | null;
  errorPercentage?: number | null;
  status: string;
  scheduledStart?: string | null;
  actualEnd?: string | null;
  createdAt: string;
  bomVersion?: {
    bom?: { productName: string };
    finishedSku?: { name: string; sku: string } | null;
  } | null;
  machine?: { name: string; code: string } | null;
  shift?: { name: string } | null;
  createdBy?: { fullName?: string } | null;
  finishedBatch?: { batchNumber: string; status: string } | null;
  mixCode?: string | null;
  mixLogDate?: string | null;
  mixUnits?: number | null;
  ingredientsReleasedAt?: string | null;
  ingredientsReleasedBy?: { fullName?: string } | null;
  yieldLoggedAt?: string | null;
  yieldLoggedBy?: { fullName?: string } | null;
  productionIngredients?: Array<{
    id: string;
    materialId: string;
    projectedQuantity: number;
    releasedQuantity: number;
    returnedQuantity: number;
    batchLotId?: string | null;
    releasedAt?: string | null;
    material: { name: string; sku: string; unitOfMeasure: string };
    batchLot?: { batchNumber: string; expiryDate?: string } | null;
  }>;
}

const statusBadge: Record<string, string> = {
  SCHEDULED: 'bg-slate-100 text-slate-600 border-slate-200',
  RELEASED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  PROCESSING: 'bg-amber-50 text-amber-700 border-amber-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  WASTED: 'bg-rose-50 text-rose-600 border-rose-200',
};

export default function ProductionOrders({ searchQuery = '' }: { searchQuery?: string }) {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [bomOptions, setBomOptions] = useState<BomVersionOption[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [createConfirmation, setCreateConfirmation] = useState(false);
  const [actionConfirmation, setActionConfirmation] = useState<'complete' | 'mix' | 'returns' | null>(null);
  const [bomSearch, setBomSearch] = useState('');
  // waste logging
  const [showWaste, setShowWaste] = useState(false);
  const [wasteForm, setWasteForm] = useState({ materialId: '', warehouseId: '', quantity: '', unitOfMeasure: '', notes: '' });

  // wizard form
  const [form, setForm] = useState({
    bomVersionId: '',
    targetQuantity: '',
    scheduledStart: '',
    machineId: '',
    shiftId: '',
  });
  // start / complete
  const [actingOrder, setActingOrder] = useState<ProductionOrder | null>(null);
  const [action, setAction] = useState<'complete' | 'mix' | 'returns' | null>(null);
  const [actionForm, setActionForm] = useState({ warehouseId: '', batchNumber: '', actualYield: '', finishedGoodsExpiryDate: '' });
  const [mixForm, setMixForm] = useState({ mixUnits: '' });
  const [returnsForm, setReturnsForm] = useState<Array<{ id: string; name: string; releasedQuantity: number; returnedQuantity: number; unit: string }>>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [orderRes, bomRes, machineRes, shiftRes, whRes, matRes] = await Promise.all([
        axiosClient.get<{ productionOrders: ProductionOrder[] }>('/production/production-orders'),
        axiosClient.get<{ boms: any[] }>('/production/boms'),
        axiosClient.get<{ machines: Machine[] }>('/production/machines'),
        axiosClient.get<{ shifts: Shift[] }>('/production/shifts'),
        axiosClient.get<{ warehouses: Warehouse[] }>('/master-data/warehouses'),
        axiosClient.get<{ materials: MaterialOption[] }>('/master-data/materials'),
      ]);
      setOrders(orderRes.data.productionOrders);
      setBomOptions(
        bomRes.data.boms.flatMap((bom) =>
          (bom.versions ?? [])
            .filter((v: any) => v.status === 'APPROVED' || v.status === 'ACTIVE')
            .map((v: any) => ({
              id: v.id,
              bomId: bom.id,
              version: v.version,
              expectedYield: Number(v.expectedYield),
              yieldUnit: v.yieldUnit,
              status: v.status,
              productName: bom.productName,
              finishedSku: v.finishedSku ?? null,
              ingredients: (v.ingredients ?? []).map((ing: any) => ({
                id: ing.id,
                quantity: Number(ing.quantity),
                unitOfMeasure: ing.unitOfMeasure,
                isPercentage: ing.isPercentage,
                material: { id: ing.material.id, name: ing.material.name, sku: ing.material.sku, unitOfMeasure: ing.material.unitOfMeasure },
              })),
            }))
        )
      );
      setMachines(machineRes.data.machines);
      setShifts(shiftRes.data.shifts);
      setWarehouses(whRes.data.warehouses);
      setMaterials(matRes.data.materials);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load production orders. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectedBom = useMemo(() => bomOptions.find((b) => b.id === form.bomVersionId) ?? null, [form.bomVersionId, bomOptions]);

  const filteredBomOptions = useMemo(() => {
    const q = bomSearch.trim().toLowerCase();
    if (!q) return bomOptions;
    return bomOptions.filter(
      (b) =>
        b.productName.toLowerCase().includes(q) ||
        (b.finishedSku?.name ?? '').toLowerCase().includes(q) ||
        (b.finishedSku?.sku ?? '').toLowerCase().includes(q)
    );
  }, [bomSearch, bomOptions]);

  // Scaled ingredient requirement preview for the chosen target quantity.
  const estimatedIngredients = useMemo(() => {
    if (!selectedBom || !form.targetQuantity) return [];
    const scale = selectedBom.expectedYield > 0 ? Number(form.targetQuantity) / selectedBom.expectedYield : 0;
    return selectedBom.ingredients.map((ing) => {
      const amount = ing.isPercentage ? (Number(form.targetQuantity) * ing.quantity) / 100 : ing.quantity * scale;
      return { ...ing, amount };
    });
  }, [selectedBom, form.targetQuantity]);

  const openWizard = () => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setForm({ bomVersionId: '', targetQuantity: '', scheduledStart: local, machineId: '', shiftId: '' });
    setStep(1);
    setBomSearch('');
    setError('');
    setShowWizard(true);
  };

  const openWaste = () => {
    setWasteForm({ materialId: '', warehouseId: '', quantity: '', unitOfMeasure: '', notes: '' });
    setError('');
    setShowWaste(true);
  };

  const submitWaste = async () => {
    if (!wasteForm.materialId || !wasteForm.warehouseId || !wasteForm.quantity || !wasteForm.unitOfMeasure) {
      setError('Material, warehouse, quantity and unit are required');
      return;
    }
    setSaving(true);
    try {
      await axiosClient.post('/production/waste', {
        materialId: wasteForm.materialId,
        warehouseId: wasteForm.warehouseId,
        quantity: Number(wasteForm.quantity),
        unitOfMeasure: wasteForm.unitOfMeasure,
        notes: wasteForm.notes || undefined,
      });
      setShowWaste(false);
      setError('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to log waste');
    } finally {
      setSaving(false);
    }
  };

  const createOrder = async () => {
    if (!form.bomVersionId || !form.targetQuantity) {
      setError('Select a BOM version and enter the target quantity');
      return;
    }
    setCreateConfirmation(true);
  };

  const confirmCreateOrder = async () => {
    setSaving(true);
    try {
      await axiosClient.post('/production/production-orders', {
        bomVersionId: form.bomVersionId,
        targetQuantity: Number(form.targetQuantity),
        scheduledStart: form.scheduledStart || undefined,
        machineId: form.machineId || undefined,
        shiftId: form.shiftId || undefined,
      });
      setShowWizard(false);
      setCreateConfirmation(false);
      setError('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create production order');
      setCreateConfirmation(false);
    } finally {
      setSaving(false);
    }
  };

  const openAction = async (order: ProductionOrder, kind: 'complete' | 'mix' | 'returns') => {
    setActingOrder(order);
    setActionConfirmation(kind);
    setError('');
    
    if (kind === 'returns') {
      setActionForm({ warehouseId: '', batchNumber: '', actualYield: '', finishedGoodsExpiryDate: '' });
      const returnsList = (order.productionIngredients ?? []).map(ing => ({
        id: ing.id,
        name: ing.material.name,
        releasedQuantity: ing.releasedQuantity,
        returnedQuantity: 0,
        unit: ing.material.unitOfMeasure
      }));
      setReturnsForm(returnsList);
    } else if (kind === 'mix') {
      setMixForm({ mixUnits: '' });
    } else if (kind === 'complete') {
      setActionForm({ warehouseId: '', batchNumber: '', actualYield: String(order.targetQuantity), finishedGoodsExpiryDate: '' });
    }
  };

  const confirmAction = () => {
    if (!actionConfirmation) return;
    setAction(actionConfirmation);
    setActionConfirmation(null);
  };

  const submitAction = async () => {
    if (!actingOrder) return;
    setSaving(true);
    try {
      if (action === 'mix') {
        if (!mixForm.mixUnits || Number(mixForm.mixUnits) <= 0) {
          setError('Enter a valid mix units quantity');
          setSaving(false);
          return;
        }
        await axiosClient.post(`/production/production-orders/${actingOrder.id}/mix`, {
          mixUnits: Number(mixForm.mixUnits),
        });
      } else if (action === 'returns') {
        if (!actionForm.warehouseId) {
          setError('Select the warehouse to return raw materials to');
          setSaving(false);
          return;
        }
        await axiosClient.post(`/production/production-orders/${actingOrder.id}/returns`, {
          warehouseId: actionForm.warehouseId,
          returns: returnsForm.map(r => ({
            id: r.id,
            returnedQuantity: Number(r.returnedQuantity)
          }))
        });
      } else if (action === 'complete') {
        if (!actionForm.warehouseId || !actionForm.batchNumber || !actionForm.actualYield || !actionForm.finishedGoodsExpiryDate) {
          setError('Batch number, receiving warehouse, actual yield, and expiry date are required');
          setSaving(false);
          return;
        }
        await axiosClient.post(`/production/production-orders/${actingOrder.id}/complete`, {
          batchNumber: actionForm.batchNumber,
          warehouseId: actionForm.warehouseId,
          actualYield: Number(actionForm.actualYield),
          finishedGoodsExpiryDate: actionForm.finishedGoodsExpiryDate,
        });
      }
      setActingOrder(null);
      setAction(null);
      setError('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  const filtered = orders.filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.bomVersion?.finishedSku?.name ?? o.bomVersion?.bom?.productName ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const deleteProductionOrder = async (id: string) => {
    setDeleteConfirmation(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    setIsDeleting(true);
    try {
      await axiosClient.delete(`/production/production-orders/${deleteConfirmation}`);
      setDeleteConfirmation(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete production order');
      setDeleteConfirmation(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Production Orders</h2>
          <p className="text-[#737373] text-xs">Plan batches from approved BOMs, schedule on machines/shifts, then execute.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openWaste} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50">
            <span className="flex items-center gap-1.5">
              <Recycle className="w-3.5 h-3.5" /> Log Waste
            </span>
          </button>
          <button onClick={openWizard} className="btn-3d px-4 h-9">
            <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
              <Plus className="w-3.5 h-3.5" /> Plan Production
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>
      )}

      {/* 2. Orders Table */}
      <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
        {loading ? (
          <TableSkeleton cols={8} rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No production orders yet." hint="Plan your first batch." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-semibold">Order</th>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Qty</th>
                  <th className="px-4 py-3 font-semibold">Machine / Shift</th>
                  <th className="px-4 py-3 font-semibold">Scheduled</th>
                  <th className="px-4 py-3 font-semibold">Batch</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-[#EA4335]/10 flex items-center justify-center shrink-0">
                          <ClipboardList className="w-3.5 h-3.5 text-[#EA4335]" />
                        </div>
                        <div>
                          <p className="text-[11px] font-mono font-bold text-[#171717]">{o.orderNumber}</p>
                          <p className="text-[9px] text-slate-400">by {o.createdBy?.fullName ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-slate-700">{o.bomVersion?.finishedSku?.name ?? o.bomVersion?.bom?.productName ?? '—'}</p>
                      <p className="text-[9px] text-slate-400">{o.bomVersion?.finishedSku?.sku ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-600">{Number(o.targetQuantity)}</td>
                    <td className="px-4 py-3">
                      <p className="text-[11px] text-slate-600 flex items-center gap-1">
                        <Factory className="w-3 h-3 text-slate-400" /> {o.machine?.name ?? '—'}
                      </p>
                      <p className="text-[9px] text-slate-400">{o.shift?.name ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-500">
                      {o.scheduledStart ? new Date(o.scheduledStart).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {o.finishedBatch ? (
                        <span className="text-[10px] font-mono text-slate-500">
                          {o.finishedBatch.batchNumber}
                          <span className={`ml-1.5 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${statusBadge[o.finishedBatch.status === 'ACTIVE' ? 'COMPLETED' : 'SCHEDULED']}`}>
                            {o.finishedBatch.status}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusBadge[o.status] || statusBadge.SCHEDULED}`}>{o.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right flex items-center justify-end gap-1.5">
                      {o.status === 'SCHEDULED' && (
                        <button onClick={() => deleteProductionOrder(o.id)} className="h-7 px-2.5 rounded-lg border border-rose-200 text-rose-600 text-[10px] font-semibold flex items-center gap-1 bg-white hover:bg-rose-50 transition-colors">
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      )}
                      {o.status === 'RELEASED' && (
                        <>
                          <button onClick={() => openAction(o, 'mix')} className="btn-3d px-3 h-7 bg-amber-600 border-amber-700 hover:bg-amber-500">
                            <span className="flex items-center gap-1 text-white text-[10px] font-semibold">
                              <Factory className="w-3.5 h-3.5" /> Mix
                            </span>
                          </button>
                          <button onClick={() => openAction(o, 'returns')} className="h-7 px-2.5 rounded-lg border border-slate-200 text-[10px] font-semibold text-slate-600 bg-white hover:bg-slate-50 transition-colors">
                            Returns
                          </button>
                        </>
                      )}
                      {o.status === 'PROCESSING' && (
                        <>
                          <button onClick={() => openAction(o, 'complete')} className="btn-3d px-3 h-7">
                            <span className="flex items-center gap-1 text-white text-[10px] font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                            </span>
                          </button>
                          <button onClick={() => openAction(o, 'returns')} className="h-7 px-2.5 rounded-lg border border-slate-200 text-[10px] font-semibold text-slate-600 bg-white hover:bg-slate-50 transition-colors">
                            Returns
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Plan Production Wizard */}
      {showWizard && (
        <Modal onClose={() => setShowWizard(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Factory className="w-4 h-4 text-[#EA4335]" />
                <h3 className="text-sm font-bold text-[#171717]">Plan Production</h3>
              </div>
              <button type="button" onClick={() => setShowWizard(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2">
              {['Select BOM', 'Schedule & Create'].map((label, i) => {
                const n = i + 1;
                const active = step === n;
                const done = step > n;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <div className={`flex items-center gap-1.5 ${active ? 'text-[#EA4335]' : done ? 'text-emerald-500' : 'text-slate-300'}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border ${active ? 'border-[#EA4335] bg-[#EA4335] text-white' : done ? 'border-emerald-400 bg-emerald-50 text-emerald-500' : 'border-slate-200 bg-slate-50'}`}>
                        {done ? '✓' : n}
                      </div>
                      <span className="text-[10px] font-bold">{label}</span>
                    </div>
                    {n === 1 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
                  </div>
                );
              })}
            </div>

            {step === 1 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Approved BOM Version *</label>
                  {filteredBomOptions.length > 0 && (
                    <span className="text-[9px] font-semibold text-slate-400">{filteredBomOptions.length} available</span>
                  )}
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    value={bomSearch}
                    onChange={(e) => setBomSearch(e.target.value)}
                    placeholder="Search BOMs by product or SKU…"
                    className="pl-9 pr-3 h-9 w-full rounded-lg border border-[#E9E9E9] bg-white text-xs focus:outline-none focus:border-[#EA4335]"
                  />
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {bomOptions.length === 0 && (
                    <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      No approved BOMs yet — approve a BOM version in the Bill of Materials screen first.
                    </p>
                  )}
                  {bomOptions.length > 0 && filteredBomOptions.length === 0 && (
                    <p className="text-[11px] text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">No BOMs match "{bomSearch}".</p>
                  )}
                  {filteredBomOptions.map((b) => {
                    const selected = form.bomVersionId === b.id;
                    const ingCount = b.ingredients.length;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setForm({ ...form, bomVersionId: b.id })}
                        className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${selected ? 'border-[#EA4335] bg-rose-50/40' : 'border-[#E9E9E9] hover:border-slate-300'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-slate-700">{b.productName}</p>
                            <p className="text-[10px] text-slate-400">
                              v{b.version} · {b.finishedSku?.name ?? ''} · Yield {b.expectedYield} {b.yieldUnit}
                            </p>
                          </div>
                          {selected ? (
                            <span className="shrink-0 w-5 h-5 rounded-full bg-[#EA4335] text-white flex items-center justify-center">
                              <Check className="w-3 h-3" />
                            </span>
                          ) : (
                            <span className="shrink-0 text-[9px] font-semibold text-slate-300 mt-0.5">{ingCount} ingredients</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                {selectedBom && (
                  <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-slate-700">{selectedBom.productName}</p>
                      <button type="button" onClick={() => { setStep(1); }} className="text-[9px] font-bold uppercase tracking-wider text-[#EA4335] hover:underline">Change</button>
                    </div>
                    <p className="text-[10px] text-slate-400">v{selectedBom.version} · Yield {selectedBom.expectedYield} {selectedBom.yieldUnit}</p>
                  </div>
                )}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Quantity *</label>
                    <input value={form.targetQuantity} onChange={(e) => setForm({ ...form, targetQuantity: e.target.value })} type="number" step="0.0001" min={0} placeholder={`e.g. ${selectedBom?.expectedYield ?? 100}`} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Scheduled Start</label>
                    <input value={form.scheduledStart} onChange={(e) => setForm({ ...form, scheduledStart: e.target.value })} type="datetime-local" className="h-9 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Machine</label>
                      <select value={form.machineId} onChange={(e) => setForm({ ...form, machineId: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                        <option value="">Any…</option>
                        {machines.map((m) => (
                          <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Shift</label>
                      <select value={form.shiftId} onChange={(e) => setForm({ ...form, shiftId: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                        <option value="">Any…</option>
                        {shifts.map((s) => (
                          <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {estimatedIngredients.length > 0 && (
                    <div className="rounded-lg border border-slate-100 overflow-hidden">
                      <div className="flex items-center justify-between bg-slate-50 border-b border-slate-100 px-3 py-2">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Ingredient requirements</span>
                        <span className="text-[9px] font-semibold text-slate-400">{estimatedIngredients.length} items</span>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {estimatedIngredients.map((ing) => (
                          <div key={ing.id} className="flex items-center justify-between gap-2 px-3 py-2">
                            <span className="text-[11px] font-semibold text-slate-700 truncate">{ing.material.name}</span>
                            <span className="text-[10px] text-slate-500 shrink-0">
                              {ing.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} {ing.unitOfMeasure}
                              {ing.isPercentage && <span className="text-slate-400"> (of batch)</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between gap-2 pt-2 border-t border-slate-100">
              {step === 2 ? (
                <button onClick={() => setStep(1)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <ChevronLeft className="w-3.5 h-3.5" /> Back
                </button>
              ) : <span />}
              {step === 1 ? (
                <button onClick={() => form.bomVersionId ? setStep(2) : setError('Select a BOM version first')} className="btn-3d px-4 h-9">
                  <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </button>
              ) : (
                <button onClick={createOrder} disabled={saving} className="btn-3d px-4 h-9">
                  <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
                    <CalendarDays className="w-3.5 h-3.5" /> {saving ? 'Creating…' : 'Create Order'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* 4. Action Modals (Release / Mix / Returns / Complete) */}
      {actingOrder && action && (
        <Modal onClose={() => { setActingOrder(null); setAction(null); }}>
          <div className="bg-white rounded-xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#171717]">
                {action === 'mix' && 'Record Batch Mix'}
                {action === 'returns' && 'Log Returns/Deficits'}
                {action === 'complete' && 'Complete Production'}
              </h3>
              <button onClick={() => { setActingOrder(null); setAction(null); }} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <p className="text-[11px] text-slate-500">
              <span className="font-mono font-bold text-slate-700">{actingOrder.orderNumber}</span> —{' '}
              {actingOrder.bomVersion?.finishedSku?.name ?? actingOrder.bomVersion?.bom?.productName ?? ''}
            </p>

            {action === 'mix' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Number of Unit Mix Generated *</label>
                  <input
                    type="number"
                    step="1"
                    placeholder="e.g. 5"
                    value={mixForm.mixUnits}
                    onChange={(e) => setMixForm({ mixUnits: e.target.value })}
                    className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]"
                  />
                  <p className="text-[9px] text-slate-400">
                    This represents the ground mixture batch of ingredients. A mix code will be auto-generated.
                  </p>
                </div>
              </div>
            )}

            {action === 'returns' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Return raw materials to warehouse *</label>
                  <select value={actionForm.warehouseId} onChange={(e) => setActionForm({ ...actionForm, warehouseId: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                    <option value="">Select warehouse…</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 border border-slate-100 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-100 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                    Log Returns / Deficits
                  </div>
                  <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto p-2 space-y-2">
                    {returnsForm.map((item, idx) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 text-xs p-1.5">
                        <span className="font-semibold text-slate-700 truncate">{item.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-slate-400">Released: {item.releasedQuantity.toFixed(2)}</span>
                          <input
                            type="number"
                            step="0.0001"
                            placeholder="Qty returned"
                            value={item.returnedQuantity || ''}
                            onChange={(e) => {
                              const updated = [...returnsForm];
                              updated[idx].returnedQuantity = Number(e.target.value);
                              setReturnsForm(updated);
                            }}
                            className="h-8 w-24 rounded border border-[#E9E9E9] px-2 text-right focus:outline-none focus:border-[#EA4335]"
                          />
                          <span className="text-slate-400 text-[10px] w-6">{item.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {action === 'complete' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Batch Number *</label>
                  <input value={actionForm.batchNumber} onChange={(e) => setActionForm({ ...actionForm, batchNumber: e.target.value })} placeholder="e.g. BATCH-001" className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Receive into warehouse *</label>
                  <select value={actionForm.warehouseId} onChange={(e) => setActionForm({ ...actionForm, warehouseId: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                    <option value="">Select warehouse…</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Actual Realized Yield *</label>
                  <input value={actionForm.actualYield} onChange={(e) => setActionForm({ ...actionForm, actualYield: e.target.value })} type="number" step="0.0001" placeholder={`Expected: ${actingOrder.targetQuantity}`} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Finished Goods Expiry Date *</label>
                  <input 
                    type="date" 
                    value={actionForm.finishedGoodsExpiryDate} 
                    onChange={(e) => setActionForm({ ...actionForm, finishedGoodsExpiryDate: e.target.value })} 
                    min={new Date().toISOString().split('T')[0]}
                    className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]"
                    required
                  />
                  <p className="text-[9px] text-slate-400 mt-1">
                    Auto-expiry: 2 years from today if not set manually
                  </p>
                </div>
                
                {actionForm.actualYield && actingOrder.targetQuantity > 0 && (
                  <div className="rounded-lg p-2.5 bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Yield Deviation Error:</span>
                    <span className={`font-mono font-bold ${Math.abs(Number(actionForm.actualYield) - actingOrder.targetQuantity) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {(Math.abs(Number(actionForm.actualYield) - actingOrder.targetQuantity) / actingOrder.targetQuantity * 100).toFixed(2)}%
                    </span>
                  </div>
                )}
                
                <p className="text-[9px] text-slate-400">
                  Completing the order will auto-set the expiry date to exactly 2 years from today.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => { setActingOrder(null); setAction(null); }} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
              <button onClick={submitAction} disabled={saving} className="btn-3d px-4 h-9">
                <span className="text-white text-xs font-semibold">
                  {saving ? 'Saving…' : (
                    <>
                      {action === 'mix' && 'Confirm Batch Mix'}
                      {action === 'returns' && 'Submit Returns'}
                      {action === 'complete' && 'Complete Batch'}
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>
        </Modal>
      )}
      {/* 5. Waste Logging Modal */}
      {showWaste && (
        <Modal onClose={() => setShowWaste(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#171717]">Log Production Waste</h3>
              <button onClick={() => setShowWaste(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Material *</label>
                <select value={wasteForm.materialId} onChange={(e) => {
                  const m = materials.find((x) => x.id === e.target.value);
                  setWasteForm({ ...wasteForm, materialId: e.target.value, unitOfMeasure: m?.unitOfMeasure ?? wasteForm.unitOfMeasure });
                }} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                  <option value="">Select material…</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Warehouse *</label>
                <select value={wasteForm.warehouseId} onChange={(e) => setWasteForm({ ...wasteForm, warehouseId: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                  <option value="">Select warehouse…</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quantity *</label>
                <input value={wasteForm.quantity} onChange={(e) => setWasteForm({ ...wasteForm, quantity: e.target.value })} type="number" step="0.0001" placeholder="e.g. 2.5" className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Unit *</label>
                <input value={wasteForm.unitOfMeasure} onChange={(e) => setWasteForm({ ...wasteForm, unitOfMeasure: e.target.value })} placeholder="kg / units" className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Notes</label>
                <textarea value={wasteForm.notes} onChange={(e) => setWasteForm({ ...wasteForm, notes: e.target.value })} rows={3} className="w-full rounded-lg border border-[#E9E9E9] px-3 py-2 text-xs focus:outline-none focus:border-[#EA4335] resize-none" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowWaste(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
              <button onClick={submitWaste} disabled={saving} className="btn-3d px-4 h-9">
                <span className="text-white text-xs font-semibold">{saving ? 'Saving…' : 'Record Waste'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <ConfirmationModal
          type="delete"
          title="Delete Production Order"
          description="This production order will be permanently deleted. This action cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirmation(null)}
          isLoading={isDeleting}
        />
      )}

      {/* Create Production Order Confirmation Modal */}
      {createConfirmation && (
        <ConfirmationModal
          type="create"
          title="Create Production Order"
          description="Create a new production order with the specified BOM version and target quantity."
          onConfirm={confirmCreateOrder}
          onCancel={() => setCreateConfirmation(false)}
          isLoading={saving}
        />
      )}

      {/* Action Confirmation Modal */}
      {actionConfirmation && (
        <ConfirmationModal
          type="action"
          title={actionConfirmation === 'mix' ? 'Record Batch Mix' : actionConfirmation === 'returns' ? 'Log Returns/Deficits' : 'Complete Production'}
          description={actionConfirmation === 'mix' ? 'Record the unit mix generated for this batch.' : actionConfirmation === 'returns' ? 'Log any returned or deficit ingredients.' : 'Complete this production order and generate finished batch lot.'}
          onConfirm={confirmAction}
          onCancel={() => setActionConfirmation(null)}
          isLoading={false}
          confirmText={actionConfirmation === 'mix' ? 'Record Mix' : actionConfirmation === 'returns' ? 'Log Returns' : 'Complete'}
        />
      )}
    </div>
  );
}
