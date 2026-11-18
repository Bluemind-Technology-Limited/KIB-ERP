import { useEffect, useState } from 'react';
import { FlaskConical, Plus, ChevronDown, ChevronRight, CheckCircle2, Trash2, FileCog } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { DetailsModal, ViewButton, detailValue } from '../../../components/ui/DetailsModal';
import { PageDescription } from '../../../components/ui/PageDescription';
import { PackQuantityPreview } from '../../../components/ui/PackQuantityPreview';
import { formatNumber, formatQty } from '../../../lib/format';

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
  DRAFT: 'bg-surface-3 text-ink-muted border-line',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
  ARCHIVED: 'bg-surface-3 text-ink-muted border-line',
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
  const [viewing, setViewing] = useState<BatchFormulation | null>(null);

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
    if (!form.finishedSkuId || !(Number(form.expectedYield) > 0) || !form.yieldUnit) {
      setError('Select the finished product, then enter an expected yield greater than zero');
      return;
    }
    const validIngredients = ingredients.filter((ing) => ing.materialId && ing.quantity);
    if (validIngredients.length === 0) {
      setError('Add at least one ingredient with a material and quantity');
      return;
    }
    if (validIngredients.some((ing) => !(Number(ing.quantity) > 0))) {
      setError('Every ingredient needs a quantity greater than zero');
      return;
    }
    if (validIngredients.some((ing) => ing.isPercentage && Number(ing.quantity) > 100)) {
      setError('Percentage ingredients cannot exceed 100%');
      return;
    }
    setCreateConfirmation(true);
  };

  const confirmCreate = async () => {
    const validIngredients = ingredients.filter((ing) => ing.materialId && ing.quantity);
    if (validIngredients.some((ing) => !(Number(ing.quantity) > 0))) {
      setError('Every ingredient needs a quantity greater than zero');
      setCreateConfirmation(false);
      return;
    }
    if (validIngredients.some((ing) => ing.isPercentage && Number(ing.quantity) > 100)) {
      setError('Percentage ingredients cannot exceed 100%');
      setCreateConfirmation(false);
      return;
    }
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
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-ink">Batch Formulation</h2>
          <PageDescription>Ingredient recipes with % / absolute quantities and expected yield.</PageDescription>
        </div>
        <button onClick={openAdd} className="btn-3d px-4 h-9">
          <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
            <Plus className="w-3.5 h-3.5" /> New
          </span>
        </button>
      </div>

      {error && (
        <div className="relative z-9999 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>
      )}

      {/* 2. BOM List */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface border border-line rounded-xl overflow-hidden">
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
          <div className="bg-surface border border-line rounded-xl">
            <EmptyState title="No BOMs found." hint="Create your first recipe." />
          </div>
        ) : (
          filtered.map((bom) => {
            const isOpen = !!expanded[bom.id];
            const bomIngredients = bom.ingredients ?? [];
            const ingCount = bomIngredients.length;
            return (
              <div key={bom.id} className="bg-surface border border-line rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleExpanded(bom.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-2/60 text-left"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-[#EA4335]/10 flex items-center justify-center shrink-0">
                      <FlaskConical className="w-4 h-4 text-[#EA4335]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-ink max-w-[220px] truncate" title={bom.productName}>{bom.productName}</p>
                      <p className="text-[10px] text-ink-faint max-w-[280px] truncate">
                        {bom.finishedSku?.name ?? '—'} · Yield {bom.expectedYield != null ? formatQty(bom.expectedYield, bom.yieldUnit) : '—'} · {formatNumber(ingCount)} ingredients
                      </p>
                      {!isOpen && ingCount > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {bomIngredients.slice(0, 3).map((ing) => (
                            <span key={ing.id} className="text-[9px] text-white bg-slate-600 px-1.5 py-0.5 rounded">
                              {ing.material.name} {ing.isPercentage ? `${formatNumber(ing.quantity)}%` : formatQty(ing.quantity, ing.unitOfMeasure)}
                            </span>
                          ))}
                          {ingCount > 3 && (
                            <span className="text-[9px] text-ink-faint px-1.5 py-0.5">
                              +{formatNumber(ingCount - 3)} more
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
                    <ViewButton onClick={() => setViewing(bom)} />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteBom(bom.id);
                      }}
                      className="text-ink-faint hover:text-rose-600 transition-colors p-1.5 dark:hover:text-rose-300"
                      title="Delete formulation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-ink-faint" /> : <ChevronRight className="w-4 h-4 text-ink-faint" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-line px-4 py-4 space-y-4">
                    <div className="rounded-lg border border-line p-3 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <FileCog className="w-3.5 h-3.5 text-ink-faint" />
                          <span className="text-[11px] font-bold text-ink-2">
                            {bom.finishedSku?.name ?? '—'}
                          </span>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${versionStatusBadge[bom.status] ?? versionStatusBadge.DRAFT}`}>
                            {bom.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-ink-faint">
                            Yield: <b className="text-ink-muted">{bom.expectedYield != null ? formatQty(bom.expectedYield, bom.yieldUnit) : '—'}</b>
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
                              className="h-7 px-3 rounded-lg border border-line text-[10px] font-semibold text-ink-muted hover:bg-surface-2"
                            >
                              Archive
                            </button>
                          )}
                        </div>
                      </div>

                      {ingCount === 0 ? (
                        <p className="text-[10px] text-ink-faint">No ingredients on this formulation.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b border-line text-[9px] uppercase tracking-wider text-ink-faint">
                                <th className="px-2 py-1.5 font-semibold">Ingredient</th>
                                <th className="px-2 py-1.5 font-semibold">Type</th>
                                <th className="px-2 py-1.5 font-semibold text-right">Quantity</th>
                                <th className="px-2 py-1.5 font-semibold">Unit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bomIngredients.map((ing) => (
                                <tr key={ing.id} className="border-b border-line">
                                  <td className="px-2 py-2 text-[11px] font-semibold text-ink-2 max-w-[180px] truncate" title={ing.material.name}>{ing.material.name}</td>
                                  <td className="px-2 py-2">
                                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${ing.material.type === 'RAW' ? 'bg-amber-600 text-white' : 'bg-sky-600 text-white'}`}>
                                      {ing.material.type}
                                    </span>
                                  </td>
                                  <td className="px-2 py-2 text-right text-[11px] font-mono text-ink-muted">
                                    {ing.isPercentage ? `${formatNumber(ing.quantity)}%` : formatNumber(ing.quantity)}
                                  </td>
                                  <td className="px-2 py-2 text-[11px] text-ink-muted">{ing.unitOfMeasure}</td>
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
          <form onSubmit={submit} className="bg-surface rounded-xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-[#EA4335]" />
                <h3 className="text-sm font-bold text-ink">New Batch Formulation</h3>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="text-ink-faint hover:text-ink-muted">✕</button>
            </div>

            {/* 3a. Basic recipe info */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Finished Product *</label>
                <select
                  value={form.finishedSkuId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const product = finishedMaterials.find((m) => m.id === id);
                    // The product name is derived from the finished good.
                    setForm({
                      ...form,
                      finishedSkuId: id,
                      productName: product?.name ?? '',
                      yieldUnit: form.yieldUnit || product?.unitOfMeasure || '',
                    });
                  }}
                  className="h-9 w-full rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                >
                  <option value="">Select finished product…</option>
                  {finishedMaterials.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>
                  ))}
                </select>
                <p className="text-[9px] text-ink-faint">
                  {form.productName
                    ? `Product name: ${form.productName}`
                    : 'The product name is taken from the finished good you pick.'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Expected Yield *</label>
                  <input value={form.expectedYield} onChange={(e) => setForm({ ...form, expectedYield: e.target.value })} type="number" min="0.0001" step="0.0001" placeholder="e.g. 100" className="h-9 w-full rounded-lg border border-line px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
                  <PackQuantityPreview quantity={form.expectedYield} unit={form.yieldUnit} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Yield Unit (from product)</label>
                  <div className="h-9 w-full rounded-lg border border-line bg-surface-2 px-3 flex items-center text-xs font-mono text-ink-muted">
                    {form.yieldUnit || '—'}
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full rounded-lg border border-line px-3 py-2 text-xs focus:outline-none focus:border-[#EA4335] resize-none" />
              </div>
            </div>

            {/* 3b. Ingredients */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Ingredients *</label>
                <span className="text-[9px] text-ink-faint">{formatNumber(ingredients.filter((i) => i.materialId && i.quantity).length)} added</span>
              </div>

              <div className="space-y-2">
                {ingredients.map((ing, i) => {
                  const mat = materials.find((m) => m.id === ing.materialId);
                  return (
                    <div key={i} className="rounded-lg border border-line bg-surface-2/40 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-ink-muted">Ingredient {i + 1}</span>
                        <button type="button" onClick={() => removeIngredientRow(i)} className="text-ink-faint hover:text-rose-500 p-0.5">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-ink-faint">Material *</label>
                        <select value={ing.materialId} onChange={(e) => updateIngredient(i, 'materialId', e.target.value)} className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                          <option value="">Select material…</option>
                          {rawMaterials.map((m) => (
                            <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-ink-faint">Quantity *</label>
                          <input value={ing.quantity} onChange={(e) => updateIngredient(i, 'quantity', e.target.value)} type="number" min="0.0001" max={ing.isPercentage ? 100 : undefined} step="0.0001" placeholder="e.g. 2.5" className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-xs focus:outline-none focus:border-[#EA4335]" />
                          <PackQuantityPreview
                            quantity={ing.quantity}
                            unit={ing.isPercentage ? null : ing.unitOfMeasure}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-ink-faint">Measured As</label>
                          <div className="flex gap-1 h-9">
                            <button
                              type="button"
                              onClick={() => updateIngredient(i, 'isPercentage', false)}
                              className={`flex-1 px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${
                                !ing.isPercentage
                                  ? 'bg-[#EA4335] text-white border-[#EA4335]'
                                  : 'bg-surface text-ink-faint border-line hover:border-line-strong'
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
                                  : 'bg-surface text-ink-faint border-line hover:border-line-strong'
                              }`}
                            >
                              % of Batch
                            </button>
                          </div>
                        </div>
                      </div>
                      {!ing.isPercentage && (
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-ink-faint">Unit (from material)</label>
                          <div className="h-9 w-full rounded-lg border border-line bg-surface-2 px-2 flex items-center text-xs font-mono text-ink-muted">
                            {mat?.unitOfMeasure ?? ing.unitOfMeasure ?? '—'}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button type="button" onClick={addIngredientRow} className="w-full h-10 rounded-lg border-2 border-dashed border-line hover:border-[#EA4335]/50 hover:bg-rose-50/30 text-xs font-bold text-ink-faint hover:text-[#EA4335] transition-colors flex items-center justify-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add Ingredient
              </button>
              <p className="text-[9px] text-ink-faint">Choose "Unit" for absolute amounts or "% of Batch" to scale with batch size.</p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button type="button" onClick={() => setShowModal(false)} className="h-9 px-4 rounded-lg border border-line text-xs font-semibold text-ink-muted">Cancel</button>
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

      {/* Details Modal */}
      {viewing && (
        <DetailsModal
          title="Batch Formulation"
          subtitle={<span className="font-mono">{detailValue(viewing.finishedSku?.sku)}</span>}
          status={{ label: viewing.status, className: versionStatusBadge[viewing.status] ?? versionStatusBadge.DRAFT }}
          onClose={() => setViewing(null)}
          sections={[
            {
              title: 'Overview',
              fields: [
                { label: 'Product', value: viewing.productName },
                { label: 'Finished SKU', value: viewing.finishedSku ? `${viewing.finishedSku.name} (${viewing.finishedSku.sku})` : '—' },
                { label: 'Status', value: viewing.status },
                { label: 'Description', value: detailValue(viewing.description), wide: true },
              ],
            },
            {
              title: 'Yield',
              fields: [
                { label: 'Expected yield', value: viewing.expectedYield != null ? formatQty(viewing.expectedYield, viewing.yieldUnit) : detailValue(viewing.expectedYield) },
                { label: 'Yield unit', value: detailValue(viewing.yieldUnit) },
                { label: 'Ingredients', value: formatNumber(viewing.ingredients?.length ?? 0) },
              ],
            },
            {
              title: 'Materials',
              fields: [
                {
                  label: 'Ingredient list',
                  wide: true,
                  value: viewing.ingredients?.length
                    ? viewing.ingredients
                        .map((ing) => `${ing.material.name} (${ing.isPercentage ? `${formatNumber(ing.quantity)}%` : formatQty(ing.quantity, ing.unitOfMeasure)})`)
                        .join(' · ')
                    : '—',
                },
              ],
            },
          ]}
        />
      )}
    </div>
  );
}
