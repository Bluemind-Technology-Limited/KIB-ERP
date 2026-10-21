import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, PauseCircle, Send, XCircle } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Modal } from '../../../components/ui/Modal';

interface SupplierInfo {
  id: string;
  name: string;
  email?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  address?: string | null;
  vendorCode?: string | null;
}

interface PreviewItem {
  id: string;
  materialId: string;
  materialName: string;
  sku: string;
  unitOfMeasure: string;
  quantity: number;
  receivedQty: number;
  unitCost: number;
  standardCost: number;
  supplierId: string;
  supplierName?: string | null;
  suppliers: SupplierInfo[];
  onHold: boolean;
  holdReason?: string | null;
  lpoNumber?: string | null;
  lpoSentAt?: string | null;
  lpoSent: boolean;
  fullyReceived: boolean;
  eligible: boolean;
}

interface PreviewResponse {
  purchaseOrder: {
    id: string;
    number: string;
    status: string;
    notes?: string | null;
    expectedDelivery?: string | null;
    sentAt?: string | null;
    supplier?: { id: string; name: string } | null;
    requisition?: { id: string; number: string } | null;
  };
  items: PreviewItem[];
  summary: { total: number; sent: number; onHold: number; received: number; eligible: number };
}

interface LpoResult {
  supplierId: string;
  supplierName: string;
  email: string;
  lpoNumber: string;
  itemCount: number;
  success: boolean;
  error?: string;
}

interface SendResponse {
  purchaseOrder: { id: string; number: string; status: string };
  lpoResults: LpoResult[];
  allSent: boolean;
  remaining: number;
}

const money = (value: number) =>
  `NGN ${new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)}`;

interface LpoSendModalProps {
  poId: string;
  onClose: () => void;
  onSent: () => void;
}

/**
 * Generates LPOs for the selected lines of a purchase order.
 *
 * Only lines that have not already travelled on an LPO, are not on hold and
 * are not fully received are offered. Sending leaves the rest on the order, so
 * the same PO can be sent to suppliers in several rounds.
 */
export default function LpoSendModal({ poId, onClose, onSent }: LpoSendModalProps) {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [unitCosts, setUnitCosts] = useState<Record<string, string>>({});
  const [results, setResults] = useState<LpoResult[] | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setResults(null);
    axiosClient
      .get<PreviewResponse>(`/procurement/purchase-orders/${poId}/lpo/preview`)
      .then((res) => {
        if (!active) return;
        setPreview(res.data);
        setSelected(
          Object.fromEntries(res.data.items.map((item) => [item.id, item.eligible]))
        );
        setSelections(
          Object.fromEntries(res.data.items.map((item) => [item.id, item.supplierId || '']))
        );
        setUnitCosts(
          Object.fromEntries(res.data.items.map((item) => [item.id, String(item.unitCost ?? 0)]))
        );
      })
      .catch((err: any) => {
        if (active) setError(err?.response?.data?.error || 'Failed to prepare the LPO preview.');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [poId]);

  const eligibleItems = useMemo(
    () => (preview ? preview.items.filter((item) => item.eligible) : []),
    [preview]
  );
  const selectedItems = useMemo(
    () => eligibleItems.filter((item) => selected[item.id]),
    [eligibleItems, selected]
  );

  const groups = useMemo(() => {
    const map = new Map<
      string,
      { supplier: SupplierInfo; items: Array<PreviewItem & { unitCost: number }>; total: number }
    >();

    for (const item of selectedItems) {
      const supplierId = selections[item.id] || item.supplierId;
      const supplier = item.suppliers.find((s) => s.id === supplierId);
      if (!supplier) continue;

      const unitCost = Number(unitCosts[item.id] || 0);
      const group = map.get(supplier.id) ?? { supplier, items: [], total: 0 };
      group.items.push({ ...item, unitCost });
      group.total += item.quantity * unitCost;
      map.set(supplier.id, group);
    }

    return [...map.values()];
  }, [selectedItems, selections, unitCosts]);

  const issues = useMemo(() => {
    const list: string[] = [];

    for (const item of selectedItems) {
      const supplierId = selections[item.id] || item.supplierId;
      if (item.suppliers.length === 0) {
        list.push(`${item.materialName} has no supplier linked in Master Data.`);
        continue;
      }
      const supplier = item.suppliers.find((s) => s.id === supplierId);
      if (!supplier) {
        list.push(`Choose a supplier for ${item.materialName}.`);
        continue;
      }
      if (!supplier.email?.trim()) {
        list.push(`${supplier.name} has no email address. Add it in Master Data → Suppliers.`);
      }
      const cost = Number(unitCosts[item.id]);
      if (!Number.isFinite(cost) || cost < 0) {
        list.push(`Enter a valid unit cost for ${item.materialName}.`);
      }
    }

    return list;
  }, [selectedItems, selections, unitCosts]);

  const canSend = Boolean(preview) && selectedItems.length > 0 && groups.length > 0 && issues.length === 0 && !sending;

  const toggleAll = (next: boolean) => {
    setSelected(Object.fromEntries(eligibleItems.map((item) => [item.id, next])));
  };

  const send = async () => {
    if (!preview || !canSend) return;
    setSending(true);
    setError('');
    setResults(null);
    try {
      const res = await axiosClient.post<SendResponse>(
        `/procurement/purchase-orders/${poId}/lpo/send`,
        {
          itemIds: selectedItems.map((item) => item.id),
          selections: Object.fromEntries(
            selectedItems.map((item) => [item.id, selections[item.id] || item.supplierId])
          ),
          unitCosts: Object.fromEntries(
            selectedItems.map((item) => [item.id, Number(unitCosts[item.id] || 0)])
          ),
        },
        { toast: false }
      );

      setResults(res.data.lpoResults);
    } catch (err: any) {
      const data = err?.response?.data;
      setError(
        Array.isArray(data?.issues) && data.issues.length
          ? data.issues.join(' ')
          : data?.error || 'Failed to send the LPOs.'
      );
    } finally {
      setSending(false);
    }
  };

  const itemState = (item: PreviewItem) => {
    if (item.lpoSent) {
      return { label: item.lpoNumber ?? 'Sent', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    if (item.onHold) {
      return { label: 'On hold', className: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    if (item.fullyReceived) {
      return { label: 'Received', className: 'bg-slate-100 text-slate-500 border-slate-200' };
    }
    return null;
  };

  return (
    <Modal onClose={sending ? () => {} : onClose}>
      <div className="bg-white rounded-xl w-full max-w-3xl p-5 space-y-4 max-h-[88vh] overflow-y-auto overscroll-contain">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#171717]">Generate &amp; Send LPOs</h3>
            <p className="text-[10px] text-slate-400 mt-1">
              {preview
                ? `${preview.purchaseOrder.number}${
                    preview.purchaseOrder.requisition ? ` · from ${preview.purchaseOrder.requisition.number}` : ''
                  } · ${preview.summary.eligible} line(s) ready${preview.summary.sent ? ` · ${preview.summary.sent} already sent` : ''}${
                    preview.summary.onHold ? ` · ${preview.summary.onHold} on hold` : ''
                  }`
                : 'Preparing supplier split…'}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={sending} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-600 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : preview ? (
          <>
            {eligibleItems.length > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Order lines · {preview.items.length}
                </p>
                <div className="flex items-center gap-2 text-[10px]">
                  <button type="button" onClick={() => toggleAll(true)} className="text-sky-600 font-semibold hover:underline">Select all</button>
                  <span className="text-slate-300">·</span>
                  <button type="button" onClick={() => toggleAll(false)} className="text-slate-500 font-semibold hover:underline">Clear</button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {preview.items.map((item) => {
                const state = itemState(item);
                const selectedSupplierId = selections[item.id] || item.supplierId;
                const selectedSupplier = item.suppliers.find((s) => s.id === selectedSupplierId);
                const unitCost = Number(unitCosts[item.id] || 0);
                const checked = item.eligible && Boolean(selected[item.id]);

                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border p-3 space-y-2 ${
                      checked ? 'border-sky-200 bg-sky-50/30' : 'border-slate-200 bg-slate-50/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <label className="flex items-start gap-2 min-w-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!item.eligible}
                          onChange={(e) => setSelected((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                          className="mt-0.5 w-3.5 h-3.5 accent-[#EA4335] disabled:opacity-40"
                        />
                        <span className="min-w-0">
                          <span className="text-xs font-bold text-[#171717] truncate block" title={item.materialName}>
                            {item.materialName}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400 block">{item.sku}</span>
                        </span>
                      </label>
                      <div className="text-right shrink-0 space-y-1">
                        <p className="text-xs font-semibold text-[#171717] whitespace-nowrap">
                          {item.quantity} {item.unitOfMeasure}
                        </p>
                        {state ? (
                          <span className={`inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${state.className}`}>
                            {item.onHold && <PauseCircle className="w-2.5 h-2.5" />}
                            {state.label}
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-400">
                            {item.receivedQty > 0 ? `${item.receivedQty} received` : 'ready'}
                          </span>
                        )}
                      </div>
                    </div>

                    {item.onHold && item.holdReason && (
                      <p className="text-[9px] text-amber-700">Hold reason: {item.holdReason}</p>
                    )}

                    {checked && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Supplier</label>
                          {item.suppliers.length === 0 ? (
                            <p className="text-[10px] text-amber-600">No supplier linked.</p>
                          ) : item.suppliers.length === 1 ? (
                            <p className="text-[11px] text-slate-600">
                              {item.suppliers[0].name}
                              {item.suppliers[0].email ? ` · ${item.suppliers[0].email}` : ' · no email'}
                            </p>
                          ) : (
                            <select
                              value={selectedSupplierId}
                              onChange={(e) =>
                                setSelections((prev) => ({ ...prev, [item.id]: e.target.value }))
                              }
                              className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                            >
                              <option value="">Which supplier…</option>
                              {item.suppliers.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          )}
                          {selectedSupplier && !selectedSupplier.email?.trim() && (
                            <p className="text-[9px] text-amber-600">This supplier has no email address.</p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Unit Cost</label>
                            <input
                              value={unitCosts[item.id] ?? ''}
                              onChange={(e) =>
                                setUnitCosts((prev) => ({ ...prev, [item.id]: e.target.value }))
                              }
                              type="number"
                              min="0"
                              step="any"
                              className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Amount</label>
                            <p className="h-9 flex items-center text-[11px] font-semibold text-[#171717]">
                              {money(item.quantity * unitCost)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Supplier split summary */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Supplier split · {groups.length} LPO{groups.length === 1 ? '' : 's'}
              </p>
              {groups.length === 0 ? (
                <p className="text-[11px] text-amber-600">Select at least one line to build the LPOs.</p>
              ) : (
                groups.map((group) => (
                  <div key={group.supplier.id} className="rounded-lg border border-slate-200 px-3 py-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold text-[#171717]">{group.supplier.name}</p>
                      <p className="text-[9px] text-slate-400">
                        {group.items.length} item(s) · {group.supplier.email || 'no email'}
                      </p>
                      <p className="text-[9px] text-slate-500 mt-1">
                        {group.items.map((i) => `${i.materialName} × ${i.quantity}${i.unitOfMeasure}`).join(' · ')}
                      </p>
                    </div>
                    <p className="text-[11px] font-semibold text-[#171717] whitespace-nowrap">{money(group.total)}</p>
                  </div>
                ))
              )}
            </div>

            {issues.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-700 space-y-1">
                {issues.map((issue) => (
                  <p key={issue} className="flex items-start gap-1.5">
                    <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{issue}</span>
                  </p>
                ))}
              </div>
            )}

            {results && (
              <div
                className={`rounded-lg border px-3 py-2 text-[11px] ${
                  results.every((r) => r.success)
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-rose-200 bg-rose-50 text-rose-600'
                }`}
              >
                {results.every((r) => r.success)
                  ? `All ${results.length} LPO${results.length === 1 ? '' : 's'} emailed successfully.`
                  : 'Some LPOs were not sent. Fix the issue and retry.'}
              </div>
            )}

            {results && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Send results</p>
                {results.map((result) => (
                  <div key={result.lpoNumber} className="flex items-start gap-2 text-[10px]">
                    {result.success ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="w-3 h-3 text-rose-600 mt-0.5 shrink-0" />
                    )}
                    <span className={result.success ? 'text-slate-600' : 'text-rose-600'}>
                      <strong>{result.supplierName}</strong> · {result.lpoNumber} · {result.itemCount} item(s)
                      {result.error ? ` — ${result.error}` : ' — emailed'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  if (results) onSent();
                  else onClose();
                }}
                disabled={sending}
                className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {results ? 'Done' : 'Cancel'}
              </button>
              {!results && (
                <button
                  type="button"
                  onClick={send}
                  disabled={!canSend}
                  className="btn-3d px-4 h-9 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
                    {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    {sending
                      ? 'Sending…'
                      : `Send ${groups.length} LPO${groups.length === 1 ? '' : 's'}`}
                  </span>
                </button>
              )}
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
