import { useEffect, useState } from 'react';
import { Layers, Plus, ChevronDown, ChevronRight, Play, CheckCircle2, Trash2, Calendar } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';

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

const emptyPlanItem = { bomId: '', targetQuantity: '' };

export default function ProductionPlans({ searchQuery = '' }: { searchQuery?: string }) {
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [boms, setBoms] = useState<Bom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ planId: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [createConfirmation, setCreateConfirmation] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<{ planId: string; action: string } | null>(null);

  const [form, setForm] = useState({
    description: '',
    scheduledFor: '',
  });
  const [items, setItems] = useState([{ ...emptyPlanItem }]);

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

  const toggleExpanded = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const openAdd = () => {
    setForm({ description: '', scheduledFor: '' });
    setItems([{ ...emptyPlanItem }]);
    setError('');
    setShowModal(true);
  };

  const updateItem = (i: number, field: keyof typeof emptyPlanItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx !== i ? item : { ...item, [field]: value }))
    );
  };

  const addItemRow = () => setItems((prev) => [...prev, { ...emptyPlanItem }]);
  const removeItemRow = (i: number) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter((item) => item.bomId && item.targetQuantity);
    if (validItems.length === 0) {
      setError('Add at least one BOM with a target quantity');
      return;
    }
    setCreateConfirmation(true);
  };

  const confirmCreate = async () => {
    const validItems = items.filter((item) => item.bomId && item.targetQuantity);
    setSaving(true);
    try {
      const plan = await axiosClient.post<{ productionPlan: ProductionPlan }>('/production/production-plans', {
        description: form.description || null,
        scheduledFor: form.scheduledFor ? new Date(form.scheduledFor) : null,
      });
      const planId = plan.data.productionPlan.id;

      // Add items to plan
      for (let i = 0; i < validItems.length; i++) {
        await axiosClient.post(`/production/production-plans/${planId}/formulations`, {
          bomId: validItems[i].bomId,
          targetQuantity: Number(validItems[i].targetQuantity),
        });
      }

      setShowModal(false);
      setCreateConfirmation(false);
      setError('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create production plan');
      setCreateConfirmation(false);
    } finally {
      setSaving(false);
    }
  };

  const schedulePlan = async (planId: string) => {
    setActionInProgress({ planId, action: 'schedule' });
    try {
      await axiosClient.post(`/production/production-plans/${planId}/schedule`);
      setError('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to schedule plan');
    } finally {
      setActionInProgress(null);
    }
  };

  const startPlan = async (planId: string) => {
    setActionInProgress({ planId, action: 'start' });
    try {
      await axiosClient.post(`/production/production-plans/${planId}/start`);
      setError('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to start plan');
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
      setError(err?.response?.data?.error || 'Failed to complete plan');
    } finally {
      setActionInProgress(null);
    }
  };

  const deletePlan = async (planId: string) => {
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
      setError(err?.response?.data?.error || 'Failed to delete production plan');
      setDeleteConfirmation(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = plans.filter(
    (p) =>
      p.planNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Production Plans</h2>
          <p className="text-[#737373] text-xs">Multi-product recipes with aggregated ingredients and coordinated scheduling.</p>
        </div>
        <button onClick={openAdd} className="btn-3d px-4 h-9">
          <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
            <Plus className="w-3.5 h-3.5" /> New Plan
          </span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>
      )}

      {/* 2. Plans List */}
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
            <EmptyState title="No production plans found." hint="Create your first multi-product plan." />
          </div>
        ) : (
          filtered.map((plan) => {
            const isOpen = !!expanded[plan.id];
            return (
              <div key={plan.id} className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleExpanded(plan.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/60 text-left"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-[#AA3BFF]/10 flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4 text-[#AA3BFF]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-[#171717]">{plan.planNumber}</p>
                      <p className="text-[10px] text-slate-400">
                        {plan.items.length} BOM{plan.items.length !== 1 ? 's' : ''} · {plan.aggregatedIngredients.length} unique ingredients · Scheduled {plan.scheduledFor ? new Date(plan.scheduledFor).toLocaleDateString() : 'not set'}
                      </p>
                      {plan.description && (
                        <p className="text-[10px] text-slate-500 mt-1 truncate">{plan.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${planStatusBadge[plan.status]}`}>
                      {plan.status}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePlan(plan.id);
                      }}
                      className="text-slate-300 hover:text-rose-600 transition-colors p-1.5"
                      title="Cancel plan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 px-4 py-4 space-y-4">
                    {/* Plan Items */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">BOMs in Plan</div>
                      <div className="space-y-2">
                        {plan.items.map((item, idx) => (
                          <div key={item.id} className="rounded-lg border border-slate-100 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1">
                                <p className="text-[11px] font-bold text-slate-700">
                                  {idx + 1}. {item.bom.productName} → {item.bom.finishedSku?.name ?? '—'}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  Target: <b>{item.targetQuantity}</b> {item.bom.yieldUnit}
                                  {item.actualYield && (
                                    <>
                                      {' '} • Actual: <b>{item.actualYield}</b> {item.bom.yieldUnit}
                                    </>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Aggregated Ingredients */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Aggregated Ingredients</div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-slate-100 text-[9px] uppercase tracking-wider text-slate-400">
                              <th className="px-2 py-1.5 font-semibold">Material</th>
                              <th className="px-2 py-1.5 font-semibold text-right">Total Qty</th>
                              <th className="px-2 py-1.5 font-semibold">Unit</th>
                              <th className="px-2 py-1.5 font-semibold text-right">Used In</th>
                            </tr>
                          </thead>
                          <tbody>
                            {plan.aggregatedIngredients.map((ing) => (
                              <tr key={ing.materialId} className="border-b border-slate-50">
                                <td className="px-2 py-2 text-[11px] font-semibold text-slate-700">{ing.materialName}</td>
                                <td className="px-2 py-2 text-right text-[11px] font-mono text-slate-600">{Number(ing.totalQuantity).toFixed(2)}</td>
                                <td className="px-2 py-2 text-[11px] text-slate-500">{ing.unitOfMeasure}</td>
                                <td className="px-2 py-2 text-right text-[11px] text-slate-400">{ing.itemCount} BOM{ing.itemCount !== 1 ? 's' : ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                      {plan.status === 'DRAFT' && (
                        <button
                          onClick={() => schedulePlan(plan.id)}
                          disabled={actionInProgress?.planId === plan.id}
                          className="btn-3d px-3 h-7"
                        >
                          <span className="flex items-center gap-1 text-white text-[10px] font-semibold">
                            <Calendar className="w-3 h-3" /> {actionInProgress?.planId === plan.id ? 'Scheduling…' : 'Schedule'}
                          </span>
                        </button>
                      )}
                      {plan.status === 'SCHEDULED' && (
                        <button
                          onClick={() => startPlan(plan.id)}
                          disabled={actionInProgress?.planId === plan.id}
                          className="btn-3d px-3 h-7"
                        >
                          <span className="flex items-center gap-1 text-white text-[10px] font-semibold">
                            <Play className="w-3 h-3" /> {actionInProgress?.planId === plan.id ? 'Starting…' : 'Start'}
                          </span>
                        </button>
                      )}
                      {plan.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => completePlan(plan.id)}
                          disabled={actionInProgress?.planId === plan.id}
                          className="btn-3d px-3 h-7"
                        >
                          <span className="flex items-center gap-1 text-white text-[10px] font-semibold">
                            <CheckCircle2 className="w-3 h-3" /> {actionInProgress?.planId === plan.id ? 'Completing…' : 'Complete'}
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

      {/* 3. Create Plan Modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <form onSubmit={submit} className="bg-white rounded-xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#AA3BFF]" />
                <h3 className="text-sm font-bold text-[#171717]">New Production Plan</h3>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {/* Plan Details */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="e.g. Q4 Summer Collection Production" className="w-full rounded-lg border border-[#E9E9E9] px-3 py-2 text-xs focus:outline-none focus:border-[#AA3BFF] resize-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Scheduled For</label>
                <input type="datetime-local" value={form.scheduledFor} onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#AA3BFF]" />
              </div>
            </div>

            {/* Plan Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">BOMs to Produce *</label>
                <span className="text-[9px] text-slate-400">{items.filter((i) => i.bomId && i.targetQuantity).length} added</span>
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
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">BOM *</label>
                      <select value={item.bomId} onChange={(e) => updateItem(i, 'bomId', e.target.value)} className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#AA3BFF]">
                        <option value="">Select BOM…</option>
                        {boms.filter((b) => b.status === 'ACTIVE' || b.status === 'APPROVED').map((b) => (
                          <option key={b.id} value={b.id}>{b.productName} → {b.finishedSku?.name ?? '—'}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Target Quantity *</label>
                      <input value={item.targetQuantity} onChange={(e) => updateItem(i, 'targetQuantity', e.target.value)} type="number" step="0.0001" placeholder="e.g. 100" className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#AA3BFF]" />
                    </div>
                  </div>
                ))}
              </div>

              <button type="button" onClick={addItemRow} className="w-full h-10 rounded-lg border-2 border-dashed border-slate-200 hover:border-[#AA3BFF]/50 hover:bg-purple-50/30 text-xs font-bold text-slate-400 hover:text-[#AA3BFF] transition-colors flex items-center justify-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add BOM to Plan
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowModal(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
              <button type="submit" disabled={saving} className="btn-3d px-4 h-9">
                <span className="text-white text-xs font-semibold">{saving ? 'Creating…' : 'Create Plan'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create Confirmation Modal */}
      {createConfirmation && (
        <ConfirmationModal
          type="create"
          title="Create Production Plan"
          description="Create a new production plan with the specified BOMs and target quantities."
          onConfirm={confirmCreate}
          onCancel={() => setCreateConfirmation(false)}
          isLoading={saving}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <ConfirmationModal
          type="delete"
          title="Cancel Production Plan"
          description="This production plan will be permanently cancelled. This action cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirmation(null)}
          isLoading={isDeleting}
        />
      )}
    </div>
  );
}
