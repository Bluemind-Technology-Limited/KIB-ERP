import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Search,
  Paperclip,
  Upload,
  Trash2,
  ExternalLink,
  Loader2,
  MessageSquare,
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
  material?: { name: string; sku: string; unitOfMeasure: string } | null;
  batchLot?: { id: string; batchNumber: string; status: string } | null;
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

export default function Inspections({ searchQuery = '' }: { searchQuery?: string }) {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<Inspection | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);
  const [viewing, setViewing] = useState<Inspection | null>(null);
  /** QA review modal — batch number (traceability) + comments for one item. */
  const [reviewing, setReviewing] = useState<Inspection | null>(null);
  const [reviewForm, setReviewForm] = useState({ batchNumber: '', notes: '' });
  const [savingReview, setSavingReview] = useState<'comment' | 'release' | 'reject' | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get<{ inspections: Inspection[] }>('/qa/inspections', {
        params: { type: filter || undefined, result: resultFilter || undefined },
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
  }, [filter, resultFilter]);

  const openReview = (inspection: Inspection) => {
    setReviewing(inspection);
    setReviewForm({
      batchNumber:
        inspection.batchLot && !inspection.batchLot.batchNumber.startsWith('PENDING-')
          ? inspection.batchLot.batchNumber
          : '',
      notes: inspection.notes ?? '',
    });
    setError('');
  };

  const closeReview = () => {
    if (savingReview) return;
    setReviewing(null);
  };

  /** Save the inspector's observations without deciding the result yet. */
  const saveComment = async () => {
    if (!reviewing) return;
    setSavingReview('comment');
    setError('');
    try {
      await axiosClient.patch(`/qa/inspections/${reviewing.id}/comment`, {
        notes: reviewForm.notes,
      });
      await load();
      const refreshed = (await axiosClient.get<{ inspections: Inspection[] }>('/qa/inspections'))
        .data.inspections.find((i) => i.id === reviewing.id);
      if (refreshed) {
        setReviewing(refreshed);
        setReviewForm((prev) => ({ ...prev, notes: refreshed.notes ?? '' }));
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save the comment');
    } finally {
      setSavingReview(null);
    }
  };

  const decide = async (action: 'release' | 'reject') => {
    if (!reviewing) return;
    if (action === 'release') {
      const lot = reviewing.batchLot;
      if (lot && lot.batchNumber.startsWith('PENDING-') && !reviewForm.batchNumber.trim()) {
        setError('Assign a batch number before releasing this item.');
        return;
      }
    }
    setSavingReview(action);
    setError('');
    try {
      await axiosClient.post(`/qa/inspections/${reviewing.id}/${action}`, {
        batchNumber: reviewForm.batchNumber.trim() || undefined,
        notes: reviewForm.notes.trim() || undefined,
      });
      setReviewing(null);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || `Failed to ${action} batch`);
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
      await load();
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
      setDocToDelete(null);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to remove the review document.');
    } finally {
      setDeletingDoc(false);
    }
  };

  const filtered = inspections.filter(
    (i) =>
      (i.material?.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.batchLot?.batchNumber ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.notes ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.referenceLabel ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingBatch = (i: Inspection) =>
    Boolean(i.batchLot && i.batchLot.batchNumber.startsWith('PENDING-'));

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">QA Inspections</h2>
          <PageDescription>Check received consignment items: attach documents, record comments and assign batch numbers.</PageDescription>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Type (GRN / FINISHED_BATCH)"
              className="pl-9 pr-3 h-9 rounded-lg border border-[#E9E9E9] bg-white text-xs text-[#171717] w-44 focus:outline-none focus:border-[#EA4335]"
            />
          </div>
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
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>
      )}

      {/* 2. Inspections Table */}
      <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
        {loading ? (
          <TableSkeleton cols={8} rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No inspections found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-semibold">Material</th>
                  <th className="px-4 py-3 font-semibold">Batch / Ref</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Batch Status</th>
                  <th className="px-4 py-3 font-semibold">Result</th>
                  <th className="px-4 py-3 font-semibold">Review Document</th>
                  <th className="px-4 py-3 font-semibold">Comments</th>
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-mono ${pendingBatch(i) ? 'text-amber-600' : 'text-slate-600'}`}>
                          {i.batchLot?.batchNumber ?? '—'}
                        </span>
                        {pendingBatch(i) && i.result === 'PENDING' && (
                          <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            Assign
                          </span>
                        )}
                      </div>
                      {i.referenceLabel && <p className="text-[9px] text-slate-400">Ref: {i.referenceLabel}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-sky-50 text-sky-700 border-sky-200">
                        {i.inspectionType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${batchStatusBadge[i.batchLot?.status ?? ''] ?? batchStatusBadge.ACTIVE}`}>
                        {i.batchLot?.status ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${resultBadge[i.result]}`}>{i.result}</span>
                    </td>
                    <td className="px-4 py-3">
                      {i.reviewDocumentUrl ? (
                        <div className="flex items-center gap-1.5">
                          <a
                            href={i.reviewDocumentUrl}
                            target="_blank"
                            rel="noreferrer"
                            title={i.reviewDocumentName ?? 'Open review document'}
                            className="inline-flex items-center gap-1 max-w-[130px] text-[10px] font-semibold text-[#171717] hover:text-[#EA4335]"
                          >
                            <Paperclip className="w-3 h-3 shrink-0" />
                            <span className="truncate">{i.reviewDocumentName ?? 'Document'}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                          <label
                            className={`inline-flex items-center justify-center w-6 h-6 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer ${busyId === i.id ? 'opacity-60 pointer-events-none' : ''}`}
                            title="Replace document"
                          >
                            {busyId === i.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                            <input
                              type="file"
                              className="hidden"
                              disabled={busyId === i.id}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                if (file) void uploadReviewDoc(i, file);
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => setDocToDelete(i)}
                            disabled={busyId === i.id}
                            className="inline-flex items-center justify-center w-6 h-6 rounded border border-rose-200 text-rose-500 hover:bg-rose-50"
                            title="Delete document"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <label
                          className={`inline-flex items-center gap-1 px-2 h-7 rounded-lg border border-slate-200 text-[10px] font-semibold cursor-pointer hover:bg-slate-50 ${busyId === i.id ? 'opacity-60 pointer-events-none' : 'text-slate-600'}`}
                        >
                          {busyId === i.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                          {busyId === i.id ? 'Uploading…' : 'Upload'}
                          <input
                            type="file"
                            className="hidden"
                            disabled={busyId === i.id}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = '';
                              if (file) void uploadReviewDoc(i, file);
                            }}
                          />
                        </label>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {i.notes ? (
                        <span
                          className="inline-flex items-start gap-1 max-w-[180px] text-[10px] text-slate-600"
                          title={i.notes}
                        >
                          <MessageSquare className="w-3 h-3 mt-0.5 shrink-0 text-slate-400" />
                          <span className="truncate">{i.notes}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-300">—</span>
                      )}
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

      {/* 3. QA review — batch number + comments, then release/reject */}
      {reviewing && (
        <Modal onClose={closeReview}>
          <div className="bg-white rounded-xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#171717] truncate">{reviewing.material?.name ?? 'Inspection'}</h3>
                <p className="text-[10px] text-slate-400 mt-1">
                  {reviewing.material?.sku ?? ''} · {reviewing.inspectionType}
                  {reviewing.referenceLabel ? ` · ${reviewing.referenceLabel}` : ''}
                </p>
              </div>
              <button type="button" onClick={closeReview} disabled={!!savingReview} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-600">{error}</div>
            )}

            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Batch Status</p>
                <p className="text-[11px] text-[#171717]">{reviewing.batchLot?.status ?? '—'}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Current Batch Ref</p>
                <p className={`text-[11px] font-mono ${pendingBatch(reviewing) ? 'text-amber-600' : 'text-[#171717]'}`}>
                  {reviewing.batchLot?.batchNumber ?? '—'}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Batch Number {pendingBatch(reviewing) ? '*' : ''}
              </label>
              <input
                value={reviewForm.batchNumber}
                onChange={(e) => setReviewForm({ ...reviewForm, batchNumber: e.target.value })}
                placeholder="e.g. A-1-6-26"
                className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs font-mono focus:outline-none focus:border-[#EA4335]"
              />
              <p className="text-[9px] text-slate-400">
                Assigned by QA for traceability — this replaces the provisional lot reference.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">QA Comments</label>
              <textarea
                value={reviewForm.notes}
                onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })}
                rows={3}
                placeholder="Observations, test results, reasons…"
                className="w-full rounded-lg border border-[#E9E9E9] px-3 py-2 text-xs focus:outline-none focus:border-[#EA4335] resize-none"
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Review document</p>
                {reviewing.reviewDocumentUrl ? (
                  <a
                    href={reviewing.reviewDocumentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#171717] hover:text-[#EA4335] truncate"
                  >
                    <Paperclip className="w-3 h-3 shrink-0" />
                    <span className="truncate">{reviewing.reviewDocumentName ?? 'Document'}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ) : (
                  <p className="text-[10px] text-slate-400">No document attached — upload it from the table.</p>
                )}
              </div>
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
                {savingReview === 'comment' ? 'Saving…' : 'Save comment'}
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
                { label: 'Type', value: viewing.inspectionType },
                { label: 'Reference', value: viewing.referenceLabel ?? '—' },
                { label: 'Inspected by', value: viewing.inspector?.fullName ?? '—' },
                { label: 'Inspected at', value: detailDate(viewing.inspectedAt, true) },
                { label: 'Created', value: detailDate(viewing.createdAt, true) },
              ],
            },
            {
              title: 'Batch',
              fields: [
                { label: 'Batch number', value: viewing.batchLot?.batchNumber ?? '—' },
                { label: 'Batch status', value: viewing.batchLot?.status ?? '—' },
                { label: 'Material', value: viewing.material?.name ?? '—' },
                { label: 'SKU', value: viewing.material?.sku ?? '—' },
              ],
            },
            {
              title: 'Review document',
              fields: [
                { label: 'Document', value: viewing.reviewDocumentName ?? '—' },
                { label: 'Uploaded', value: detailDate(viewing.reviewDocumentUploadedAt, true) },
                {
                  label: 'Link',
                  wide: true,
                  value: viewing.reviewDocumentUrl ? (
                    <a
                      href={viewing.reviewDocumentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[#EA4335] font-semibold hover:underline break-all"
                    >
                      {viewing.reviewDocumentUrl} <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ) : (
                    '—'
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
