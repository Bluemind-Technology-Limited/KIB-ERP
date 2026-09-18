import { useEffect, useState } from 'react';
import { FlaskConical, Plus, ChevronDown, ChevronRight, CheckCircle2, Trash2, FileCog } from 'lucide-react';
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
  traceabilityCode?: string;
}

interface BomIngredient {
  id: string;
  quantity: number;
  unitOfMeasure: string;
  isPercentage: boolean;
  material: Material;
}

/**
 * Batch formulations are flat — versioning was removed, so the formulation
 * itself carries the status, yield and finished SKU.
 */
interface BatchFormulation {
  id: string;
  productName: string;
  description?: string | null;
  status: string;
  expectedYield?: number | null;
  yieldUnit?: string | null;
  finishedSku?: { id: string; name: string; sku: string } | null;
  ingredients: BomIngredient[];
}

const versionStatusBadge: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ARCHIVED: 'bg-slate-100 text-slate-500 border-slate-200',
};

const emptyIngredient = { materialId: '', quantity: '', unitOfMeasure: '', isPercentage: false };

export default function BOM({ searchQuery = '' }: { searchQuery?: string }) {
  const [boms, setBoms] = useState<BatchFormulation[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ bomId: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [createConfirmation, setCreateConfirmation] = useState(false);

  const [form, setForm] = useState({
    productName: '',
    description: '',
    expectedYield: '',
    yieldUnit: '',
    finishedSkuId: '',
  });
  const [ingredients, setIngredients] = useState([{ ...emptyIngredient }]);

  const load = async () => {
    setLoading(true);
    try {
      const [bomRes, matRes] = await Promise.all([
        axiosClient.get<{ batchFormulations: BatchFormulation[] }>('/production/batch-formulations'),
        axiosClient.get<{ materials: Material[] }>('/master-data/materials'),
      ]);
      setBoms(bomRes.data.batchFormulations ?? []);
      setMaterials(matRes.data.materials);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load BOMs. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleExpanded = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const finishedMaterials = materials.filter((m) => m.type === 'FINISHED');
  const rawMaterials = materials.filter((m) => m.type === 'RAW' || m.type === 'PACKAGING');

  const openAdd = () => {
    setForm({ productName: '', description: '', expectedYield: '', yieldUnit: '', finishedSkuId: '' });
    setIngredients([{ ...emptyIngredient }]);
    setError('');
    setShowModal(true);
  };

  const updateIngredient = (i: number, field: keyof typeof emptyIngredient, value: string | boolean) => {
    setIngredients((prev) =>
      prev.map((ing, idx) => {
        if (idx !== i) return ing;
        const next = { ...ing, [field]: value };
        // Auto-fill the unit from the selected material's UoM when picking a material.
        if (field === 'materialId') {
          const m = materials.find((x) => x.id === value);
          if (m) next.unitOfMeasure = m.unitOfMeasure;
        }
        return next;
      })
    );
  };

  const addIngredientRow = () => setIngredients((prev) => [...prev, { ...emptyIngredient }]);
  const removeIngredientRow = (i: number) => {
    setIngredients((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.productName || !form.finishedSkuId || !form.expectedYield || !form.yieldUnit) {
      setError('Product name, finished SKU, expected yield and yield unit are required');
      return;
    }
    const validIngredients = ingredients.filter((ing) => ing.materialId && ing.quantity);
    if (validIngredients.length === 0) {
      setError('Add at least one ingredient with a material and quantity');
      return;
    }
    setCreateConfirmation(true);
  };

  const confirmCreate = async () => {
    const validIngredients = ingredients.filter((ing) => ing.materialId && ing.quantity);
    const missingCode = validIngredients.find((ing) => !materials.find((m) => m.id === ing.materialId)?.traceabilityCode?.trim());
    if (missingCode) {
      const mat = materials.find((m) => m.id === missingCode.materialId);
      setError(`Ingredient "${mat?.name ?? missingCode.materialId}" has no traceability code. Add it in Master Data → Materials before saving this formulation.`);
      setCreateConfirmation(false);
      return;
    }
    setSaving(true);
    try {
      await axiosClient.post('/production/batch-formulations', {
        productName: form.productName,
        description: form.description || null,
        expectedYield: Number(form.expectedYield),
        yieldUnit: form.yieldUnit,
        finishedSkuId: form.finishedSkuId,
        ingredients: validIngredients.map((ing) => ({
          materialId: ing.materialId,
          quantity: Number(ing.quantity),
          unitOfMeasure: ing.unitOfMeasure || 'kg',
          isPercentage: ing.isPercentage,
        })),
      });
      setShowModal(false);
      setCreateConfirmation(false);
      setError('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save BOM');
      setCreateConfirmation(false);
    } finally {
      setSaving(false);
    }
  };

  /** DRAFT -> ACTIVE. */
  const approveFormulation = async (bomId: string) => {
    try {
      await axiosClient.post(`/production/batch-formulations/${bomId}/approve`, {}, {
        toast: { success: 'Formulation approved and set active' },
      });
      setError('');
      load();
    } catch {
      // toast handled globally
    }
  };

  const archiveFormulation = async (bomId: string) => {
    try {
      await axiosClient.post(`/production/batch-formulations/${bomId}/archive`, {}, {
        toast: { success: 'Formulation archived' },
      });
      setError('');
      load();
    } catch {
      // toast handled globally
    }
  };

  const deleteBom = async (bomId: string) => {
    setDeleteConfirmation({ bomId });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    setIsDeleting(true);
    try {
      await axiosClient.delete(`/production/batch-formulations/${deleteConfirmation.bomId}`, {
        toast: { success: 'Formulation deleted' },
      });
      setDeleteConfirmation(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete BOM');
      setDeleteConfirmation(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = (boms || []).filter(
    (b) =>
      b.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.finishedSku?.name ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Batch Formulation</h2>
          <p className="text-[#737373] text-xs">Ingredient recipes with % / absolute quantities and expected yield.</p>
        </div>
        <button onClick={openAdd} className="btn-3d px-4 h-9">
          <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
            <Plus className="w-3.5 h-3.5" /> New
          </span>
        </button>
      </div>

      {error && (
        <div className="relative z-9999 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>
      )}

      {/* 2. BOM List */}
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
            <EmptyState title="No BOMs found." hint="Create your first recipe." />
          </div>
        ) : (
          filtered.map((bom) => {
            const isOpen = !!expanded[bom.id];
            const bomIngredients = bom.ingredients ?? [];
            const ingCount = bomIngredients.length;
            return (
              <div key={bom.id} className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleExpanded(bom.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/60 text-left"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-[#EA4335]/10 flex items-center justify-center shrink-0">
                      <FlaskConical className="w-4 h-4 text-[#EA4335]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-[#171717]">{bom.productName}</p>
                      <p className="text-[10px] text-slate-400">
                        {bom.finishedSku?.name ?? '—'} · Yield {bom.expectedYield ?? '—'} {bom.yieldUnit ?? ''} · {ingCount} ingredients
                      </p>
                      {!isOpen && ingCount > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {bomIngredients.slice(0, 3).map((ing) => (
                            <span key={ing.id} className="text-[9px] text-slate-500 bg-slate-100/50 px-1.5 py-0.5 rounded">
                              {ing.material.name} {ing.isPercentage ? `${ing.quantity}%` : `${ing.quantity} ${ing.unitOfMeasure}`}
                            </span>
                          ))}
                          {ingCount > 3 && (
                            <span className="text-[9px] text-slate-400 px-1.5 py-0.5">
                              +{ingCount - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${versionStatusBadge[bom.status] ?? versionStatusBadge.DRAFT}`}>
                      {bom.status}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteBom(bom.id);
                      }}
                      className="text-slate-300 hover:text-rose-600 transition-colors p-1.5"
                      title="Delete formulation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 px-4 py-4 space-y-4">
                    <div className="rounded-lg border border-slate-100 p-3 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <FileCog className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-[11px] font-bold text-slate-700">
                            {bom.finishedSku?.name ?? '—'}
                          </span>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${versionStatusBadge[bom.status] ?? versionStatusBadge.DRAFT}`}>
                            {bom.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">
                            Yield: <b className="text-slate-600">{bom.expectedYield}</b> {bom.yieldUnit}
                          </span>
                          {bom.status === 'DRAFT' && (
                            <button onClick={() => approveFormulation(bom.id)} className="btn-3d px-3 h-7">
                              <span className="flex items-center gap-1 text-white text-[10px] font-semibold">
                                <CheckCircle2 className="w-3 h-3" /> Approve
                              </span>
                            </button>
                          )}
                          {bom.status === 'ACTIVE' && (
                            <button
                              onClick={() => archiveFormulation(bom.id)}
                              className="h-7 px-3 rounded-lg border border-slate-200 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              Archive
                            </button>
                          )}
                        </div>
                      </div>

                      {ingCount === 0 ? (
                        <p className="text-[10px] text-slate-400">No ingredients on this formulation.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b border-slate-100 text-[9px] uppercase tracking-wider text-slate-400">
                                <th className="px-2 py-1.5 font-semibold">Ingredient</th>
                                <th className="px-2 py-1.5 font-semibold">Type</th>
                                <th className="px-2 py-1.5 font-semibold text-right">Quantity</th>
                                <th className="px-2 py-1.5 font-semibold">Unit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bomIngredients.map((ing) => (
                                <tr key={ing.id} className="border-b border-slate-50">
                                  <td className="px-2 py-2 text-[11px] font-semibold text-slate-700">{ing.material.name}</td>
                                  <td className="px-2 py-2">
                                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${ing.material.type === 'RAW' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-sky-50 text-sky-700 border-sky-200'}`}>
                                      {ing.material.type}
                                    </span>
                                  </td>
                                  <td className="px-2 py-2 text-right text-[11px] font-mono text-slate-600">
                                    {ing.isPercentage ? `${ing.quantity}%` : ing.quantity}
                                  </td>
                                  <td className="px-2 py-2 text-[11px] text-slate-500">{ing.unitOfMeasure}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 3. Add BOM Modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <form onSubmit={submit} className="bg-white rounded-xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-[#EA4335]" />
                <h3 className="text-sm font-bold text-[#171717]">New Batch Formulation</h3>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {/* 3a. Basic recipe info */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Product Name *</label>
                <input value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} placeholder="e.g. Cocoa Butter Body Balm" className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Finished SKU *</label>
                  <select value={form.finishedSkuId} onChange={(e) => setForm({ ...form, finishedSkuId: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                    <option value="">Select finished product…</option>
                    {finishedMaterials.map((m) => (
                      <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Expected Yield *</label>
                  <input value={form.expectedYield} onChange={(e) => setForm({ ...form, expectedYield: e.target.value })} type="number" step="0.0001" placeholder="e.g. 100" className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Yield Unit *</label>
                  <input value={form.yieldUnit} onChange={(e) => setForm({ ...form, yieldUnit: e.target.value })} placeholder="kg / units / liters" className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full rounded-lg border border-[#E9E9E9] px-3 py-2 text-xs focus:outline-none focus:border-[#EA4335] resize-none" />
              </div>
            </div>

            {/* 3b. Ingredients */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ingredients *</label>
                <span className="text-[9px] text-slate-400">{ingredients.filter((i) => i.materialId && i.quantity).length} added</span>
              </div>

              <div className="space-y-2">
                {ingredients.map((ing, i) => {
                  const mat = materials.find((m) => m.id === ing.materialId);
                  return (
                    <div key={i} className="rounded-lg border border-slate-200 bg-slate-50/40 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500">Ingredient {i + 1}</span>
                        <button type="button" onClick={() => removeIngredientRow(i)} className="text-slate-300 hover:text-rose-500 p-0.5">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Material *</label>
                        <select value={ing.materialId} onChange={(e) => updateIngredient(i, 'materialId', e.target.value)} className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                          <option value="">Select material…</option>
                          {rawMaterials.map((m) => (
                            <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Quantity *</label>
                          <input value={ing.quantity} onChange={(e) => updateIngredient(i, 'quantity', e.target.value)} type="number" step="0.0001" placeholder="e.g. 2.5" className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#EA4335]" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Measured As</label>
                          <div className="flex gap-1 h-9">
                            <button
                              type="button"
                              onClick={() => updateIngredient(i, 'isPercentage', false)}
                              className={`flex-1 px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${
                                !ing.isPercentage
                                  ? 'bg-[#EA4335] text-white border-[#EA4335]'
                                  : 'bg-white text-slate-400 border-[#E9E9E9] hover:border-slate-300'
                              }`}
                            >
                              Unit
                            </button>
                            <button
                              type="button"
                              onClick={() => updateIngredient(i, 'isPercentage', true)}
                              className={`flex-1 px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${
                                ing.isPercentage
                                  ? 'bg-[#EA4335] text-white border-[#EA4335]'
                                  : 'bg-white text-slate-400 border-[#E9E9E9] hover:border-slate-300'
                              }`}
                            >
                              % of Batch
                            </button>
                          </div>
                        </div>
                      </div>
                      {!ing.isPercentage && (
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Unit of Measure</label>
                          <input value={ing.unitOfMeasure} onChange={(e) => updateIngredient(i, 'unitOfMeasure', e.target.value)} placeholder={mat?.unitOfMeasure ?? 'kg'} className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#EA4335]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button type="button" onClick={addIngredientRow} className="w-full h-10 rounded-lg border-2 border-dashed border-slate-200 hover:border-[#EA4335]/50 hover:bg-rose-50/30 text-xs font-bold text-slate-400 hover:text-[#EA4335] transition-colors flex items-center justify-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add Ingredient
              </button>
              <p className="text-[9px] text-slate-400">Choose "Unit" for absolute amounts or "% of Batch" to scale with batch size.</p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowModal(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
              <button type="submit" disabled={saving} className="btn-3d px-4 h-9">
                <span className="text-white text-xs font-semibold">{saving ? 'Saving…' : 'Create'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create Confirmation Modal */}
      {createConfirmation && (
        <ConfirmationModal
          type="create"
          title="Create Batch Formulation"
          description="Create a new Batch Formulation with the specified ingredients and expected yield."
          onConfirm={confirmCreate}
          onCancel={() => setCreateConfirmation(false)}
          isLoading={saving}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <ConfirmationModal
          type="delete"
          title="Delete Formulation"
          description="This batch formulation will be permanently deleted, along with its ingredients. This action cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirmation(null)}
          isLoading={isDeleting}
        />
      )}
    </div>
  );
}
