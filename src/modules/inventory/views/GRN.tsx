import { Fragment, useEffect, useState } from 'react';
import { PackageCheck, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { DetailsModal, ViewButton, detailDate, detailValue } from '../../../components/ui/DetailsModal';
import { PageDescription } from '../../../components/ui/PageDescription';
import { PackQuantityPreview } from '../../../components/ui/PackQuantityPreview';
import { formatNumber, formatQty } from '../../../lib/format';

interface GrnData {
  id: string;
  number: string;
  status: string;
  receivedAt: string;
  source?: 'PURCHASE_ORDER' | 'CONSIGNMENT' | 'DIRECT';
  po: { number: string; supplier: { name: string } } | null;
  consignment?: { consignmentNumber: string } | null;
  supplier?: { name: string } | null;
  receivedBy: { fullName: string } | null;
  notes?: string | null;
  items: any[];
}

const sourceBadge: Record<string, string> = {
  PURCHASE_ORDER: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30',
  CONSIGNMENT: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/30',
  DIRECT: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
};
const sourceLabel: Record<string, string> = {
  PURCHASE_ORDER: 'PO',
  CONSIGNMENT: 'Consignment',
  DIRECT: 'Direct',
};

const grnStatusBadge: Record<string, string> = {
  PENDING_QA: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
  REJECTED: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
};

const batchStatusBadge: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
  QUARANTINE: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
  REJECTED: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
  EXPIRED: 'bg-surface-3 text-ink-muted border-line',
};

/** SOP KIB/QCA/010 — what still has to be filled in before a lot code can be built. */
const MISSING_LABELS: Record<string, string> = {
  vendorCode: 'a vendor code on the supplier',
  ingredientCode: 'a traceability code on the material',
  setNumber: 'a set number',
  yearCode: 'the year',
};

interface GrnLine {
  materialId: string;
  materialName: string;
  /** PO line this receipt line fulfils (PO mode). */
  poItemId?: string;
  /** PO line balance, shown so the officer can see what is still owed. */
  orderedQty?: number;
  alreadyReceived?: number;
  /** false = this line did not arrive and stays outstanding on the PO. */
  delivered?: boolean;
  quantity: string;
  unitCost: string;
  unitOfMeasure: string;
  expiryDate: string;
  warehouseId: string;
  setNumber: string;
}

interface LotPreviewItem {
  materialId: string;
  materialName: string;
  materialSku: string;
  supplierName?: string | null;
  setNumber: number;
  lotCode: string | null;
  missing: string[];
}

const emptyLine = (): GrnLine => ({
  materialId: '', materialName: '', quantity: '', unitCost: '0', unitOfMeasure: '',
  expiryDate: '', warehouseId: '', setNumber: '',
});

/** Descriptive identifier shown above every form field. */
function FieldLabel({ children, hint }: { children: string; hint?: string }) {
  return (
    <div className="space-y-0.5">
      <label className="block text-[9px] font-bold uppercase tracking-wider text-ink-faint">
        {children}
      </label>
      {hint && <p className="text-[9px] leading-snug text-ink-faint">{hint}</p>}
    </div>
  );
}

export default function GRN({ searchQuery = '' }: { searchQuery?: string }) {
  const [grns, setGrns] = useState<GrnData[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<'PO' | 'DIRECT'>('PO');
  const [poId, setPoId] = useState('');
  const [grnNotes, setGrnNotes] = useState('');
  const [receivedOn, setReceivedOn] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<GrnLine[]>([emptyLine()]);
  const [lotPreviews, setLotPreviews] = useState<Record<string, LotPreviewItem>>({});
  const [supplierName, setSupplierName] = useState('');
  const [submitConfirmation, setSubmitConfirmation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ grnId: string; grnNumber: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  /** Receipts are listed under the day they were received; groups can collapse. */
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

  // view details modal
  const [viewing, setViewing] = useState<GrnData | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [grnRes, poRes, whRes, matRes] = await Promise.all([
        axiosClient.get<{ grns: GrnData[] }>('/grn'),
        axiosClient.get<{ purchaseOrders: any[] }>('/procurement/purchase-orders'),
        axiosClient.get<{ warehouses: any[] }>('/master-data/warehouses'),
        axiosClient.get<{ materials: any[] }>('/master-data/materials'),
      ]);
      setGrns(grnRes.data.grns);
      setPos(poRes.data.purchaseOrders);
      setWarehouses(whRes.data.warehouses);
      setMaterials(matRes.data.materials.filter((m) => m.type !== 'FINISHED'));
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load GRN data. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const selectPo = async (id: string) => {
    setPoId(id);
    setLotPreviews({});
    setSupplierName('');

    if (!id) {
      setLines([emptyLine()]);
      return;
    }

    const po = pos.find((p) => p.id === id);
    setSupplierName(po?.supplier?.name ?? '');

    const base: GrnLine[] = (po?.items ?? [])
      .map((i: any) => ({
        ...emptyLine(),
        materialId: i.materialId,
        poItemId: i.id,
        materialName: i.material?.name ?? '',
        orderedQty: Number(i.quantity),
        alreadyReceived: Number(i.receivedQty || 0),
        delivered: true,
        quantity: String(Number(i.quantity) - Number(i.receivedQty || 0)),
        unitOfMeasure: i.unitOfMeasure,
      }))
      // Only what is still outstanding can be delivered now.
      .filter((line: GrnLine) => Number(line.quantity) > 0);

    if (base.length === 0) {
      setLines([emptyLine()]);
      setError(`${po?.number ?? 'This purchase order'} is fully received — there is nothing left to deliver.`);
      return;
    }
    setLines(base);

    // Lot codes come from the server so the UI never reimplements the format.
    try {
      const res = await axiosClient.get<{ items: LotPreviewItem[] }>('/grn/lot-preview', {
        params: { poId: id },
      });
      const map: Record<string, LotPreviewItem> = {};
      for (const item of res.data.items) map[item.materialId] = item;
      setLotPreviews(map);
      setLines(
        base.map((l) => ({
          ...l,
          setNumber: map[l.materialId] ? String(map[l.materialId].setNumber) : '',
        }))
      );
    } catch {
      // Leave the preview blank — the server still builds the code on submit.
    }
  };

  /** Switch between PO-backed and contingency (direct) receipts. */
  const switchMode = (next: 'PO' | 'DIRECT') => {
    setMode(next);
    setPoId('');
    setSupplierName('');
    setLines([emptyLine()]);
    setLotPreviews({});
    setGrnNotes('');
    setReceivedOn(new Date().toISOString().slice(0, 10));
  };

  /**
   * The supplier is never picked by hand — the server resolves it from the
   * material's supplier links.
   */
  const fetchDirectPreview = async (materialId: string) => {
    if (!materialId) return;
    try {
      const res = await axiosClient.get<any>('/grn/lot-preview', {
        params: { materialId },
      });
      const d = res.data;
      if (!d?.material) return;
      setLotPreviews((prev) => ({
        ...prev,
        [materialId]: {
          materialId: d.material.id,
          materialName: d.material.name,
          materialSku: d.material.sku,
          supplierName: d.supplier?.name ?? null,
          setNumber: d.setNumber,
          lotCode: d.lotCode,
          missing: d.missing ?? [],
        },
      }));
    } catch {
      // Leave the preview blank — the server still builds the code on submit.
    }
  };

  const onDirectMaterialChange = async (idx: number, materialId: string) => {
    const material = materials.find((m) => m.id === materialId);
    setLines((prev) =>
      prev.map((line, i) =>
        i === idx
          ? {
              ...line,
              materialId,
              materialName: material?.name ?? '',
              unitOfMeasure: material?.unitOfMeasure ?? '',
              setNumber: '',
            }
          : line
      )
    );
    if (materialId) await fetchDirectPreview(materialId);
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  /** A line is postable when it actually arrived, has a quantity and a
   *  warehouse. QA can correct the set number after inspection.
   *  Lines left unticked (not delivered) stay outstanding on the PO. */
  const lineIsComplete = (l: GrnLine) =>
    Boolean(l.delivered !== false && l.materialId && l.quantity && l.warehouseId);

  const buildItems = () =>
    lines.filter(lineIsComplete).map((l) => ({
      materialId: l.materialId,
      poItemId: mode === 'PO' ? l.poItemId : undefined,
      quantity: Number(l.quantity),
      unitOfMeasure: l.unitOfMeasure,
      expiryDate: l.expiryDate || undefined,
      warehouseId: l.warehouseId,
      unitCost: mode === 'DIRECT' ? Number(l.unitCost || 0) : undefined,
    }));

  const receive = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (mode === 'PO' && !poId) { setFormError('Select a purchase order first'); return; }
    if (mode === 'DIRECT' && !grnNotes.trim()) {
      setFormError('Enter a reason for the direct receipt');
      return;
    }
    if (buildItems().length === 0) { setFormError('Mark at least one line as delivered, with a quantity and warehouse'); return; }
    setSubmitConfirmation(true);
  };

  const confirmReceive = async () => {
    setSaving(true);
    try {
      const body =
        mode === 'DIRECT'
          ? {
              source: 'DIRECT',
              notes: grnNotes,
              receivedAt: receivedOn || undefined,
              items: buildItems(),
            }
          : { poId, notes: grnNotes, receivedAt: receivedOn || undefined, items: buildItems() };

      await axiosClient.post('/grn', body, {
        toast: {
          success:
            mode === 'DIRECT'
              ? 'Direct receipt posted to stock'
              : 'Goods received and posted to stock',
        },
      });

      setShowForm(false);
      setPoId(''); setGrnNotes(''); setLines([emptyLine()]); setLotPreviews({}); setSupplierName('');
      setMode('PO');
      setReceivedOn(new Date().toISOString().slice(0, 10));
      setSubmitConfirmation(false);
      setFormError('');
      load();
    } catch (err: any) { setFormError(err?.response?.data?.error || 'Receive failed'); setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteConfirmation) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await axiosClient.delete(`/grn/${deleteConfirmation.grnId}`);
      setDeleteConfirmation(null);
      setDeleteError('');
      setError('');
      load();
    } catch (err: any) {
      setDeleteError(err?.response?.data?.error || 'Failed to delete GRN');
    } finally {
      setDeleting(false);
    }
  };

  const q = searchQuery.toLowerCase();
  const filtered = grns.filter(
    (g) =>
      g.number.toLowerCase().includes(q) ||
      (g.supplier?.name ?? g.po?.supplier?.name ?? '').toLowerCase().includes(q) ||
      (g.po?.number ?? g.consignment?.consignmentNumber ?? '').toLowerCase().includes(q) ||
      (g.items ?? []).some((it: any) =>
        `${it.material?.name ?? ''} ${it.batchLot?.batchNumber ?? ''}`.toLowerCase().includes(q)
      )
  );

  // Receipts are rendered under the day they were received — one date per
  // delivery, so each visit to a partly delivered PO sits in its own group.
  const groupedByDate = (() => {
    const groups = new Map<string, GrnData[]>();
    for (const g of filtered) {
      const date = new Date(g.receivedAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const list = groups.get(key);
      if (list) list.push(g);
      else groups.set(key, [g]);
    }
    return [...groups.entries()].map(([key, rows]) => ({
      key,
      label: new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      lines: rows.reduce((sum, r) => sum + (r.items?.length ?? 0), 0),
      rows,
    }));
  })();

  const activeSupplierName =
    mode === 'DIRECT' ? '' : supplierName;

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-ink">Goods Receipt (GRN)</h2>
          <PageDescription>Receive goods against a PO, or record a direct contingency receipt.</PageDescription>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowForm(!showForm)} className="btn-3d px-4 h-9">
            <span className="flex items-center gap-1.5 text-white text-xs font-semibold"><Plus className="w-3.5 h-3.5" /> Receive Goods</span>
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>}

      {/* 3. GRN table */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        {loading ? (
          <TableSkeleton cols={6} rows={6} hasAvatar={false} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No goods receipts yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint">
                  <th className="px-4 py-3 font-semibold">GRN</th>
                  <th className="px-4 py-3 font-semibold">Supplier / Reference</th>
                  <th className="px-4 py-3 font-semibold">Items</th>
                  <th className="px-4 py-3 font-semibold">Received By</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupedByDate.map((group) => {
                  const collapsed = !!collapsedDates[group.key];
                  return (
                    <Fragment key={group.key}>
                      <tr className="bg-surface-2/80 border-y border-line">
                        <td colSpan={6} className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsedDates((prev) => ({ ...prev, [group.key]: !prev[group.key] }))
                            }
                            className="w-full flex items-center justify-between text-left"
                          >
                            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                              {collapsed ? (
                                <ChevronRight className="w-3 h-3 text-ink-faint" />
                              ) : (
                                <ChevronDown className="w-3 h-3 text-ink-faint" />
                              )}
                              {group.label}
                            </span>
                            <span className="text-[10px] text-ink-faint">
                              {group.rows.length} receipt(s) · {group.lines} line(s)
                            </span>
                          </button>
                        </td>
                      </tr>
                      {!collapsed &&
                        group.rows.map((g) => {
                  const items = g.items ?? [];
                  const first = items[0];
                  const supplierName = g.supplier?.name ?? g.po?.supplier?.name ?? '—';
                  const reference = g.po?.number ?? g.consignment?.consignmentNumber ?? 'Direct receipt';
                  const firstLabel = first
                    ? `${first.material?.name ?? 'Material'} × ${formatQty(first.quantity, first.unitOfMeasure)}`
                    : '—';
                  const itemTitle = items
                    .map((it: any) => `${it.material?.name ?? 'Material'} × ${formatQty(it.quantity, it.unitOfMeasure)}`)
                    .join('\n');

                  return (
                    <tr key={g.id} className="border-b border-line last:border-0 hover:bg-surface-2/50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-ink">{g.number}</span>
                        <span
                          className={`ml-2 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${sourceBadge[g.source ?? 'PURCHASE_ORDER']}`}
                        >
                          {sourceLabel[g.source ?? 'PURCHASE_ORDER']}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-ink-muted truncate max-w-[170px]" title={supplierName}>
                          {supplierName}
                        </p>
                        <p className="text-[10px] text-ink-faint font-mono truncate max-w-[170px]" title={reference}>
                          {reference}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[11px] text-ink-muted truncate max-w-[200px]" title={itemTitle}>
                          {firstLabel}
                          {items.length > 1 && <span className="text-ink-faint"> +{items.length - 1} more</span>}
                        </p>
                        <p className="text-[10px] text-ink-faint">{items.length} line(s)</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-[11px] text-ink-muted truncate max-w-[130px]" title={g.receivedBy?.fullName ?? undefined}>
                          {g.receivedBy?.fullName ?? '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${grnStatusBadge[g.status] || grnStatusBadge.PENDING_QA}`}
                        >
                          {g.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <ViewButton onClick={() => setViewing(g)} />
                          <button
                            onClick={() => {
                              setDeleteError('');
                              setDeleteConfirmation({ grnId: g.id, grnNumber: g.number });
                            }}
                            className="text-ink-faint hover:text-rose-600 transition-colors p-1.5 dark:hover:text-rose-300"
                            title="Delete GRN"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                        })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Receive Goods modal */}
      {showForm && (
        <Modal onClose={() => setShowForm(false)}>
          <form onSubmit={receive} className="bg-surface rounded-xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-ink">
                <PackageCheck className="w-4 h-4 text-[#EA4335]" />
                <h3 className="text-sm font-bold">Receive Goods</h3>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="text-ink-faint hover:text-ink-muted">✕</button>
            </div>

            {formError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                {formError}
              </div>
            )}

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => switchMode('PO')}
                  className={`h-9 rounded-lg border text-xs font-semibold ${
                    mode === 'PO'
                      ? 'border-[#EA4335] bg-[#EA4335]/10 text-[#EA4335]'
                      : 'border-line text-ink-muted hover:bg-surface-2'
                  }`}
                >
                  Against PO
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('DIRECT')}
                  className={`h-9 rounded-lg border text-xs font-semibold ${
                    mode === 'DIRECT'
                      ? 'border-[#EA4335] bg-[#EA4335]/10 text-[#EA4335]'
                      : 'border-line text-ink-muted hover:bg-surface-2'
                  }`}
                >
                  Direct Receipt
                </button>
              </div>

              <div className="space-y-1">
                <label className="block text-[9px] font-bold uppercase tracking-wider text-ink-faint">Received On *</label>
                <input
                  type="date"
                  value={receivedOn}
                  onChange={(e) => setReceivedOn(e.target.value)}
                  className="h-9 w-full rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                />
                <p className="text-[9px] text-ink-faint">Date the goods physically arrived at the warehouse.</p>
              </div>

              {mode === 'PO' && (
              <div className="space-y-1">
                <FieldLabel hint="Only POs with an outstanding balance can be received.">
                  Purchase order *
                </FieldLabel>
                <select
                  value={poId}
                  onChange={(e) => selectPo(e.target.value)}
                  className="h-9 w-full rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                >
                  <option value="">Select purchase order…</option>
                  {pos
                    .filter(
                      (p) =>
                        p.status !== 'CLOSED' &&
                        (p.items ?? []).some(
                          (i: any) => Number(i.quantity) - Number(i.receivedQty || 0) > 0
                        )
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.number} — {p.supplier?.name} ({p.status})</option>
                    ))}
                </select>
              </div>
            )}

              <div className="space-y-1">
                <FieldLabel hint={mode === 'DIRECT' ? 'Required for a contingency receipt.' : 'Optional receiving notes.'}>
                  {mode === 'DIRECT' ? 'Reason for direct receipt *' : 'Notes'}
                </FieldLabel>
                <textarea
                  value={grnNotes}
                  onChange={(e) => setGrnNotes(e.target.value)}
                  placeholder={mode === 'DIRECT' ? 'Reason for direct receipt (required)' : 'Notes'}
                  rows={4}
                  className="w-full rounded-lg border border-line px-3 py-2 text-xs focus:outline-none focus:border-[#EA4335] resize-none"
                />
              </div>
            </div>

            {lines.map((line, idx) => {
              const preview = lotPreviews[line.materialId];
              return (
                <div key={idx} className={`space-y-2 rounded-lg border p-2 ${mode === 'PO' && line.delivered === false ? 'border-line bg-surface-2/60 opacity-60' : 'border-line'}`}>
                  {mode === 'PO' && (
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-[10px] font-bold text-ink-muted">
                        <input
                          type="checkbox"
                          checked={line.delivered !== false}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, delivered: e.target.checked } : l))
                            )
                          }
                          className="h-3.5 w-3.5 accent-[#EA4335]"
                        />
                        Delivered
                      </label>
                      <span className="text-[9px] text-ink-faint">
                        {formatNumber(line.alreadyReceived ?? 0)} of {formatNumber(line.orderedQty ?? 0)} already received
                        {Number(line.orderedQty ?? 0) - Number(line.alreadyReceived ?? 0) > 0 && (
                          <span className="text-amber-600 font-semibold dark:text-amber-300">
                            {' '}· {formatNumber(Number(line.orderedQty ?? 0) - Number(line.alreadyReceived ?? 0))} outstanding
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  {mode === 'DIRECT' && (
                    <div className="space-y-1">
                      <FieldLabel hint="Only materials with a traceability code can generate a lot code.">
                        Material *
                      </FieldLabel>
                      <select
                        value={line.materialId}
                        onChange={(e) => onDirectMaterialChange(idx, e.target.value)}
                        className="h-8 w-full rounded-lg border border-line bg-surface px-2 text-[11px] focus:outline-none focus:border-[#EA4335]"
                      >
                        <option value="">Select material…</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block truncate text-[11px] font-semibold text-ink-muted">
                        {preview?.materialName || line.materialName || 'Material'}
                      </span>
                      {preview?.materialSku && (
                        <span className="block text-[9px] font-mono text-ink-faint">{preview.materialSku}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {mode !== 'PO' && lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="text-ink-faint hover:text-rose-500 p-0.5"
                          title="Not received — remove this line"
                        >
                          ✕
                        </button>
                      )}
                      {mode === 'DIRECT' && preview?.supplierName && (
                        <span className="text-right text-[9px] text-ink-faint">{preview.supplierName}</span>
                      )}
                      {mode === 'PO' && activeSupplierName && (
                        <span className="text-right text-[9px] text-ink-faint">{activeSupplierName}</span>
                      )}
                    </div>
                  </div>

                  {/* Lot code — always shown beside the ingredient and supplier names it belongs to. */}
                  <div className="rounded-md border border-line bg-surface-2 px-2 py-1.5">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-ink-faint">Lot Code</span>
                    {preview?.lotCode ? (
                      <span className="block font-mono text-xs font-bold text-ink">{preview.lotCode}</span>
                    ) : (
                      <span className="block text-[10px] text-amber-600 dark:text-amber-300">
                        {preview?.missing?.length
                          ? `No lot code yet (${preview.missing.map((m) => MISSING_LABELS[m] ?? m).join(', ')}). QA can edit the set number during inspection.`
                          : mode === 'DIRECT'
                            ? 'Select a material to preview its lot code'
                            : 'Select a purchase order to generate a lot code'}
                      </span>
                    )}
                  </div>

                  <div className="rounded-md border border-line bg-surface-2 px-2 py-1.5">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-ink-faint">
                      Set number
                    </span>
                    <p className="text-[10px] leading-snug text-ink-muted">
                      Assigned by the system and approved by QA during inspection.
                    </p>
                    {preview?.setNumber != null && (
                      <p className="mt-0.5 font-mono text-[10px] text-ink-faint">
                        Suggested: {preview.setNumber}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <FieldLabel
                      hint={
                        mode === 'PO'
                          ? 'Locked to the outstanding PO quantity. QA can adjust it after receipt.'
                          : 'Enter the quantity physically received.'
                      }
                    >
                      Received quantity
                    </FieldLabel>
                    <input
                      value={line.quantity}
                      onChange={(e) => setLines(lines.map((l, i) => i === idx ? { ...l, quantity: e.target.value } : l))}
                      placeholder="Qty"
                      type="number"
                      min="0.0001"
                      step="any"
                      readOnly={mode === 'PO'}
                      aria-readonly={mode === 'PO'}
                      disabled={mode === 'PO' && line.delivered === false}
                      className={`h-8 w-full rounded-lg border border-line px-2 text-[11px] focus:outline-none ${
                        mode === 'PO' ? 'bg-surface-3 text-ink-muted' : 'focus:border-[#EA4335]'
                      } disabled:bg-slate-100`}
                    />
                    <PackQuantityPreview quantity={line.quantity} unit={line.unitOfMeasure} />
                  </div>
                  {mode === 'DIRECT' && (
                    <div className="space-y-1">
                      <FieldLabel hint="Cost per pack for this contingency receipt.">
                        Unit cost
                      </FieldLabel>
                      <input
                        value={line.unitCost}
                        onChange={(e) => setLines(lines.map((l, i) => i === idx ? { ...l, unitCost: e.target.value } : l))}
                        placeholder={`Cost per ${line.unitOfMeasure || 'unit'}`}
                        type="number"
                        min="0"
                        step="any"
                        className="h-8 w-full rounded-lg border border-line px-2 text-[11px] focus:outline-none focus:border-[#EA4335]"
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <FieldLabel hint="Drives expiry alerts and FIFO picking.">
                      Expiry date *
                    </FieldLabel>
                    <input
                      value={line.expiryDate}
                      onChange={(e) => setLines(lines.map((l, i) => i === idx ? { ...l, expiryDate: e.target.value } : l))}
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      disabled={mode === 'PO' && line.delivered === false}
                      className="h-8 w-full rounded-lg border border-line px-2 text-[11px] focus:outline-none focus:border-[#EA4335] disabled:bg-surface-3"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <FieldLabel hint="Stock is posted into this warehouse.">
                      Receive into warehouse *
                    </FieldLabel>
                    <select
                      value={line.warehouseId}
                      onChange={(e) => setLines(lines.map((l, i) => i === idx ? { ...l, warehouseId: e.target.value } : l))}
                      disabled={mode === 'PO' && line.delivered === false}
                      className="h-8 w-full rounded-lg border border-line px-2 text-[11px] focus:outline-none focus:border-[#EA4335] disabled:bg-surface-3"
                    >
                    <option value="">Warehouse…</option>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                </div>
              );
            })}

            {mode === 'DIRECT' && (
              <button
                type="button"
                onClick={addLine}
                className="w-full h-9 rounded-lg border-2 border-dashed border-line hover:border-[#EA4335]/50 hover:bg-rose-50/30 text-[11px] font-bold text-ink-faint hover:text-[#EA4335] transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            )}

            <div className="flex justify-between items-center">
              <button type="button" onClick={() => setShowForm(false)} className="h-9 px-4 rounded-lg border border-line text-xs font-semibold text-ink-muted">Cancel</button>
              <button type="submit" className="btn-3d px-4 h-9">
                <span className="flex items-center gap-1.5 text-white text-xs font-semibold whitespace-nowrap"><PackageCheck className="w-3.5 h-3.5" /> {mode === 'DIRECT' ? 'Post Direct Receipt' : 'Post Receipt + Ledger'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {submitConfirmation && (
        <ConfirmationModal
          type="submit"
          title="Post Receipt + Ledger"
          description="Post this goods receipt to update stock levels and create QA inspection records?"
          onConfirm={confirmReceive}
          onCancel={() => setSubmitConfirmation(false)}
          isLoading={saving}
          confirmText="Post Receipt"
          error={formError}
        />
      )}

      {deleteConfirmation && (
        <ConfirmationModal
          type="delete"
          title="Delete GRN"
          description={`Delete GRN ${deleteConfirmation.grnNumber}? This will remove all items and inspection records. This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => { setDeleteConfirmation(null); setDeleteError(''); }}
          isLoading={deleting}
          confirmText="Delete"
          error={deleteError}
        />
      )}

      {/* GRN details */}
      {viewing && (
        <DetailsModal
          title={viewing.number}
          subtitle={
            <>
              {sourceLabel[viewing.source ?? 'PURCHASE_ORDER']}
              {' · '}
              {viewing.po?.number ?? viewing.consignment?.consignmentNumber ?? 'Direct receipt'}
            </>
          }
          status={{
            label: viewing.status.replace(/_/g, ' '),
            className: grnStatusBadge[viewing.status] || grnStatusBadge.PENDING_QA,
          }}
          onClose={() => setViewing(null)}
          footer={
            <button
              type="button"
              onClick={() => setViewing(null)}
              className="h-8 px-4 rounded-lg border border-line text-[11px] font-semibold text-ink-muted hover:bg-surface-2"
            >
              Close
            </button>
          }
          sections={[
            {
              title: 'Receipt',
              fields: [
                { label: 'Supplier', value: detailValue(viewing.supplier?.name ?? viewing.po?.supplier?.name) },
                { label: 'Source', value: sourceLabel[viewing.source ?? 'PURCHASE_ORDER'] ?? 'Direct' },
                { label: 'Purchase order', value: detailValue(viewing.po?.number) },
                { label: 'Consignment', value: detailValue(viewing.consignment?.consignmentNumber) },
                { label: 'Received on', value: detailDate(viewing.receivedAt, true) },
                { label: 'Received by', value: detailValue(viewing.receivedBy?.fullName) },
                { label: 'Lines', value: `${viewing.items?.length ?? 0}` },
                { label: 'Status', value: viewing.status.replace(/_/g, ' ') },
              ],
            },
            {
              title: 'Items received',
              fields: [
                {
                  label: `Materials (${viewing.items?.length ?? 0})`,
                  wide: true,
                  value:
                    (viewing.items ?? []).length === 0 ? (
                      '—'
                    ) : (
                      <div className="overflow-hidden rounded-lg border border-line">
                        <table className="w-full text-left">
                          <thead className="bg-surface-2">
                            <tr className="text-[9px] uppercase tracking-wider text-ink-faint">
                              <th className="px-2.5 py-1.5 font-semibold">Material</th>
                              <th className="px-2.5 py-1.5 font-semibold">Batch</th>
                              <th className="px-2.5 py-1.5 font-semibold">Expiry</th>
                              <th className="px-2.5 py-1.5 font-semibold text-right">Qty</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(viewing.items ?? []).map((it: any) => (
                              <tr key={it.id} className="border-t border-line">
                                <td className="px-2.5 py-2">
                                  <p className="text-[11px] font-semibold text-ink truncate max-w-[180px]" title={it.material?.name ?? undefined}>
                                    {it.material?.name ?? 'Material'}
                                  </p>
                                  <p className="text-[9px] font-mono text-ink-faint">{it.material?.sku ?? ''}</p>
                                </td>
                                <td className="px-2.5 py-2">
                                  <p className="text-[10px] font-mono text-ink-muted">
                                    {it.batchLot?.batchNumber ?? '—'}
                                  </p>
                                  {it.batchLot?.status && (
                                    <span
                                      className={`inline-block mt-0.5 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${batchStatusBadge[it.batchLot.status] ?? batchStatusBadge.ACTIVE}`}
                                    >
                                      {it.batchLot.status}
                                    </span>
                                  )}
                                </td>
                                <td className="px-2.5 py-2 text-[10px] text-ink-muted whitespace-nowrap">
                                  {it.batchLot?.expiryDate ? detailDate(it.batchLot.expiryDate) : '—'}
                                </td>
                                <td className="px-2.5 py-2 text-right whitespace-nowrap">
                                  <span className="text-[11px] font-bold text-ink">{formatQty(it.quantity, it.unitOfMeasure)}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ),
                },
              ],
            },
            {
              title: 'Notes',
              fields: [
                { label: 'Notes', wide: true, value: detailValue(viewing.notes) },
              ],
            },
          ]}
        />
      )}
    </div>
  );
}
