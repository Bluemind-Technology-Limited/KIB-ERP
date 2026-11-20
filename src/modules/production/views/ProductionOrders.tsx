import { Fragment, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Plus, CheckCircle2, ChevronRight, ChevronLeft, ChevronDown, Factory, CalendarDays, Recycle, Search, Check, X } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { DetailsModal, ViewButton, detailDate, detailValue } from '../../../components/ui/DetailsModal';
import { PageDescription } from '../../../components/ui/PageDescription';
import { PackQuantityPreview } from '../../../components/ui/PackQuantityPreview';
import { formatNumber, formatPercent, formatQty, parseUom, packWeightKg } from '../../../lib/format';
import { Pagination } from '../../../components/ui/Pagination';
import { usePagination } from '../../../hooks/usePagination';

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
  version?: number;
  expectedYield: number;
  yieldUnit: string;
  status: string;
  productName: string;
  finishedSku?: { id: string; name: string; sku: string } | null;
  ingredients: BomIngredientOption[];
}

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
  bom?: {
    productName: string;
    yieldUnit?: string | null;
    finishedSku?: { name: string; sku: string } | null;
  } | null;
  createdBy?: { fullName?: string } | null;
  finishedBatch?: { batchNumber: string; status: string } | null;
  mixCode?: string | null;
  mixLogDate?: string | null;
  mixUnits?: number | null;
  ingredientsReleasedAt?: string | null;
  ingredientsReleasedBy?: { fullName?: string } | null;
  yieldLoggedAt?: string | null;
  yieldLoggedBy?: { fullName?: string } | null;
  planLinked?: boolean;
  planNumber?: string | null;
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
  SCHEDULED: 'bg-slate-600 text-white',
  RELEASED: 'bg-indigo-600 text-white',
  PROCESSING: 'bg-amber-600 text-white',
  COMPLETED: 'bg-emerald-600 text-white',
  WASTED: 'bg-rose-600 text-white',
};

export default function ProductionOrders({ searchQuery = '' }: { searchQuery?: string }) {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [bomOptions, setBomOptions] = useState<BomVersionOption[]>([]);
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

  const [bomSearch, setBomSearch] = useState('');
  const [viewing, setViewing] = useState<ProductionOrder | null>(null);
  /** Production dates expanded in the line table. */
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  // waste logging
  const [showWaste, setShowWaste] = useState(false);
  const [wasteForm, setWasteForm] = useState({ materialId: '', warehouseId: '', quantity: '', unitOfMeasure: '', notes: '' });

  // wizard form
  const [form, setForm] = useState({
    scheduledStart: '',
  });
  /** Selected batch formulations and their target quantities, keyed by BOM id. */
  const [wizardBoms, setWizardBoms] = useState<Record<string, string>>({});
  // One button releases every planned order for a day.
  const [releasingDay, setReleasingDay] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [orderRes, bomRes, whRes, matRes] = await Promise.all([
        axiosClient.get<{ productionOrders: ProductionOrder[] }>('/production/production-orders'),
        axiosClient.get<{ batchFormulations: any[] }>('/production/batch-formulations'),
        axiosClient.get<{ warehouses: Warehouse[] }>('/master-data/warehouses'),
        axiosClient.get<{ materials: MaterialOption[] }>('/master-data/materials'),
      ]);
      setOrders(orderRes.data.productionOrders);
      // Batch formulations are flat (no versions). Only ACTIVE ones are usable:
      // the backend rejects anything else when creating an order.
      setBomOptions(
        (bomRes.data.batchFormulations ?? [])
          .filter((bom: any) => bom.status === 'ACTIVE')
          .map((bom: any) => ({
            id: bom.id,
            bomId: bom.id,
            expectedYield: Number(bom.expectedYield),
            yieldUnit: bom.yieldUnit,
            status: bom.status,
            productName: bom.productName,
            finishedSku: bom.finishedSku ?? null,
            ingredients: (bom.ingredients ?? []).map((ing: any) => ({
              id: ing.id,
              quantity: Number(ing.quantity),
              unitOfMeasure: ing.unitOfMeasure,
              isPercentage: ing.isPercentage,
              material: {
                id: ing.material.id,
                name: ing.material.name,
                sku: ing.material.sku,
                unitOfMeasure: ing.material.unitOfMeasure,
              },
            })),
          }))
      );
      setWarehouses(whRes.data.warehouses);
      setMaterials(matRes.data.materials);
      setError('');
    } catch (err: any) {
      const apiMessage = err?.response?.data?.error;
      if (apiMessage) {
        setError(apiMessage);
      } else if (err?.response) {
        setError(`Failed to load production orders (HTTP ${err.response.status}).`);
      } else if (err instanceof TypeError) {
        setError(`Failed to load production orders: unexpected data from the server ( ${err.message}).`);
      } else {
        setError('Failed to load production orders. Check that the backend is running and reachable.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectedBoms = useMemo(
    () => bomOptions.filter((b) => b.id in wizardBoms),
    [bomOptions, wizardBoms]
  );

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

  // Combined, scaled ingredient requirement for every selected product.
  const estimatedIngredients = useMemo(() => {
    const totals = new Map<string, { id: string; name: string; unitOfMeasure: string; amount: number; isPercentage: boolean }>();

    /** Percentage ingredients are a share of the batch weight, not of pack count. */
    const percentagePacks = (pct: number, targetPacks: number, finishedUnit: string, ingredientUnit: string) => {
      const finished = parseUom(finishedUnit);
      const ingredient = parseUom(ingredientUnit);
      if (!finished || !ingredient) return null;
      const finishedKg = packWeightKg(finished.packSize, finished.packUnit);
      const ingredientKg = packWeightKg(ingredient.packSize, ingredient.packUnit);
      if (finishedKg === null || ingredientKg === null || ingredientKg <= 0) return null;
      return ((pct / 100) * targetPacks * finishedKg) / ingredientKg;
    };

    for (const bom of selectedBoms) {
      const qty = Number(wizardBoms[bom.id]);
      if (!qty || qty <= 0) continue;
      const scale = bom.expectedYield > 0 ? qty / bom.expectedYield : 0;

      for (const ing of bom.ingredients) {
        const amount = ing.isPercentage
          ? percentagePacks(ing.quantity, qty, bom.yieldUnit, ing.unitOfMeasure)
          : ing.quantity * scale;
        if (amount === null) continue;
        const existing = totals.get(ing.material.id);
        if (existing) existing.amount += amount;
        else
          totals.set(ing.material.id, {
            id: ing.material.id,
            name: ing.material.name,
            unitOfMeasure: ing.unitOfMeasure,
            amount,
            isPercentage: ing.isPercentage,
          });
      }
    }

    return [...totals.values()];
  }, [selectedBoms, wizardBoms]);

  const toggleWizardBom = (bomId: string) => {
    setWizardBoms((prev) => {
      const next = { ...prev };
      if (bomId in next) delete next[bomId];
      else next[bomId] = '';
      return next;
    });
  };

  const openWizard = () => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setForm({ scheduledStart: local });
    setWizardBoms({});
    setStep(1);
    setBomSearch('');
    setError('');
    setShowWizard(true);
  };

  /** Add more products to a day that already has production on it. */
  const planForDate = (dateKey: string) => {
    setForm({ scheduledStart: `${dateKey}T08:00` });
    setWizardBoms({});
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
    if (!wasteForm.materialId || !wasteForm.warehouseId || !wasteForm.quantity) {
      setError('Material, warehouse and quantity are required');
      return;
    }
    setSaving(true);
    try {
      await axiosClient.post('/production/waste', {
        materialId: wasteForm.materialId,
        warehouseId: wasteForm.warehouseId,
        quantity: Number(wasteForm.quantity),
        notes: wasteForm.notes || undefined,
      }, { toast: { success: 'Waste logged successfully' } });
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
    if (selectedBoms.length === 0) {
      setError('Select at least one batch formulation');
      return;
    }
    const missingQty = selectedBoms.find((b) => !wizardBoms[b.id] || Number(wizardBoms[b.id]) <= 0);
    if (missingQty) {
      setError(`Enter a target quantity for ${missingQty.productName}`);
      return;
    }
    setCreateConfirmation(true);
  };

  const confirmCreateOrder = async () => {
    setSaving(true);
    try {
      await axiosClient.post('/production/production-orders/batch', {
        orders: selectedBoms.map((b) => ({
          bomId: b.id,
          targetQuantity: Number(wizardBoms[b.id]),
        })),
        scheduledStart: form.scheduledStart || undefined,
      }, {
        toast: {
          success:
            selectedBoms.length === 1
              ? 'Production order created'
              : `${selectedBoms.length} production orders created`,
        },
      });
      setShowWizard(false);
      setCreateConfirmation(false);
      setError('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create production orders');
      setCreateConfirmation(false);
    } finally {
      setSaving(false);
    }
  };

  const filtered = orders.filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.bom?.finishedSku?.name ?? o.bom?.productName ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // The production line is indexed by the day production happens: one row per
  // date, expanding to the orders (products) produced that day.
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, ProductionOrder[]>();

    for (const order of filtered) {
      const raw = order.scheduledStart ?? order.actualEnd ?? order.mixLogDate ?? order.createdAt;
      const date = new Date(raw);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const list = groups.get(key);
      if (list) list.push(order);
      else groups.set(key, [order]);
    }

    return [...groups.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, rows]) => {
        const statusCounts = new Map<string, number>();
        for (const row of rows) statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);

        return {
          key,
          label: new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }),
          rows,
          products: new Set(
            rows.map((r) => r.bom?.finishedSku?.name ?? r.bom?.productName ?? r.orderNumber)
          ).size,
          plannedQty: rows.reduce((sum, r) => sum + Number(r.targetQuantity || 0), 0),
          // Orders still waiting to be handed to the Ingredients Station.
          schedulableIds: rows.filter((r) => r.status === 'SCHEDULED').map((r) => r.id),
          statusSummary: [...statusCounts.entries()]
            .map(([status, count]) => `${count} ${status.toLowerCase()}`)
            .join(' · '),
        };
      });
  }, [filtered]);

  const { page, totalPages, total, pageItems, setPage } = usePagination(groupedByDate);

  const deleteProductionOrder = async (id: string) => {
    setDeleteConfirmation(id);
  };

  /** One release order for the whole production day. */
  const releaseDay = async (group: { key: string; schedulableIds: string[] }) => {
    if (group.schedulableIds.length === 0) return;
    setReleasingDay(group.key);
    setError('');
    try {
      await axiosClient.post(
        '/production/production-orders/release-day',
        { orderIds: group.schedulableIds },
        { toast: { success: 'Release order created for the Ingredients Station' } }
      );
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to release the orders');
    } finally {
      setReleasingDay(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    setIsDeleting(true);
    try {
      await axiosClient.delete(`/production/production-orders/${deleteConfirmation}`, {
        toast: { success: 'Production order deleted' },
      });
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
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-ink">Production Orders</h2>
          <PageDescription>Plan batches from approved BOMs, then execute.</PageDescription>
        </div>
        <div className="flex gap-2">
          <button onClick={openWaste} className="h-9 px-4 rounded-lg border border-line text-xs font-semibold text-ink-muted bg-surface hover:bg-surface-2">
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
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>
      )}

      {/* 2. Production line — one row per production date */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        {loading ? (
          <TableSkeleton cols={6} rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No production orders yet." hint="Plan your first batch." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint">
                  <th className="px-4 py-3 font-semibold">Production Date</th>
                  <th className="px-4 py-3 font-semibold text-center">Orders</th>
                  <th className="px-4 py-3 font-semibold text-center">Products</th>
                  <th className="px-4 py-3 font-semibold text-center">Planned Qty</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((group) => {
                  const open = !!expandedDates[group.key];
                  return (
                    <Fragment key={group.key}>
                      <tr className="border-b border-line hover:bg-surface-2/60">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedDates((prev) => ({ ...prev, [group.key]: !prev[group.key] }))
                            }
                            className="flex items-center gap-2.5 text-left"
                          >
                            {open ? (
                              <ChevronDown className="w-4 h-4 text-ink-faint shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-ink-faint shrink-0" />
                            )}
                            <span className="w-7 h-7 rounded-lg bg-[#EA4335]/10 flex items-center justify-center shrink-0">
                              <CalendarDays className="w-4 h-4 text-[#EA4335]" />
                            </span>
                            <span className="text-xs font-bold text-ink">{group.label}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center text-[11px] font-semibold text-ink-muted">
                          {formatNumber(group.rows.length)}
                        </td>
                        <td className="px-4 py-3 text-center text-[11px] font-semibold text-ink-muted">
                          {formatNumber(group.products)}
                        </td>
                        <td className="px-4 py-3 text-center text-[11px] font-mono text-ink-muted">
                          {formatNumber(group.plannedQty)}
                        </td>
                        <td className="px-4 py-3 text-[10px] text-ink-muted truncate max-w-[200px]" title={group.statusSummary}>
                          {group.statusSummary}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => releaseDay(group)}
                              disabled={group.schedulableIds.length === 0 || releasingDay === group.key}
                              title={
                                group.schedulableIds.length === 0
                                  ? 'No orders waiting to be released for this date'
                                  : 'Create the release order for this day'
                              }
                              className="btn-3d h-7 shrink-0 px-2.5 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <span className="flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold text-white">
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                {releasingDay === group.key ? 'Releasing…' : 'Release Order'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => planForDate(group.key)}
                              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-[#EA4335]/30 text-[#EA4335] text-[10px] font-semibold hover:bg-rose-50 dark:hover:bg-rose-500/10"
                              title="Add more products to this production date"
                            >
                              <Plus className="w-3 h-3" /> Plan more
                            </button>
                          </div>
                        </td>
                      </tr>

                      {open && (
                        <tr className="bg-surface-2/40">
                          <td colSpan={6} className="p-0">
                            <div className="overflow-x-auto border-b border-line">
                              <table className="w-full text-left">
                                <thead>
                                  <tr className="text-[9px] uppercase tracking-wider text-ink-faint bg-surface-2">
                                    <th className="px-4 py-2 font-semibold">Order</th>
                                    <th className="px-4 py-2 font-semibold">Product</th>
                                    <th className="px-4 py-2 font-semibold">Qty</th>
                                    <th className="px-4 py-2 font-semibold">Scheduled</th>
                                    <th className="px-4 py-2 font-semibold">Batch</th>
                                    <th className="px-4 py-2 font-semibold">Yield Error</th>
                                    <th className="px-4 py-2 font-semibold">Status</th>
                                    <th className="px-4 py-2 font-semibold text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.rows.map((o) => (
                  <tr key={o.id} className="border-b border-line hover:bg-surface-2/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-[#EA4335]/10 flex items-center justify-center shrink-0">
                          <ClipboardList className="w-3.5 h-3.5 text-[#EA4335]" />
                        </div>
                        <div>
                          <p className="text-[11px] font-mono font-bold text-ink max-w-[140px] truncate" title={o.orderNumber}>{o.orderNumber}</p>
                          <p className="text-[9px] text-ink-faint">by {o.createdBy?.fullName ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-ink-2 max-w-[180px] truncate" title={o.bom?.finishedSku?.name ?? o.bom?.productName ?? '—'}>{o.bom?.finishedSku?.name ?? o.bom?.productName ?? '—'}</p>
                      <p className="text-[9px] text-ink-faint max-w-[180px] truncate" title={o.bom?.finishedSku?.sku ?? ''}>{o.bom?.finishedSku?.sku ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-ink-muted">{formatNumber(o.targetQuantity)}</td>
                    <td className="px-4 py-3 text-[11px] text-ink-muted">
                      {o.scheduledStart ? new Date(o.scheduledStart).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {o.finishedBatch ? (
                        <span className="text-[10px] font-mono text-ink-muted">
                          <span className="inline-block max-w-[120px] truncate align-middle" title={o.finishedBatch.batchNumber}>{o.finishedBatch.batchNumber}</span>
                          <span className={`rounded-full inline-block text-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ml-1.5  ${statusBadge[o.finishedBatch.status === 'ACTIVE' ? 'COMPLETED' : 'SCHEDULED']}`}>
                            {o.finishedBatch.status}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {o.errorPercentage !== undefined && o.errorPercentage !== null ? (
                        <span className={`text-[11px] font-mono font-bold ${Math.abs(o.errorPercentage) < 5 ? 'text-emerald-600 dark:text-emerald-300' : Math.abs(o.errorPercentage) < 15 ? 'text-amber-600 dark:text-amber-300' : 'text-rose-600 dark:text-rose-300'}`}>
                          {formatPercent(Math.abs(o.errorPercentage), 2)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full inline-block text-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider  ${statusBadge[o.status] || statusBadge.SCHEDULED}`}>{o.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right flex items-center justify-end gap-1.5">
                      <ViewButton onClick={() => setViewing(o)} />
                      {o.status === 'SCHEDULED' && (
                        <button
                          onClick={() => deleteProductionOrder(o.id)}
                          className="rounded-md bg-rose-600 px-2.5 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-rose-700"
                        >
                          Delete
                        </button>
                      )}
                      {(o.status === 'RELEASED' || o.status === 'PROCESSING') && (
                        <span
                          className="rounded-md bg-slate-600 px-2.5 py-1 text-[10px] font-semibold text-white"
                          title="Grinding, production and WIP are tracked at the stations"
                        >
                          In production — track in stations
                        </span>
                      )}
                    </td>
                  </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
          </div>
        )}
      </div>

      {/* 3. Plan Production Wizard */}
      {showWizard && (
        <Modal onClose={() => setShowWizard(false)}>
          <div className="bg-surface rounded-xl w-full max-w-md p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Factory className="w-4 h-4 text-[#EA4335]" />
                <h3 className="text-sm font-bold text-ink">Plan Production</h3>
              </div>
              <button type="button" onClick={() => setShowWizard(false)} className="text-ink-faint hover:text-ink-muted">✕</button>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2">
              {['Select BOM', 'Schedule & Create'].map((label, i) => {
                const n = i + 1;
                const active = step === n;
                const done = step > n;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <div className={`flex items-center gap-1.5 ${active ? 'text-[#EA4335]' : done ? 'text-emerald-500' : 'text-ink-faint'}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border ${active ? 'border-[#EA4335] bg-[#EA4335] text-white' : done ? 'border-emerald-400 bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10' : 'border-line bg-surface-2'}`}>
                        {done ? '✓' : n}
                      </div>
                      <span className="text-[10px] font-bold">{label}</span>
                    </div>
                    {n === 1 && <ChevronRight className="w-3.5 h-3.5 text-ink-faint" />}
                  </div>
                );
              })}
            </div>

            {step === 1 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Products to Produce *</label>
                  {filteredBomOptions.length > 0 && (
                    <span className="text-[9px] font-semibold text-ink-faint">
                      {formatNumber(Object.keys(wizardBoms).length)} selected · {formatNumber(filteredBomOptions.length)} available
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-faint" />
                  <input
                    value={bomSearch}
                    onChange={(e) => setBomSearch(e.target.value)}
                    placeholder="Search BOMs by product or SKU…"
                    className="pl-9 pr-3 h-9 w-full rounded-lg border border-line bg-surface text-xs focus:outline-none focus:border-[#EA4335]"
                  />
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {bomOptions.length === 0 && (
                    <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30">
                      No active batch formulations yet — set a formulation's status to ACTIVE in the Batch Formulation screen first.
                    </p>
                  )}
                  {bomOptions.length > 0 && filteredBomOptions.length === 0 && (
                    <p className="text-[11px] text-ink-faint bg-surface-2 border border-line rounded-lg px-3 py-2">No BOMs match "{bomSearch}".</p>
                  )}
                  {filteredBomOptions.map((b) => {
                    const selected = b.id in wizardBoms;
                    const ingCount = b.ingredients.length;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => toggleWizardBom(b.id)}
                        className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${selected ? 'border-[#EA4335] bg-rose-50/40' : 'border-line hover:border-line-strong'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-ink-2">{b.productName}</p>
                            <p className="text-[10px] text-ink-faint">
                              {b.finishedSku?.name ?? ''} · Yield {formatQty(b.expectedYield, b.yieldUnit)}
                            </p>
                          </div>
                          {selected ? (
                            <span className="shrink-0 w-5 h-5 rounded-full bg-[#EA4335] text-white flex items-center justify-center">
                              <Check className="w-3 h-3" />
                            </span>
                          ) : (
                            <span className="shrink-0 text-[9px] font-semibold text-ink-faint mt-0.5">{formatNumber(ingCount)} ingredients</span>
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
                <div className="rounded-lg bg-surface-2 border border-line px-3 py-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                      {formatNumber(selectedBoms.length)} product(s)
                    </p>
                    <button type="button" onClick={() => setStep(1)} className="text-[9px] font-bold uppercase tracking-wider text-[#EA4335] hover:underline">
                      Change
                    </button>
                  </div>
                  <div className="space-y-2">
                    {selectedBoms.map((b) => (
                      <div key={b.id} className="rounded-lg border border-line bg-surface px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-ink-2 truncate" title={b.productName}>{b.productName}</p>
                            <p className="text-[9px] text-ink-faint">Yield {formatQty(b.expectedYield, b.yieldUnit)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleWizardBom(b.id)}
                            className="text-ink-faint hover:text-rose-500 shrink-0"
                            title="Remove product"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-ink-faint">Target qty</span>
                          <input
                            value={wizardBoms[b.id]}
                            onChange={(e) => setWizardBoms({ ...wizardBoms, [b.id]: e.target.value })}
                            type="number"
                            step="0.0001"
                            min={0.0001}
                            placeholder={`e.g. ${b.expectedYield ?? 100}`}
                            className="h-8 w-28 rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                          />
                          <span className="text-[10px] text-ink-faint">{b.yieldUnit}</span>
                          <PackQuantityPreview quantity={wizardBoms[b.id]} unit={b.yieldUnit} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Scheduled Start</label>
                    <input value={form.scheduledStart} onChange={(e) => setForm({ ...form, scheduledStart: e.target.value })} type="datetime-local" className="h-9 w-full rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#EA4335]" />
                  </div>

                  {estimatedIngredients.length > 0 && (
                    <div className="rounded-lg border border-line overflow-hidden">
                      <div className="flex items-center justify-between bg-surface-2 border-b border-line px-3 py-2">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-ink-muted">Ingredient requirements</span>
                        <span className="text-[9px] font-semibold text-ink-faint">{formatNumber(estimatedIngredients.length)} items</span>
                      </div>
                      <div className="divide-y divide-line">
                        {estimatedIngredients.map((ing) => (
                          <div key={ing.id} className="flex items-center justify-between gap-2 px-3 py-2">
                            <span className="text-[11px] font-semibold text-ink-2 truncate">{ing.name}</span>
                            <span className="text-[10px] text-ink-muted shrink-0">
                              {formatQty(ing.amount, ing.unitOfMeasure)}
                              {ing.isPercentage && <span className="text-ink-faint"> (of batch)</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between gap-2 pt-2 border-t border-line">
              {step === 2 ? (
                <button onClick={() => setStep(1)} className="h-9 px-4 rounded-lg border border-line text-xs font-semibold text-ink-muted flex items-center gap-1">
                  <ChevronLeft className="w-3.5 h-3.5" /> Back
                </button>
              ) : <span />}
              {step === 1 ? (
                <button onClick={() => selectedBoms.length ? setStep(2) : setError('Select at least one batch formulation')} className="btn-3d px-4 h-9">
                  <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </button>
              ) : (
                <button onClick={createOrder} disabled={saving} className="btn-3d px-4 h-9">
                  <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
                    <CalendarDays className="w-3.5 h-3.5" /> {saving ? 'Creating…' : selectedBoms.length > 1 ? `Create ${formatNumber(selectedBoms.length)} Orders` : 'Create Order'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* 5. Waste Logging Modal */}
      {showWaste && (
        <Modal onClose={() => setShowWaste(false)}>
          <div className="bg-surface rounded-xl w-full max-w-md p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">Log Production Waste</h3>
              <button onClick={() => setShowWaste(false)} className="text-ink-faint hover:text-ink-muted">✕</button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Material *</label>
                <select value={wasteForm.materialId} onChange={(e) => {
                  const m = materials.find((x) => x.id === e.target.value);
                  setWasteForm({ ...wasteForm, materialId: e.target.value, unitOfMeasure: m?.unitOfMeasure ?? wasteForm.unitOfMeasure });
                }} className="h-9 w-full rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                  <option value="">Select material…</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Warehouse *</label>
                <select value={wasteForm.warehouseId} onChange={(e) => setWasteForm({ ...wasteForm, warehouseId: e.target.value })} className="h-9 w-full rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                  <option value="">Select warehouse…</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Quantity *</label>
                <input value={wasteForm.quantity} onChange={(e) => setWasteForm({ ...wasteForm, quantity: e.target.value })} type="number" min="0.0001" step="0.0001" placeholder="e.g. 2.5" className="h-9 w-full rounded-lg border border-line px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
                <PackQuantityPreview quantity={wasteForm.quantity} unit={wasteForm.unitOfMeasure} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Unit (from material)</label>
                <div className="h-9 w-full rounded-lg border border-line bg-surface-2 px-3 flex items-center text-xs font-mono text-ink-muted">
                  {wasteForm.unitOfMeasure || '—'}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Notes</label>
                <textarea value={wasteForm.notes} onChange={(e) => setWasteForm({ ...wasteForm, notes: e.target.value })} rows={3} className="w-full rounded-lg border border-line px-3 py-2 text-xs focus:outline-none focus:border-[#EA4335] resize-none" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowWaste(false)} className="h-9 px-4 rounded-lg border border-line text-xs font-semibold text-ink-muted">Cancel</button>
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
          description="Create a new production order with the specified batch formulation and target quantity."
          onConfirm={confirmCreateOrder}
          onCancel={() => setCreateConfirmation(false)}
          isLoading={saving}
        />
      )}

      {/* Details Modal */}
      {viewing && (
        <DetailsModal
          title="Production Order"
          subtitle={
            <span>
              <span className="font-mono">{viewing.orderNumber}</span>
              {' · '}
              {viewing.bom?.finishedSku?.name ?? viewing.bom?.productName ?? '—'}
            </span>
          }
          status={{ label: viewing.status, className: statusBadge[viewing.status] || statusBadge.SCHEDULED }}
          onClose={() => setViewing(null)}
          sections={[
            {
              title: 'Overview',
              fields: [
                { label: 'Order', value: <span className="font-mono">{viewing.orderNumber}</span> },
                { label: 'Product', value: detailValue(viewing.bom?.finishedSku?.name ?? viewing.bom?.productName) },
                { label: 'Finished SKU', value: <span className="font-mono">{detailValue(viewing.bom?.finishedSku?.sku)}</span> },
                { label: 'Created by', value: detailValue(viewing.createdBy?.fullName) },
                { label: 'Plan', value: viewing.planLinked ? detailValue(viewing.planNumber) : 'Not linked' },
                { label: 'Created', value: detailDate(viewing.createdAt, true) },
              ],
            },
            {
              title: 'Schedule & output',
              fields: [
                { label: 'Target qty', value: formatNumber(viewing.targetQuantity) },
                { label: 'Actual yield', value: viewing.actualYield != null ? formatNumber(viewing.actualYield) : detailValue(viewing.actualYield) },
                { label: 'Yield error', value: viewing.errorPercentage != null ? formatPercent(Math.abs(viewing.errorPercentage), 2) : '—' },
                { label: 'Scheduled start', value: detailDate(viewing.scheduledStart, true) },
                { label: 'Completed', value: detailDate(viewing.actualEnd, true) },
                { label: 'Mix code', value: detailValue(viewing.mixCode) },
                { label: 'Mix units', value: viewing.mixUnits != null ? formatNumber(viewing.mixUnits) : detailValue(viewing.mixUnits) },
              ],
            },
            {
              title: 'Batches & materials',
              fields: [
                { label: 'Finished batch', value: viewing.finishedBatch ? <span className="font-mono">{viewing.finishedBatch.batchNumber}</span> : '—' },
                { label: 'Batch status', value: detailValue(viewing.finishedBatch?.status) },
                { label: 'Ingredients', wide: true, value: viewing.productionIngredients?.length ? viewing.productionIngredients.map((i) => `${i.material.name} ( ${formatQty(i.projectedQuantity, i.material.unitOfMeasure)})`).join(' · ') : '—' },
                { label: 'Ingredients released', value: detailDate(viewing.ingredientsReleasedAt, true) },
                { label: 'Released by', value: detailValue(viewing.ingredientsReleasedBy?.fullName) },
                { label: 'Yield logged', value: viewing.yieldLoggedAt ? `${detailDate(viewing.yieldLoggedAt, true)} · ${viewing.yieldLoggedBy?.fullName ?? '—'}` : '—' },
              ],
            },
          ]}
        />
      )}
    </div>
  );
}
