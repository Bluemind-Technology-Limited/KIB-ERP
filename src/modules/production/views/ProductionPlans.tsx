import { useEffect, useMemo, useState } from 'react';
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  BarChart3,
  Calculator,
  X,
} from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { DetailsModal, ViewButton, detailDate, detailValue } from '../../../components/ui/DetailsModal';
import { PageDescription } from '../../../components/ui/PageDescription';
import { PackQuantityPreview } from '../../../components/ui/PackQuantityPreview';
import { formatNumber, formatQty } from '../../../lib/format';
import { IngredientRequirementsPanel } from '../components/IngredientRequirementsPanel';
import { ReleaseIngredientsModal } from '../components/ReleaseIngredientsModal';

interface Material {
  id: string;
  name: string;
  sku: string;
  type: 'RAW' | 'PACKAGING' | 'FINISHED';
  unitOfMeasure: string;
}

interface BomIngredient {
  id: string;
  quantity: number;
  unitOfMeasure: string;
  isPercentage: boolean;
  material: Material;
}

interface Bom {
  id: string;
  productName: string;
  description?: string | null;
  expectedYield: number;
  yieldUnit: string;
  status: string;
  finishedSku?: { id: string; name: string; sku: string } | null;
  ingredients: BomIngredient[];
}

interface ProductionPlanItem {
  id: string;
  bomId: string;
  targetQuantity: number;
  actualYield?: number | null;
  sequence: number;
  bom: Bom;
  batchLot?: {
    id: string;
    batchNumber: string;
    lotCode?: string | null;
    setNumber?: number | null;
    status: string;
  } | null;
  batchApprovedAt?: string | null;
  batchApprovedBy?: { id: string; fullName: string } | null;
}

interface AggregatedIngredient {
  materialId: string;
  materialName: string;
  sku: string;
  unitOfMeasure: string;
  totalQuantity: number;
  itemCount: number;
}

interface ProductionPlan {
  id: string;
  planNumber: string;
  description?: string | null;
  status: string;
  scheduledFor?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  createdBy?: { id: string; fullName: string } | null;
  releasedAt?: string | Date | null;
  releasedById?: string | null;
  releasedBy?: { id: string; fullName: string } | null;
  items: ProductionPlanItem[];
  aggregatedIngredients: AggregatedIngredient[];
}

const planStatusBadge: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  SCHEDULED: 'bg-blue-50 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
};

const planStatusLabel: Record<string, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Approved / Released',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const planDate = (plan: ProductionPlan) => plan.scheduledFor ?? plan.createdAt;

const productNames = (plan: ProductionPlan) =>
  Array.from(
    new Set(
      plan.items.map((item) => item.bom.finishedSku?.name ?? item.bom.productName)
    )
  );

const commonUnit = (plan: ProductionPlan) => {
  const units = new Set(
    plan.items.map((item) => item.bom.yieldUnit).filter(Boolean) as string[]
  );
  return units.size === 1 ? [...units][0] : null;
};

const plannedTotal = (plan: ProductionPlan) =>
  plan.items.reduce((sum, item) => sum + Number(item.targetQuantity), 0);

const actualTotal = (plan: ProductionPlan) =>
  plan.items.reduce(
    (sum, item) => sum + (item.actualYield != null ? Number(item.actualYield) : 0),
    0
  );

const hasActual = (plan: ProductionPlan) =>
  plan.items.some((item) => item.actualYield != null);

const toLocalInput = (value?: Date | string | null) => {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export default function ProductionPlans({ searchQuery = '' }: { searchQuery?: string }) {
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [boms, setBoms] = useState<Bom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ planId: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [createConfirmation, setCreateConfirmation] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<{ planId: string; action: string } | null>(null);
  const [viewing, setViewing] = useState<ProductionPlan | null>(null);
  const [requirementsPlan, setRequirementsPlan] = useState<ProductionPlan | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<ProductionPlan | null>(null);

  const [form, setForm] = useState({
    description: '',
    scheduledFor: '',
  });
  /** Selected batch formulations and their target quantities, keyed by BOM id. */
  const [selection, setSelection] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const [planRes, bomRes] = await Promise.all([
        axiosClient.get<{ productionPlans: ProductionPlan[] }>('/production/production-plans'),
        axiosClient.get<{ batchFormulations: Bom[] }>('/production/batch-formulations'),
      ]);
      setPlans(planRes.data.productionPlans);
      setBoms(bomRes.data.batchFormulations);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load production plans. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditingPlanId(null);
    setForm({ description: '', scheduledFor: '' });
    setSelection({});
    setError('');
    setShowModal(true);
  };

  const openEdit = (plan: ProductionPlan) => {
    if (plan.status !== 'DRAFT') return;
    setEditingPlanId(plan.id);
    setForm({
      description: plan.description ?? '',
      scheduledFor: toLocalInput(plan.scheduledFor),
    });
    setSelection(
      Object.fromEntries(plan.items.map((item) => [item.bomId, String(item.targetQuantity)]))
    );
    setError('');
    setShowModal(true);
  };

  /** Batch formulations that can go on a plan. */
  const selectableBoms = boms.filter((b) => b.status === 'ACTIVE' || b.status === 'APPROVED');

  const toggleBom = (bomId: string) => {
    setSelection((prev) => {
      const next = { ...prev };
      if (bomId in next) delete next[bomId];
      else next[bomId] = '';
      return next;
    });
  };

  const setTarget = (bomId: string, value: string) => {
    setSelection((prev) => ({ ...prev, [bomId]: value }));
  };

  const selectedEntries = Object.entries(selection);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEntries.length === 0) {
      setError('Select at least one batch formula');
      return;
    }
    const missingQty = selectedEntries.find(([, qty]) => !qty || Number(qty) <= 0);
    if (missingQty) {
      setError('Enter a target quantity for every selected batch formula');
      return;
    }
    setCreateConfirmation(true);
  };

  const confirmSave = async () => {
    setSaving(true);
    try {
      const payload = {
        description: form.description || null,
        scheduledFor: form.scheduledFor ? new Date(form.scheduledFor) : null,
        items: selectedEntries.map(([bomId, qty]) => ({
          bomId,
          targetQuantity: Number(qty),
        })),
      };

      if (editingPlanId) {
        await axiosClient.patch(`/production/production-plans/${editingPlanId}`, payload);
      } else {
        await axiosClient.post('/production/production-plans', payload);
      }

      setShowModal(false);
      setCreateConfirmation(false);
      setEditingPlanId(null);
      setError('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save production order');
      setCreateConfirmation(false);
    } finally {
      setSaving(false);
    }
  };

  const startPlan = async (planId: string) => {
    setActionInProgress({ planId, action: 'start' });
    try {
      await axiosClient.post(`/production/production-plans/${planId}/start`);
      setError('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to start production');
    } finally {
      setActionInProgress(null);
    }
  };

  const completePlan = async (planId: string) => {
    setActionInProgress({ planId, action: 'complete' });
    try {
      await axiosClient.post(`/production/production-plans/${planId}/complete`);
      setError('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to complete production');
    } finally {
      setActionInProgress(null);
    }
  };

  const deletePlan = (planId: string) => {
    setDeleteConfirmation({ planId });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    setIsDeleting(true);
    try {
      await axiosClient.post(`/production/production-plans/${deleteConfirmation.planId}/cancel`);
      setDeleteConfirmation(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to cancel production order');
      setDeleteConfirmation(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    const rows = term
      ? plans.filter((plan) => {
          const haystack = [
            plan.planNumber,
            plan.description ?? '',
            planDate(plan)?.toString() ?? '',
            ...productNames(plan),
            ...plan.items.map((item) => item.bom.productName),
          ]
            .join(' ')
            .toLowerCase();
          return haystack.includes(term);
        })
      : plans;

    return [...rows].sort((a, b) => {
      const aTime = planDate(a) ? new Date(planDate(a)).getTime() : Number.POSITIVE_INFINITY;
      const bTime = planDate(b) ? new Date(planDate(b)).getTime() : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    });
  }, [plans, searchQuery]);

  const busy = (planId: string, action: string) =>
    actionInProgress?.planId === planId && actionInProgress.action === action;

  return (
    <div className="w-full mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Production Schedule</h2>
          <PageDescription>
            Date-based register of every production order and its batch formulas.
          </PageDescription>
        </div>
        <button onClick={openAdd} className="btn-3d px-4 h-9">
          <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
            <Plus className="w-3.5 h-3.5" /> New Production Order
          </span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>
      )}

      <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
        {loading ? (
          <TableSkeleton cols={8} rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No production records found."
            hint="Create a production order for a date and add one or more batch formulas."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Production Date</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Production Order</th>
                  <th className="px-4 py-3 font-semibold">Products</th>
                  <th className="px-4 py-3 font-semibold">Batch Formulas</th>
                  <th className="px-4 py-3 font-semibold text-right">Planned Qty</th>
                  <th className="px-4 py-3 font-semibold text-right">Actual Qty</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((plan) => {
                  const unit = commonUnit(plan);
                  const products = productNames(plan);
                  const planned = plannedTotal(plan);
                  const actual = actualTotal(plan);

                  return (
                    <tr key={plan.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {new Date(planDate(plan)).toLocaleDateString()}
                        </div>
                        {plan.scheduledFor && (
                          <p className="text-[9px] text-slate-400 mt-0.5">
                            {new Date(plan.scheduledFor).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3 align-top">
                        <p className="text-[11px] font-mono font-bold text-[#171717]">
                          {plan.planNumber}
                        </p>
                        {plan.description && (
                          <p className="text-[9px] text-slate-400 max-w-[180px] truncate" title={plan.description}>
                            {plan.description}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {products.map((product) => (
                            <span
                              key={product}
                              className="text-[9px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded"
                            >
                              {product}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="space-y-0.5 max-w-[240px]">
                          {plan.items.map((item, idx) => (
                            <div key={item.id} className="text-[10px] text-slate-600 truncate">
                              <div>
                                <span className="font-mono text-slate-400">#{idx + 1}</span>{' '}
                                {item.bom.productName}
                              </div>
                              <div className="font-mono text-[9px] text-slate-400">
                                {item.batchLot?.lotCode ?? item.batchLot?.batchNumber ?? 'Batch code pending'}
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-[9px] text-slate-400 mt-1">
                          {formatNumber(plan.items.length)} formula{plan.items.length === 1 ? '' : 's'}
                        </p>
                      </td>

                      <td className="px-4 py-3 align-top text-right">
                        {unit ? (
                          <span className="text-[11px] font-semibold text-slate-700">
                            {formatQty(planned, unit)}
                          </span>
                        ) : (
                          <>
                            <span className="text-[11px] font-semibold text-slate-700">
                              {formatNumber(planned)} units
                            </span>
                            <p className="text-[9px] text-slate-400">mixed pack sizes</p>
                          </>
                        )}
                      </td>

                      <td className="px-4 py-3 align-top text-right">
                        {!hasActual(plan) ? (
                          <span className="text-[11px] text-slate-300">—</span>
                        ) : unit ? (
                          <span className="text-[11px] font-semibold text-slate-700">
                            {formatQty(actual, unit)}
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-700">
                            {formatNumber(actual)} units
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 align-top">
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${planStatusBadge[plan.status] ?? planStatusBadge.DRAFT}`}
                        >
                          {planStatusLabel[plan.status] ?? plan.status}
                        </span>
                      </td>

                      <td className="px-4 py-3 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setRequirementsPlan(plan)}
                            title="Ingredient requirements calculation"
                            className="inline-flex items-center gap-1 h-6 px-2 rounded border border-[#00B4D8]/40 bg-[#00B4D8]/10 text-[9px] font-bold uppercase tracking-wider text-[#0077A8] hover:bg-[#00B4D8]/20"
                          >
                            <Calculator className="w-3 h-3" /> Requirements
                          </button>
                          <ViewButton onClick={() => setViewing(plan)} />

                          {plan.status === 'DRAFT' && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEdit(plan)}
                                title="Edit"
                                className="h-6 px-2 rounded border border-slate-200 text-[10px] font-semibold text-slate-600 bg-white hover:bg-slate-50"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setReleaseTarget(plan)}
                                className="h-6 px-2 rounded border border-[#EA4335] bg-[#EA4335] text-[10px] font-semibold text-white hover:bg-[#d3362a]"
                              >
                                Release Ingredients
                              </button>
                              <button
                                type="button"
                                onClick={() => deletePlan(plan.id)}
                                title="Cancel"
                                className="text-slate-300 hover:text-rose-600 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {plan.status === 'SCHEDULED' && (
                            <button
                              type="button"
                              onClick={() => startPlan(plan.id)}
                              disabled={busy(plan.id, 'start')}
                              className="h-6 px-2 rounded border border-emerald-200 text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              {busy(plan.id, 'start') ? 'Starting…' : 'Start'}
                            </button>
                          )}

                          {plan.status === 'IN_PROGRESS' && (
                            <>
                              <button
                                type="button"
                                onClick={() => setViewing(plan)}
                                title="View progress"
                                className="h-6 px-2 rounded border border-slate-200 text-[10px] font-semibold text-slate-600 bg-white hover:bg-slate-50"
                              >
                                <BarChart3 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => completePlan(plan.id)}
                                disabled={busy(plan.id, 'complete')}
                                className="h-6 px-2 rounded border border-emerald-200 text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50"
                              >
                                {busy(plan.id, 'complete') ? 'Completing…' : 'Complete'}
                              </button>
                            </>
                          )}

                          {plan.status === 'COMPLETED' && (
                            <button
                              type="button"
                              onClick={() => setViewing(plan)}
                              title="View progress"
                              className="h-6 px-2 rounded border border-slate-200 text-[10px] font-semibold text-slate-600 bg-white hover:bg-slate-50"
                            >
                              <BarChart3 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <form
            onSubmit={submit}
            className="bg-white rounded-xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#AA3BFF]" />
                <h3 className="text-sm font-bold text-[#171717]">
                  {editingPlanId ? 'Edit Production Order' : 'New Production Order'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Production Date
                </label>
                <input
                  type="datetime-local"
                  value={form.scheduledFor}
                  onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })}
                  className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#AA3BFF]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="e.g. Monday production run"
                  className="w-full rounded-lg border border-[#E9E9E9] px-3 py-2 text-xs focus:outline-none focus:border-[#AA3BFF] resize-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Batch Formulas *
                </label>
                <span className="text-[9px] text-slate-400">
                  {formatNumber(selectedEntries.length)} selected
                </span>
              </div>

              {selectableBoms.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-[10px] text-slate-400">
                  No approved batch formulas yet — approve a formulation before planning production.
                </div>
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-0.5">
                  {selectableBoms.map((bom) => {
                    const selected = bom.id in selection;
                    return (
                      <div
                        key={bom.id}
                        className={`rounded-lg border p-2.5 transition-colors ${
                          selected ? 'border-[#AA3BFF]/40 bg-[#AA3BFF]/5' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleBom(bom.id)}
                            className="mt-0.5 h-3.5 w-3.5 accent-[#AA3BFF]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold text-slate-700 truncate" title={bom.productName}>
                              {bom.productName}
                            </p>
                            <p className="text-[9px] text-slate-400 truncate">
                              {bom.finishedSku?.name ?? '—'} · yield{' '}
                              {formatQty(bom.expectedYield, bom.yieldUnit)}
                            </p>
                          </div>
                        </label>

                        {selected && (
                          <div className="mt-2 flex items-center gap-2 pl-5">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                              Target qty
                            </span>
                            <input
                              value={selection[bom.id]}
                              onChange={(e) => setTarget(bom.id, e.target.value)}
                              type="number"
                              min="0.0001"
                              step="0.0001"
                              placeholder={String(Number(bom.expectedYield) || 100)}
                              className="h-8 w-28 rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#AA3BFF]"
                            />
                            <PackQuantityPreview quantity={selection[bom.id]} unit={bom.yieldUnit} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-3d px-4 h-9">
                <span className="text-white text-xs font-semibold">
                  {saving ? 'Saving…' : editingPlanId ? 'Save Changes' : 'Create Order'}
                </span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {createConfirmation && (
        <ConfirmationModal
          type="create"
          title={editingPlanId ? 'Save Production Order' : 'Create Production Order'}
          description={
            editingPlanId
              ? 'Update this draft order and its batch formulas.'
              : 'Create a production order for the selected date with all selected batch formulas.'
          }
          onConfirm={confirmSave}
          onCancel={() => setCreateConfirmation(false)}
          isLoading={saving}
        />
      )}

      {deleteConfirmation && (
        <ConfirmationModal
          type="delete"
          title="Cancel Production Order"
          description="This production order will be cancelled. This action cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirmation(null)}
          isLoading={isDeleting}
        />
      )}

      {/* Single centralized ingredient release */}
      {releaseTarget && (
        <ReleaseIngredientsModal
          plan={releaseTarget}
          onClose={() => setReleaseTarget(null)}
          onReleased={() => {
            setReleaseTarget(null);
            load();
          }}
        />
      )}

      {/* Ingredient requirements calculation */}
      {requirementsPlan && (
        <Modal onClose={() => setRequirementsPlan(null)}>
          <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto overscroll-contain rounded-xl border border-[#E9E9E9] bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#171717] leading-none">
                  Ingredient requirements
                </h3>
                <p className="mt-1.5 text-[10px] text-slate-400">
                  {requirementsPlan.planNumber} · calculated from approved batch formulas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRequirementsPlan(null)}
                className="text-slate-400 hover:text-slate-600"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <IngredientRequirementsPanel planId={requirementsPlan.id} />
          </div>
        </Modal>
      )}

      {/* Details / progress */}
      {viewing && (
        <DetailsModal
          title="Production Order"
          subtitle={<span className="font-mono">{viewing.planNumber}</span>}
          status={{
            label: planStatusLabel[viewing.status] ?? viewing.status,
            className: planStatusBadge[viewing.status],
          }}
          onClose={() => setViewing(null)}
          sections={[
            {
              title: 'Overview',
              fields: [
                { label: 'Production date', value: detailDate(planDate(viewing)) },
                { label: 'Production order', value: <span className="font-mono">{viewing.planNumber}</span> },
                { label: 'Status', value: planStatusLabel[viewing.status] ?? viewing.status },
                { label: 'Description', value: detailValue(viewing.description), wide: true },
                { label: 'Created by', value: detailValue(viewing.createdBy?.fullName) },
                { label: 'Released by', value: detailValue(viewing.releasedBy?.fullName) },
                { label: 'Released at', value: detailDate(viewing.releasedAt, true) },
              ],
            },
            {
              title: 'Progress',
              fields: [
                { label: 'Batch formulas', value: formatNumber(viewing.items.length) },
                {
                  label: 'Planned quantity',
                  value: commonUnit(viewing)
                    ? formatQty(plannedTotal(viewing), commonUnit(viewing)!)
                    : `${formatNumber(plannedTotal(viewing))} units (mixed pack sizes)`,
                },
                {
                  label: 'Actual quantity',
                  value: hasActual(viewing)
                    ? commonUnit(viewing)
                      ? formatQty(actualTotal(viewing), commonUnit(viewing)!)
                      : `${formatNumber(actualTotal(viewing))} units`
                    : 'Not recorded',
                },
                { label: 'Started', value: detailDate(viewing.startedAt, true) },
                { label: 'Completed', value: detailDate(viewing.completedAt, true) },
              ],
            },
            {
              title: 'Batch formulas',
              fields: [
                {
                  label: 'Individual formulas',
                  wide: true,
                  value: (
                    <div className="space-y-1.5">
                      {viewing.items.map((item, idx) => (
                        <div
                          key={item.id}
                          className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5"
                        >
                          <p className="text-[11px] font-semibold text-slate-700">
                            #{idx + 1} {item.bom.productName} →{' '}
                            {item.bom.finishedSku?.name ?? '—'}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Yield: {formatQty(item.bom.expectedYield, item.bom.yieldUnit)} · Planned:{' '}
                            {formatQty(item.targetQuantity, item.bom.yieldUnit)}
                            {item.actualYield != null
                              ? ` · Actual: ${formatQty(item.actualYield, item.bom.yieldUnit)}`
                              : ''}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[9px] text-slate-400">
                            <span className="font-mono text-[10px] font-semibold text-[#0077A8]">
                              {item.batchLot?.lotCode ?? 'Batch code pending'}
                            </span>
                            <span
                              className={`rounded border px-1 py-0.5 text-[8px] font-bold uppercase ${
                                item.batchLot?.status === 'REJECTED'
                                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                                  : item.batchApprovedAt
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-amber-200 bg-amber-50 text-amber-700'
                              }`}
                            >
                              {item.batchLot?.status === 'REJECTED'
                                ? 'Rejected'
                                : item.batchApprovedAt
                                  ? 'QA approved'
                                  : 'Awaiting QA'}
                            </span>
                          </p>
                          {item.bom.ingredients?.length ? (
                            <p className="text-[9px] text-slate-400 mt-0.5">
                              Ingredients:{' '}
                              {item.bom.ingredients
                                .map(
                                  (ing) =>
                                    `${ing.material.name} ${formatQty(ing.quantity, ing.unitOfMeasure)}`
                                )
                                .join(' · ')}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ),
                },
              ],
            },
            {
              title: 'Consolidated requirements',
              fields: [
                {
                  label: 'Ingredients',
                  wide: true,
                  value: viewing.aggregatedIngredients.length ? (
                    <div className="space-y-1">
                      {viewing.aggregatedIngredients.map((ing) => (
                        <p key={ing.materialId} className="text-[11px] text-slate-600">
                          {ing.materialName}:{' '}
                          <span className="font-semibold">
                            {formatQty(ing.totalQuantity, ing.unitOfMeasure)}
                          </span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    '—'
                  ),
                },
              ],
            },
          ]}
          footer={
            <button
              type="button"
              onClick={() => {
                const plan = viewing;
                setViewing(null);
                setRequirementsPlan(plan);
              }}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-[#00B4D8]/40 bg-[#00B4D8]/10 px-3 text-[10px] font-bold uppercase tracking-wider text-[#0077A8] hover:bg-[#00B4D8]/20"
            >
              <Calculator className="h-3.5 w-3.5" /> View requirement calculation
            </button>
          }
        />
      )}
    </div>
  );
}
