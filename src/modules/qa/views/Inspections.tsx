import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Paperclip,
  Upload,
  Trash2,
  ExternalLink,
  Loader2,
  ClipboardCheck,
} from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { uploadFileToR2 } from '../../../lib/r2Client';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { DetailsModal, ViewButton, detailDate } from '../../../components/ui/DetailsModal';
import { PageDescription } from '../../../components/ui/PageDescription';

interface Inspection {
  id: string;
  inspectionType: 'GRN' | 'FINISHED_BATCH';
  materialId: string;
  result: 'PENDING' | 'PASSED' | 'FAILED';
  notes?: string | null;
  inspectedAt?: string | null;
  createdAt: string;
  referenceLabel?: string | null;
  receivedQuantity?: string | number | null;
  receivedUnitOfMeasure?: string | null;
  material?: { name: string; sku: string; unitOfMeasure: string } | null;
  batchLot?: {
    id: string;
    batchNumber: string;
    lotCode?: string | null;
    /** SOP KIB/QCA/010 — the sequence inside the lot code, editable by QA. */
    setNumber?: number | null;
    vendorCode?: string | null;
    ingredientCode?: string | null;
    yearCode?: string | null;
    status: string;
  } | null;
  inspector?: { fullName?: string } | null;
  reviewDocumentUrl?: string | null;
  reviewDocumentKey?: string | null;
  reviewDocumentName?: string | null;
  reviewDocumentMime?: string | null;
  reviewDocumentSize?: number | null;
  reviewDocumentUploadedAt?: string | null;
}

const resultBadge: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-600 border-slate-200',
  PASSED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-rose-50 text-rose-600 border-rose-200',
};

const batchStatusBadge: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  QUARANTINE: 'bg-amber-50 text-amber-700 border-amber-200',
  REJECTED: 'bg-rose-50 text-rose-600 border-rose-200',
  EXPIRED: 'bg-slate-100 text-slate-500 border-slate-200',
};

/** Mirrors `buildLotCode` on the server so QA sees the code while editing. */
function previewLotCode(batchLot: Inspection['batchLot'], rawSetNumber: string) {
  const setNumber = Number(rawSetNumber);
  if (!batchLot?.vendorCode || !batchLot.ingredientCode || !batchLot.yearCode) return null;
  if (!Number.isInteger(setNumber) || setNumber <= 0) return null;
  return `${batchLot.vendorCode}-${batchLot.ingredientCode}-${setNumber}-${batchLot.yearCode}`;
}

/** Local calendar day (YYYY-MM-DD) so it matches an <input type="date"> value. */
const localDay = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const displayDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function Inspections({ searchQuery = '' }: { searchQuery?: string }) {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<Inspection | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);
  const [viewing, setViewing] = useState<Inspection | null>(null);
  /** QA review modal — lot-code set number + comments for one item. */
  const [reviewing, setReviewing] = useState<Inspection | null>(null);
  const [reviewForm, setReviewForm] = useState({ setNumber: '', notes: '', quantity: '' });
  const [reviewError, setReviewError] = useState('');
  const [savingReview, setSavingReview] = useState<'comment' | 'release' | 'reject' | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get<{ inspections: Inspection[] }>('/qa/inspections', {
        params: { result: resultFilter || undefined },
      });
      setInspections(res.data.inspections);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load inspections. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [resultFilter]);

  /** Reload the list and return one inspection, so the open modal stays fresh. */
  const refreshOne = async (id: string) => {
    const res = await axiosClient.get<{ inspections: Inspection[] }>('/qa/inspections', {
      params: { result: resultFilter || undefined },
      toast: false,
    });
    setInspections(res.data.inspections);
    return res.data.inspections.find((i) => i.id === id) ?? null;
  };

  const openReview = (inspection: Inspection) => {
    setReviewing(inspection);
    setReviewForm({
      setNumber: inspection.batchLot?.setNumber != null ? String(inspection.batchLot.setNumber) : '',
      notes: inspection.notes ?? '',
      quantity:
        inspection.receivedQuantity != null ? String(inspection.receivedQuantity) : '',
    });
    setReviewError('');
    setError('');
  };

  const closeReview = () => {
    if (savingReview) return;
    setReviewing(null);
    setReviewError('');
  };

  /** Save the inspector's observations and any set-number edit without deciding the result yet. */
  const saveComment = async () => {
    if (!reviewing) return;
    setSavingReview('comment');
    setReviewError('');
    try {
      await axiosClient.patch(`/qa/inspections/${reviewing.id}/comment`, {
        notes: reviewForm.notes,
        setNumber: reviewForm.setNumber.trim() || undefined,
        quantity:
          reviewing.inspectionType === 'GRN' && reviewForm.quantity.trim()
            ? Number(reviewForm.quantity)
            : undefined,
      });
      const refreshed = await refreshOne(reviewing.id);
      if (refreshed) {
        setReviewing(refreshed);
        setReviewForm({
          notes: refreshed.notes ?? '',
          setNumber: refreshed.batchLot?.setNumber != null ? String(refreshed.batchLot.setNumber) : '',
          quantity:
            refreshed.receivedQuantity != null ? String(refreshed.receivedQuantity) : '',
        });
      }
    } catch (err: any) {
      setReviewError(err?.response?.data?.error || 'Failed to save the comment');
    } finally {
      setSavingReview(null);
    }
  };

  const decide = async (action: 'release' | 'reject') => {
    if (!reviewing) return;
    if (reviewForm.setNumber.trim()) {
      const setNumber = Number(reviewForm.setNumber);
      if (!Number.isInteger(setNumber) || setNumber <= 0) {
        setReviewError('Set number must be a positive whole number.');
        return;
      }
    }
    if (reviewing.inspectionType === 'GRN' && reviewForm.quantity.trim()) {
      const quantity = Number(reviewForm.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setReviewError('Received quantity must be greater than zero.');
        return;
      }
    }
    setSavingReview(action);
    setReviewError('');
    try {
      await axiosClient.post(`/qa/inspections/${reviewing.id}/${action}`, {
        setNumber: reviewForm.setNumber.trim() || undefined,
        notes: reviewForm.notes.trim() || undefined,
        quantity:
          action === 'release' &&
          reviewing.inspectionType === 'GRN' &&
          reviewForm.quantity.trim()
            ? Number(reviewForm.quantity)
            : undefined,
      });
      setReviewing(null);
      await load();
    } catch (err: any) {
      setReviewError(err?.response?.data?.error || `Failed to ${action} batch`);
    } finally {
      setSavingReview(null);
    }
  };

  /** Browser uploads straight to R2; if CORS blocks it, fall back to the API. */
  const uploadReviewDoc = async (inspection: Inspection, file: File) => {
    if (busyId) return;
    setBusyId(inspection.id);
    setError('');
    const contentType = file.type || 'application/octet-stream';
    const folder = `inspections/${inspection.id}/review-docs`;
    try {
      let publicUrl: string;
      try {
        publicUrl = await uploadFileToR2(file, folder);
      } catch (directError) {
        // Mirrors school-pulse: direct R2 PUT needs bucket CORS, so use the
        // API upload route when the browser blocks it.
        console.warn('Direct R2 upload failed, falling back to backend upload:', directError);
        const res = await axiosClient.post<{ url: string }>(
          `/qa/inspections/${inspection.id}/review-document/upload`,
          file,
          {
            headers: {
              'Content-Type': 'application/octet-stream',
              'x-file-type': contentType,
            },
            params: { fileName: file.name },
            toast: false,
          }
        );
        publicUrl = res.data.url;
      }

      // The backend only receives the URL produced by the upload.
      await axiosClient.post(`/qa/inspections/${inspection.id}/review-document`, {
        url: publicUrl,
        fileName: file.name,
        mimeType: contentType,
        fileSize: file.size,
      });
      const refreshed = await refreshOne(inspection.id);
      if (refreshed && reviewing?.id === inspection.id) setReviewing(refreshed);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to upload the review document.');
    } finally {
      setBusyId(null);
    }
  };

  const removeReviewDoc = async () => {
    if (!docToDelete) return;
    setDeletingDoc(true);
    setError('');
    try {
      await axiosClient.delete(`/qa/inspections/${docToDelete.id}/review-document`);
      const deletedId = docToDelete.id;
      setDocToDelete(null);
      const refreshed = await refreshOne(deletedId);
      if (refreshed) {
        if (reviewing?.id === deletedId) setReviewing(refreshed);
        if (viewing?.id === deletedId) setViewing(refreshed);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to remove the review document.');
    } finally {
      setDeletingDoc(false);
    }
  };

  const filtered = inspections.filter((i) => {
    const term = searchQuery.toLowerCase();
    const matchesSearch =
      (i.material?.name ?? '').toLowerCase().includes(term) ||
      (i.batchLot?.batchNumber ?? '').toLowerCase().includes(term) ||
      (i.batchLot?.lotCode ?? '').toLowerCase().includes(term) ||
      (i.notes ?? '').toLowerCase().includes(term) ||
      (i.referenceLabel ?? '').toLowerCase().includes(term);
    const matchesDate = !dateFilter || localDay(i.inspectedAt ?? i.createdAt) === dateFilter;
    return matchesSearch && matchesDate;
  });

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">QA Inspections</h2>
          <PageDescription>Check received consignment items and finished production batches: attach documents, record comments and approve or assign the batch code.</PageDescription>
        </div>
        <div className="flex gap-2">
          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            className="h-9 rounded-lg border border-[#E9E9E9] bg-white text-xs text-[#171717] px-2 focus:outline-none focus:border-[#EA4335]"
          >
            <option value="">All results</option>
            <option value="PENDING">Pending</option>
            <option value="PASSED">Passed</option>
            <option value="FAILED">Failed</option>
          </select>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              title="Filter by inspection date"
              className="h-9 rounded-lg border border-[#E9E9E9] bg-white text-xs text-[#171717] px-2 focus:outline-none focus:border-[#EA4335]"
            />
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                className="h-9 px-2 rounded-lg border border-slate-200 text-[10px] font-semibold text-slate-500 hover:bg-slate-50"
                title="Clear date filter"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>
      )}

      {/* 2. Inspections Table */}
      <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
        {loading ? (
          <TableSkeleton cols={6} rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No inspections found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-semibold">Material</th>
                  <th className="px-4 py-3 font-semibold">Batch / Ref</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Batch Status</th>
                  <th className="px-4 py-3 font-semibold">Result</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr key={i.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-[#EA4335]/10 flex items-center justify-center shrink-0">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#EA4335]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#171717] leading-none truncate max-w-[160px]" title={i.material?.name ?? ''}>
                            {i.material?.name ?? '—'}
                          </p>
                          <p className="text-[9px] font-mono text-slate-400 mt-0.5 truncate max-w-[160px]">{i.material?.sku ?? ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className={`text-[10px] font-mono ${i.batchLot?.lotCode ? 'text-slate-600' : 'text-amber-600'}`}>
                          {i.batchLot?.lotCode ?? i.batchLot?.batchNumber ?? '—'}
                        </span>
                      </div>
                      {i.batchLot?.setNumber != null && (
                        <p className="text-[9px] whitespace-nowrap mt-0.5">
                          <span className="text-slate-400">Set: </span>
                          <span className="font-mono font-semibold text-slate-600">{i.batchLot.setNumber}</span>
                        </p>
                      )}
                      <p className="text-[9px] text-slate-400 whitespace-nowrap mt-0.5">
                        Ref: {i.referenceLabel ?? '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-[11px] text-slate-600">{displayDate(i.inspectedAt ?? i.createdAt)}</span>
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        {i.inspectedAt ? 'Inspected' : 'Received'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${batchStatusBadge[i.batchLot?.status ?? ''] ?? batchStatusBadge.ACTIVE}`}>
                        {i.batchLot?.status ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${resultBadge[i.result]}`}>{i.result}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <ViewButton onClick={() => setViewing(i)} />
                        {i.result === 'PENDING' && (
                          <button onClick={() => openReview(i)} className="btn-3d px-3 h-7">
                            <span className="flex items-center gap-1 text-white text-[10px] font-semibold">
                              <ClipboardCheck className="w-3 h-3" /> Review
                            </span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. QA review — set number + comments, then release/reject */}
      {reviewing && (
        <Modal onClose={closeReview}>
          <div className="bg-white rounded-xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#171717] truncate">{reviewing.material?.name ?? 'Inspection'}</h3>
                <p className="text-[10px] text-slate-400 mt-1">
                  {reviewing.material?.sku ?? ''}
                  {reviewing.referenceLabel ? ` · ${reviewing.referenceLabel}` : ' · GRN'}
                </p>
              </div>
              <button type="button" onClick={closeReview} disabled={!!savingReview} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {reviewError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-600">{reviewError}</div>
            )}

            <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5 grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Batch Status</p>
                <p className="text-[11px] text-[#171717]">{reviewing.batchLot?.status ?? '—'}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Lot Code</p>
                <p className={`text-[11px] font-mono ${reviewing.batchLot?.lotCode ? 'text-[#171717]' : 'text-amber-600'}`}>
                  {reviewing.batchLot?.lotCode ?? 'Not set'}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5 space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Material Set Number
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={reviewForm.setNumber}
                onChange={(e) => setReviewForm({ ...reviewForm, setNumber: e.target.value })}
                placeholder="e.g. 7"
                className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-3 text-xs font-mono focus:outline-none focus:border-[#EA4335]"
              />
              <p className="text-[9px] text-slate-400">
                The system assigns the next number automatically. Edit it to correct the lot code — vendor, ingredient and year stay fixed.
              </p>
              {(() => {
                const preview = previewLotCode(reviewing.batchLot, reviewForm.setNumber);
                const current = reviewing.batchLot?.lotCode ?? null;
                if (preview && preview !== current) {
                  return <p className="text-[10px] font-mono font-semibold text-[#171717]">New lot code: {preview}</p>;
                }
                if (current) {
                  return <p className="text-[10px] font-mono text-slate-600">Lot code: {current}</p>;
                }
                return (
                  <p className="text-[9px] text-amber-600">
                    Lot code cannot be built until the supplier vendor code and material traceability code are set.
                  </p>
                );
              })()}
            </div>

            {reviewing.inspectionType === 'GRN' && (
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5 space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Received quantity (QA edit)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.0001"
                    step="any"
                    value={reviewForm.quantity}
                    onChange={(e) => setReviewForm({ ...reviewForm, quantity: e.target.value })}
                    className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-3 text-xs font-mono focus:outline-none focus:border-[#EA4335]"
                  />
                  <span className="shrink-0 text-[10px] font-semibold text-slate-500">
                    {reviewing.receivedUnitOfMeasure ?? reviewing.material?.unitOfMeasure ?? 'unit'}
                  </span>
                </div>
                <p className="text-[9px] text-slate-400">
                  Only QA can change the received quantity. This adjusts the GRN line, stock ledger and PO received balance.
                </p>
              </div>
            )}

            <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5 space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">QA Comments</label>
              <textarea
                value={reviewForm.notes}
                onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })}
                rows={3}
                placeholder="Observations, test results, reasons…"
                className="w-full rounded-lg border border-[#E9E9E9] bg-white px-3 py-2 text-xs focus:outline-none focus:border-[#EA4335] resize-none"
              />
            </div>

            <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5 space-y-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Review document</p>

              {reviewing.reviewDocumentUrl ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2">
                  <span className="inline-flex items-center gap-1 min-w-0 text-[10px] font-semibold text-slate-700">
                    <Paperclip className="w-3 h-3 shrink-0 text-slate-400" />
                    <span className="truncate">{reviewing.reviewDocumentName ?? 'Document'}</span>
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={reviewing.reviewDocumentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 h-6 px-2 rounded-md border border-slate-200 text-[9px] font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      <ExternalLink className="w-3 h-3" /> View
                    </a>
                    <label
                      className={`inline-flex items-center gap-1 h-6 px-2 rounded-md border border-slate-200 text-[9px] font-semibold text-slate-600 cursor-pointer hover:bg-slate-50 ${busyId === reviewing.id ? 'opacity-60 pointer-events-none' : ''}`}
                    >
                      {busyId === reviewing.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      {busyId === reviewing.id ? 'Uploading…' : 'Replace'}
                      <input
                        type="file"
                        className="hidden"
                        disabled={busyId === reviewing.id}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) void uploadReviewDoc(reviewing, file);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setDocToDelete(reviewing)}
                      disabled={busyId === reviewing.id}
                      className="inline-flex items-center gap-1 h-6 px-2 rounded-md border border-rose-200 text-[9px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              ) : (
                <label
                  className={`inline-flex items-center gap-1 px-2.5 h-7 rounded-lg border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 cursor-pointer hover:bg-slate-50 ${busyId === reviewing.id ? 'opacity-60 pointer-events-none' : ''}`}
                >
                  {busyId === reviewing.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  {busyId === reviewing.id ? 'Uploading…' : 'Upload document'}
                  <input
                    type="file"
                    className="hidden"
                    disabled={busyId === reviewing.id}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void uploadReviewDoc(reviewing, file);
                    }}
                  />
                </label>
              )}

              <p className="text-[9px] text-slate-400">Any format — PDF, Word or image.</p>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={closeReview}
                disabled={!!savingReview}
                className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveComment}
                disabled={!!savingReview}
                className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {savingReview === 'comment' ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={() => decide('reject')}
                disabled={!!savingReview}
                className="h-9 px-4 rounded-lg border border-rose-200 text-rose-600 text-xs font-semibold hover:bg-rose-50 disabled:opacity-50"
              >
                <span className="flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" /> {savingReview === 'reject' ? 'Rejecting…' : 'Reject'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => decide('release')}
                disabled={!!savingReview}
                className="btn-3d px-4 h-9 disabled:opacity-50"
              >
                <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {savingReview === 'release' ? 'Releasing…' : 'Release'}
                </span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 4. Details */}
      {viewing && (
        <DetailsModal
          title={viewing.material?.name ?? 'Inspection'}
          subtitle={viewing.material?.sku ? `SKU ${viewing.material.sku}` : undefined}
          status={{ label: viewing.result, className: resultBadge[viewing.result] }}
          onClose={() => setViewing(null)}
          sections={[
            {
              title: 'Inspection',
              fields: [
                { label: 'Reference', value: viewing.referenceLabel ?? '—' },
                { label: 'Inspected by', value: viewing.inspector?.fullName ?? '—' },
                { label: 'Inspected at', value: detailDate(viewing.inspectedAt, true) },
                { label: 'Created', value: detailDate(viewing.createdAt, true) },
              ],
            },
            {
              title: 'Batch',
              fields: [
                { label: 'Lot code', value: viewing.batchLot?.lotCode ?? 'Not set' },
                {
                  label: 'Material set number',
                  value:
                    viewing.batchLot?.setNumber != null ? (
                      <span className="font-mono font-semibold text-slate-700">{viewing.batchLot.setNumber}</span>
                    ) : (
                      <span className="text-slate-400">Not set</span>
                    ),
                },
                { label: 'Batch status', value: viewing.batchLot?.status ?? '—' },
                { label: 'Material', value: viewing.material?.name ?? '—' },
                { label: 'SKU', value: viewing.material?.sku ?? '—' },
                { label: 'Receiving reference', value: viewing.batchLot?.batchNumber ?? '—' },
              ],
            },
            {
              title: 'Review document',
              fields: [
                { label: 'Document', value: viewing.reviewDocumentName ?? 'None attached' },
                { label: 'Uploaded', value: detailDate(viewing.reviewDocumentUploadedAt, true) },
                {
                  label: 'Actions',
                  wide: true,
                  value: viewing.reviewDocumentUrl ? (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <a
                        href={viewing.reviewDocumentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-slate-200 bg-white text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <ExternalLink className="w-3 h-3" /> View document
                      </a>
                      <button
                        type="button"
                        onClick={() => setDocToDelete(viewing)}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-rose-200 bg-white text-[10px] font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  ) : (
                    <span className="text-slate-400">No document attached</span>
                  ),
                },
                { label: 'QA comments', wide: true, value: viewing.notes ?? '—' },
              ],
            },
          ]}
        />
      )}

      {docToDelete && (
        <ConfirmationModal
          type="delete"
          title="Delete review document"
          message={`Remove “${docToDelete.reviewDocumentName ?? 'this document'}”? The file will also be deleted from storage.`}
          onConfirm={removeReviewDoc}
          onCancel={() => setDocToDelete(null)}
          isLoading={deletingDoc}
        />
      )}
    </div>
  );
}
