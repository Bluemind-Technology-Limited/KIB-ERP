import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Send, XCircle } from 'lucide-react';
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
  materialId: string;
  materialName: string;
  sku: string;
  unitOfMeasure: string;
  quantity: number;
  standardCost: number;
  suppliers: SupplierInfo[];
  defaultSupplierId: string;
}

interface PreviewResponse {
  requisition: {
    id: string;
    number: string;
    notes?: string | null;
    requestedBy?: string | null;
    existingPOs?: Array<{ id: string; number: string; status: string }>;
  };
  items: PreviewItem[];
}

interface GroupItem extends PreviewItem {
  unitCost: number;
}

interface SupplierGroup {
  supplier: SupplierInfo;
  items: GroupItem[];
  total: number;
}

interface LpoResult {
  supplierId: string;
  supplierName: string;
  email: string;
  lpoNumber: string;
  success: boolean;
  error?: string;
}

interface SendResponse {
  purchaseOrder: { id: string; number: string; status: string };
  lpoResults: LpoResult[];
  allSent: boolean;
}

const money = (value: number) =>
  `NGN ${new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)}`;

interface LpoSendModalProps {
  requisitionId: string;
  onClose: () => void;
  onSent: () => void;
}

export default function LpoSendModal({ requisitionId, onClose, onSent }: LpoSendModalProps) {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [unitCosts, setUnitCosts] = useState<Record<string, string>>({});
  const [results, setResults] = useState<LpoResult[] | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    axiosClient
      .get<PreviewResponse>(`/procurement/requisitions/${requisitionId}/lpo/preview`)
      .then((res) => {
        if (!active) return;
        setPreview(res.data);
        setSelections(
          Object.fromEntries(
            res.data.items.map((item) => [item.materialId, item.defaultSupplierId || ''])
          )
        );
        setUnitCosts(
          Object.fromEntries(
            res.data.items.map((item) => [item.materialId, String(item.standardCost ?? 0)])
          )
        );
      })
      .catch((err: any) => {
        if (active) {
          setError(err?.response?.data?.error || 'Failed to prepare the LPO preview.');
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [requisitionId]);

  const groups: SupplierGroup[] = useMemo(() => {
    if (!preview) return [];
    const map = new Map<string, SupplierGroup>();

    for (const item of preview.items) {
      const supplierId = selections[item.materialId];
      const supplier = item.suppliers.find((s) => s.id === supplierId);
      if (!supplierId || !supplier) continue;

      const unitCost = Number(unitCosts[item.materialId] || 0);
      const group = map.get(supplierId) ?? { supplier, items: [], total: 0 };
      group.items.push({ ...item, unitCost });
      group.total += item.quantity * unitCost;
      map.set(supplierId, group);
    }

    return [...map.values()];
  }, [preview, selections, unitCosts]);

  const issues = useMemo(() => {
    const list: string[] = [];
    if (!preview) return list;

    for (const item of preview.items) {
      const supplierId = selections[item.materialId];
      if (item.suppliers.length === 0) {
        list.push(`${item.materialName} has no supplier linked in Master Data.`);
        continue;
      }
      if (!supplierId) {
        list.push(`Choose a supplier for ${item.materialName}.`);
        continue;
      }
      const supplier = item.suppliers.find((s) => s.id === supplierId);
      if (!supplier) {
        list.push(`The selected supplier is not linked to ${item.materialName}.`);
        continue;
      }
      if (!supplier.email?.trim()) {
        list.push(`${supplier.name} has no email address. Add it in Master Data → Suppliers.`);
      }
      const cost = Number(unitCosts[item.materialId]);
      if (!Number.isFinite(cost) || cost < 0) {
        list.push(`Enter a valid unit cost for ${item.materialName}.`);
      }
    }

    return list;
  }, [preview, selections, unitCosts]);

  const canSend = Boolean(preview) && groups.length > 0 && issues.length === 0 && !sending;

  const send = async () => {
    if (!preview || !canSend) return;
    setSending(true);
    setError('');
    setResults(null);
    try {
      const res = await axiosClient.post<SendResponse>(
        `/procurement/requisitions/${requisitionId}/lpo/send`,
        {
          selections,
          unitCosts: Object.fromEntries(
            preview.items.map((item) => [
              item.materialId,
              Number(unitCosts[item.materialId] || 0),
            ])
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

  return (
    <Modal onClose={sending ? () => {} : onClose}>
      <div className="bg-white rounded-xl w-full max-w-3xl p-5 space-y-4 max-h-[88vh] overflow-y-auto overscroll-contain">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#171717]">Generate &amp; Send LPOs</h3>
            <p className="text-[10px] text-slate-400 mt-1">
              {preview
                ? `${preview.requisition.number}${preview.requisition.requestedBy ? ` · requested by ${preview.requisition.requestedBy}` : ''}`
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
            <div className="space-y-2">
              {preview.items.map((item) => {
                const selectedSupplierId = selections[item.materialId];
                const selectedSupplier = item.suppliers.find((s) => s.id === selectedSupplierId);
                const unitCost = Number(unitCosts[item.materialId] || 0);

                return (
                  <div key={item.materialId} className="rounded-lg border border-slate-200 bg-slate-50/40 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-[#171717]">{item.materialName}</p>
                        <p className="text-[9px] font-mono text-slate-400">{item.sku}</p>
                      </div>
                      <p className="text-xs font-semibold text-[#171717] whitespace-nowrap">
                        {item.quantity} {item.unitOfMeasure}
                      </p>
                    </div>

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
                              setSelections((prev) => ({ ...prev, [item.materialId]: e.target.value }))
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
                            value={unitCosts[item.materialId] ?? ''}
                            onChange={(e) =>
                              setUnitCosts((prev) => ({ ...prev, [item.materialId]: e.target.value }))
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
                <p className="text-[11px] text-amber-600">Assign a supplier to each item to build the LPOs.</p>
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
                  <div key={result.supplierId} className="flex items-start gap-2 text-[10px]">
                    {result.success ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="w-3 h-3 text-rose-600 mt-0.5 shrink-0" />
                    )}
                    <span className={result.success ? 'text-slate-600' : 'text-rose-600'}>
                      <strong>{result.supplierName}</strong> · {result.lpoNumber}
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
                  if (results?.every((r) => r.success)) onSent();
                  else onClose();
                }}
                disabled={sending}
                className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {results ? 'Close' : 'Cancel'}
              </button>
              {!results?.every((r) => r.success) && (
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
