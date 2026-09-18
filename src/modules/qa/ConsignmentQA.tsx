import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Loader,
  Paperclip,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { axiosClient } from '../../lib/axiosClient';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/useAuthStore';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CheckResult = 'PASS' | 'FAIL';
type IngredientStatus = 'PENDING' | 'PASSED' | 'FAILED';

const CHECK_TYPES = [
  'PHYSICAL_INSPECTION',
  'QUANTITY_VERIFICATION',
  'EXPIRY_CHECK',
  'PACKAGING_INSPECTION',
  'DOCUMENTATION_REVIEW',
  'LABORATORY_TEST',
] as const;

const CHECK_TYPE_LABELS: Record<string, string> = {
  PHYSICAL_INSPECTION: 'Physical Inspection',
  QUANTITY_VERIFICATION: 'Quantity Verification',
  EXPIRY_CHECK: 'Expiry Check',
  PACKAGING_INSPECTION: 'Packaging Inspection',
  DOCUMENTATION_REVIEW: 'Documentation Review',
  LABORATORY_TEST: 'Laboratory Test',
};

const PROOF_KINDS = ['PHOTO', 'COA', 'LAB_REPORT', 'DOCUMENT'] as const;

/** Roles allowed to record checks / approve (mirrors backend `qa:update`). */
const MUTATING_ROLES = ['SUPER_ADMIN', 'QC'];

const QUANTITY_REASON_CODES = ['SHORTAGE', 'DAMAGE', 'OVERAGE', 'QUALITY_REJECT', 'RECOUNT'] as const;

interface Attachment {
  id: string;
  fileName: string;
  storagePath: string;
  mimeType?: string | null;
  fileSize?: number | null;
  kind?: string | null;
  createdAt: string;
  url: string | null;
  uploadedBy?: { fullName?: string } | null;
}

interface CheckItem {
  id: string;
  checkType: string;
  status: string;
  result: CheckResult | null;
  remarks?: string | null;
  checkedAt?: string | null;
  checkedBy?: { fullName?: string } | null;
  attachments: Attachment[];
}

interface IngredientGroup {
  consignmentItemId: string;
  material: { id: string; name: string; sku: string; unitOfMeasure: string };
  quantity: string | number;
  distributedQty: string | number;
  unitOfMeasure: string;
  status: IngredientStatus;
  attachmentCount: number;
  checks: CheckItem[];
}

interface QualityDetail {
  id: string;
  consignmentId: string;
  status: string;
  rejectionReason?: string | null;
  notes?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  approvedAt?: string | null;
  startedBy?: { fullName?: string } | null;
  approvedBy?: { fullName?: string } | null;
  itemsByIngredient: IngredientGroup[];
  summary: {
    totalItems: number;
    passedItems: number;
    failedItems: number;
    pendingItems: number;
    totalChecks: number;
    completionPercentage: number;
  };
}

interface ConsignmentSummary {
  id: string;
  consignmentNumber: string;
  status: string;
  receivedAt?: string | null;
  supplier?: { id: string; name: string } | null;
  warehouse?: { id: string; name: string } | null;
  qualityApproval?: { id: string; status: string } | null;
}

interface QuantityAdjustment {
  id: string;
  consignmentItemId: string;
  oldQuantity: string | number;
  newQuantity: string | number;
  difference: string | number;
  reasonCode?: string | null;
  reason?: string | null;
  status: string;
  rejectionReason?: string | null;
  requestedBy?: { fullName?: string } | null;
  approvedBy?: { fullName?: string } | null;
  requestedAt?: string;
}

const ingredientStatusBadge: Record<IngredientStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-600 border-slate-200',
  PASSED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-rose-50 text-rose-600 border-rose-200',
};

const approvalStatusBadge: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-600 border-slate-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
  PASSED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-rose-50 text-rose-600 border-rose-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-600 border-rose-200',
};

function apiError(err: any, fallback: string) {
  return err?.response?.data?.error || err?.message || fallback;
}

function formatBytes(bytes?: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Proof attachments
// ---------------------------------------------------------------------------

function ProofSection({
  check,
  canMutate,
  onUpload,
  onDelete,
}: {
  check: CheckItem;
  canMutate: boolean;
  onUpload: (file: File, kind: string) => Promise<void>;
  onDelete: (attachmentId: string) => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<string>('PHOTO');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      await onUpload(file, kind);
    } catch (err: any) {
      setError(apiError(err, 'Upload failed'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (attachmentId: string) => {
    setError('');
    setDeletingId(attachmentId);
    try {
      await onDelete(attachmentId);
    } catch (err: any) {
      setError(apiError(err, 'Failed to remove proof'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <Paperclip className="w-3 h-3" /> Proof of check ({check.attachments.length})
      </div>

      {check.attachments.length > 0 && (
        <ul className="space-y-1.5">
          {check.attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-2.5 py-2"
            >
              <a
                href={attachment.url || undefined}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 min-w-0 flex-1 text-slate-700 hover:text-[#AA3BFF]"
              >
                <FileText className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span className="truncate text-[11px] font-semibold">{attachment.fileName}</span>
                {attachment.kind && (
                  <span className="shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-500">
                    {attachment.kind.replace('_', ' ')}
                  </span>
                )}
              </a>
              <span className="shrink-0 text-[9px] text-slate-400">
                {formatBytes(attachment.fileSize)}
                {attachment.uploadedBy?.fullName ? ` · ${attachment.uploadedBy.fullName}` : ''}
              </span>
              {canMutate && (
                <button
                  onClick={() => handleDelete(attachment.id)}
                  disabled={deletingId === attachment.id}
                  className="shrink-0 text-slate-300 hover:text-rose-600 transition-colors disabled:opacity-50"
                  title="Remove proof"
                >
                  {deletingId === attachment.id ? (
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canMutate && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[10px] text-slate-700 focus:outline-none focus:border-[#AA3BFF]"
          >
            {PROOF_KINDS.map((k) => (
              <option key={k} value={k}>
                {k.replace('_', ' ')}
              </option>
            ))}
          </select>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-lg border border-[#AA3BFF]/30 bg-[#AA3BFF]/5 px-2.5 h-8 text-[10px] font-semibold text-[#AA3BFF] hover:bg-[#AA3BFF]/10 disabled:opacity-50"
          >
            {uploading ? <Loader className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            {uploading ? 'Uploading…' : 'Attach proof'}
          </button>
        </div>
      )}

      {error && <p className="text-[10px] text-rose-600">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// A single check row (result + remarks)
// ---------------------------------------------------------------------------

function CheckRow({
  check,
  canMutate,
  approvalLocked,
  onSave,
  onUpload,
  onDeleteAttachment,
}: {
  check: CheckItem;
  canMutate: boolean;
  approvalLocked: boolean;
  onSave: (checkItemId: string, checkType: string, result: CheckResult, remarks: string) => Promise<void>;
  onUpload: (file: File, kind: string) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
}) {
  const [remarks, setRemarks] = useState(check.remarks || '');
  const [saving, setSaving] = useState<CheckResult | null>(null);
  const [error, setError] = useState('');

  const editable = canMutate && !approvalLocked;

  const decide = async (result: CheckResult) => {
    setError('');
    setSaving(result);
    try {
      await onSave(check.id, check.checkType, result, remarks);
    } catch (err: any) {
      setError(apiError(err, 'Failed to record check'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-slate-700">
          {CHECK_TYPE_LABELS[check.checkType] || check.checkType}
        </span>
        {check.result === 'PASS' && (
          <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
            PASS
          </span>
        )}
        {check.result === 'FAIL' && (
          <span className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[9px] font-bold text-rose-700">
            FAIL
          </span>
        )}
        {!check.result && (
          <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">
            PENDING
          </span>
        )}
      </div>

      {check.checkedBy?.fullName && (
        <p className="text-[9px] text-slate-400">
          {check.checkedBy.fullName}
          {check.checkedAt ? ` · ${new Date(check.checkedAt).toLocaleString()}` : ''}
        </p>
      )}

      <textarea
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        disabled={!editable}
        placeholder="Findings / remarks (optional)"
        rows={2}
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] text-slate-700 focus:outline-none focus:border-[#AA3BFF] disabled:bg-slate-50 disabled:text-slate-400"
      />

      {editable && (
        <div className="flex gap-2">
          <button
            onClick={() => decide('PASS')}
            disabled={saving !== null}
            className="flex-1 rounded-lg border border-emerald-200 bg-white px-3 h-8 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            {saving === 'PASS' ? 'Saving…' : 'Mark Pass'}
          </button>
          <button
            onClick={() => decide('FAIL')}
            disabled={saving !== null}
            className="flex-1 rounded-lg border border-rose-200 bg-white px-3 h-8 text-[10px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
          >
            {saving === 'FAIL' ? 'Saving…' : 'Mark Fail'}
          </button>
        </div>
      )}

      {error && <p className="text-[10px] text-rose-600">{error}</p>}

      <ProofSection
        check={check}
        canMutate={editable}
        onUpload={onUpload}
        onDelete={onDeleteAttachment}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ingredient card (independent checks within the consignment)
// ---------------------------------------------------------------------------

function IngredientCard({
  ingredient,
  approvalId,
  canMutate,
  approvalLocked,
  adjustment,
  onSave,
  onAddCheck,
  onUpload,
  onDeleteAttachment,
  onRequestChange,
}: {
  ingredient: IngredientGroup;
  approvalId: string;
  canMutate: boolean;
  approvalLocked: boolean;
  adjustment: QuantityAdjustment | null;
  onSave: (checkItemId: string, checkType: string, result: CheckResult, remarks: string) => Promise<void>;
  onAddCheck: (
    approvalId: string,
    consignmentItemId: string,
    checkType: string,
    remarks: string
  ) => Promise<void>;
  onUpload: (checkItemId: string, file: File, kind: string) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
  onRequestChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState<string>(CHECK_TYPES[0]);
  const [newRemarks, setNewRemarks] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [error, setError] = useState('');

  const editable = canMutate && !approvalLocked;

  const handleAdd = async () => {
    setError('');
    setAddBusy(true);
    try {
      await onAddCheck(approvalId, ingredient.consignmentItemId, newType, newRemarks);
      setNewRemarks('');
      setAdding(false);
    } catch (err: any) {
      setError(apiError(err, 'Failed to add check'));
    } finally {
      setAddBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/60"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {open ? (
            <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-[#171717]">{ingredient.material?.name}</p>
            <p className="text-[10px] text-slate-400">
              <span className="font-mono">{ingredient.material?.sku}</span> · {ingredient.quantity}{' '}
              {ingredient.unitOfMeasure} · {ingredient.checks.length} check
              {ingredient.checks.length === 1 ? '' : 's'}
              {ingredient.attachmentCount > 0 ? ` · ${ingredient.attachmentCount} proof` : ''}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${ingredientStatusBadge[ingredient.status]}`}
        >
          {ingredient.status}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-3 space-y-2 bg-slate-50/40">
          {ingredient.checks.map((check) => (
            <CheckRow
              key={check.id}
              check={check}
              canMutate={canMutate}
              approvalLocked={approvalLocked}
              onSave={onSave}
              onUpload={(file, kind) => onUpload(check.id, file, kind)}
              onDeleteAttachment={onDeleteAttachment}
            />
          ))}

          {editable && (
            <div className="pt-1">
              {adding ? (
                <div className="rounded-lg border border-[#AA3BFF]/30 bg-white p-3 space-y-2">
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-700 focus:outline-none focus:border-[#AA3BFF]"
                  >
                    {CHECK_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {CHECK_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                  <input
                    value={newRemarks}
                    onChange={(e) => setNewRemarks(e.target.value)}
                    placeholder="Remarks (optional)"
                    className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] text-slate-700 focus:outline-none focus:border-[#AA3BFF]"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAdd}
                      disabled={addBusy}
                      className="flex-1 rounded-lg bg-[#AA3BFF] px-3 h-8 text-[10px] font-semibold text-white hover:bg-[#9a2ff5] disabled:opacity-50"
                    >
                      {addBusy ? 'Adding…' : 'Add check'}
                    </button>
                    <button
                      onClick={() => setAdding(false)}
                      className="rounded-lg border border-slate-200 px-3 h-8 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="text-[10px] font-semibold text-[#AA3BFF] hover:underline"
                >
                  + Add another check for this ingredient
                </button>
              )}
              {error && <p className="mt-1 text-[10px] text-rose-600">{error}</p>}
            </div>
          )}

          {adjustment && adjustment.status === 'PENDING' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-700">
              ⏳ Quantity change awaiting Head of QC: {adjustment.oldQuantity} → {adjustment.newQuantity}
            </div>
          )}
          {adjustment && adjustment.status === 'APPROVED' && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-700">
              ✓ Quantity change approved: {adjustment.oldQuantity} → {adjustment.newQuantity}
              {adjustment.approvedBy?.fullName ? ` by ${adjustment.approvedBy.fullName}` : ''}
            </div>
          )}
          {adjustment && adjustment.status === 'REJECTED' && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-semibold text-rose-700">
              ✗ Quantity change rejected{adjustment.rejectionReason ? `: ${adjustment.rejectionReason}` : ''}
            </div>
          )}
          {editable && (!adjustment || adjustment.status !== 'PENDING') && (
            <button
              onClick={onRequestChange}
              className="text-[10px] font-semibold text-[#EA4335] hover:underline"
            >
              Request quantity change
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export default function ConsignmentQA() {
  const user = useAuthStore((state) => state.user);
  const canMutate = MUTATING_ROLES.includes(user?.role ?? '');
  // `qa:delete` is only held by SUPER_ADMIN in the seeded RBAC matrix.
  const canDeleteChecks = user?.role === 'SUPER_ADMIN';

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedFromUrl = searchParams.get('consignment');

  const [tab, setTab] = useState<'pending' | 'approved'>('pending');
  const [pending, setPending] = useState<ConsignmentSummary[]>([]);
  const [approved, setApproved] = useState<ConsignmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [expandedId, setExpandedId] = useState<string | null>(selectedFromUrl);
  const [detail, setDetail] = useState<QualityDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [busy, setBusy] = useState(false);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const [adjustments, setAdjustments] = useState<QuantityAdjustment[]>([]);
  const [changeFor, setChangeFor] = useState<IngredientGroup | null>(null);
  const [changeForm, setChangeForm] = useState({ newQuantity: '', reasonCode: 'SHORTAGE', reason: '' });
  const [changeBusy, setChangeBusy] = useState(false);
  const [changeError, setChangeError] = useState('');

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, approvedRes] = await Promise.all([
        axiosClient.get('/quality/pending', { params: { limit: 100 } }),
        axiosClient.get('/quality/approved', { params: { limit: 100 } }),
      ]);
      setPending(pendingRes.data.consignments || []);
      setApproved(approvedRes.data.consignments || []);
      setListError('');
    } catch (err: any) {
      setListError(apiError(err, 'Failed to load consignments'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const loadAdjustments = useCallback(async (consignmentId: string) => {
    try {
      const res = await axiosClient.get(
        `/quality/consignments/${consignmentId}/quantity-adjustments`
      );
      setAdjustments(res.data.adjustments || []);
    } catch {
      setAdjustments([]);
    }
  }, []);

  const loadDetail = useCallback(
    async (consignmentId: string) => {
      setDetailLoading(true);
      setDetailError('');
      try {
        const res = await axiosClient.get(`/quality/approvals/${consignmentId}`);
        setDetail(res.data.data);
        await loadAdjustments(consignmentId);
      } catch (err: any) {
        setDetail(null);
        setDetailError(apiError(err, 'Failed to load quality checks'));
      } finally {
        setDetailLoading(false);
      }
    },
    [loadAdjustments]
  );

  // Most recent adjustment per ingredient wins (list is newest-first).
  const adjustmentsByItem = useMemo(() => {
    const map = new Map<string, QuantityAdjustment>();
    for (const adjustment of adjustments) {
      if (!map.has(adjustment.consignmentItemId)) map.set(adjustment.consignmentItemId, adjustment);
    }
    return map;
  }, [adjustments]);

  // Expand a consignment (and keep the URL shareable via ?consignment=).
  const openConsignment = useCallback(
    (consignmentId: string) => {
      const next = expandedId === consignmentId ? null : consignmentId;
      setExpandedId(next);
      setSearchParams(next ? { consignment: next } : {}, { replace: true });
    },
    [expandedId, setSearchParams]
  );

  // Auto-open a consignment linked from the procurement view or the URL.
  useEffect(() => {
    if (selectedFromUrl) {
      setExpandedId(selectedFromUrl);
      loadDetail(selectedFromUrl);
    }
  }, [selectedFromUrl, loadDetail]);

  // Make sure the tab that owns the selected consignment is the visible one.
  useEffect(() => {
    if (!selectedFromUrl) return;
    if (pending.some((c) => c.id === selectedFromUrl)) setTab('pending');
    else if (approved.some((c) => c.id === selectedFromUrl)) setTab('approved');
  }, [selectedFromUrl, pending, approved]);

  const refreshDetail = useCallback(async () => {
    if (expandedId) await loadDetail(expandedId);
  }, [expandedId, loadDetail]);

  // ---- Mutations -----------------------------------------------------------

  const startChecks = async (consignmentId: string) => {
    setBusy(true);
    try {
      await axiosClient.post('/quality/approvals/initiate', { consignmentId });
      await loadList();
      setExpandedId(consignmentId);
      setSearchParams({ consignment: consignmentId }, { replace: true });
      await loadDetail(consignmentId);
    } catch (err: any) {
      setDetailError(apiError(err, 'Failed to start QA checks'));
    } finally {
      setBusy(false);
    }
  };

  const saveCheck = async (
    checkItemId: string,
    checkType: string,
    result: CheckResult,
    remarks: string
  ) => {
    await axiosClient.patch(`/quality/approvals/items/${checkItemId}`, {
      checkType,
      result,
      remarks,
    });
    await refreshDetail();
  };

  const addCheck = async (
    approvalId: string,
    consignmentItemId: string,
    checkType: string,
    remarks: string
  ) => {
    await axiosClient.post(`/quality/approvals/${approvalId}/checks`, {
      consignmentItemId,
      checkType,
      remarks,
    });
    await refreshDetail();
  };

  const uploadProof = async (checkItemId: string, file: File, kind: string) => {
    const presign = await axiosClient.post(`/quality/checks/${checkItemId}/attachments/presign`, {
      fileName: file.name,
    });
    const { bucket, path, token } = presign.data.data as {
      bucket: string;
      path: string;
      token: string;
    };

    if (!supabase) {
      throw new Error('Supabase Storage is not configured on the frontend');
    }

    // Signed-upload URL: the Supabase client sends the multipart body the
    // storage endpoint expects (a raw PUT would be rejected).
    const { error } = await supabase.storage
      .from(bucket)
      .uploadToSignedUrl(path, token, file, {
        contentType: file.type || 'application/octet-stream',
      });
    if (error) throw new Error(error.message);

    await axiosClient.post(`/quality/checks/${checkItemId}/attachments`, {
      fileName: file.name,
      storagePath: path,
      mimeType: file.type || undefined,
      fileSize: file.size,
      kind,
    });
    await refreshDetail();
  };

  const deleteAttachment = async (attachmentId: string) => {
    await axiosClient.delete(`/quality/attachments/${attachmentId}`);
    await refreshDetail();
  };

  const openChangeModal = (ingredient: IngredientGroup) => {
    setChangeFor(ingredient);
    setChangeForm({ newQuantity: String(ingredient.quantity), reasonCode: 'SHORTAGE', reason: '' });
    setChangeError('');
  };

  const submitChange = async () => {
    if (!changeFor) return;
    setChangeBusy(true);
    setChangeError('');
    try {
      await axiosClient.post('/quality/quantity-adjustments', {
        consignmentItemId: changeFor.consignmentItemId,
        newQuantity: Number(changeForm.newQuantity),
        reasonCode: changeForm.reasonCode,
        reason: changeForm.reason || undefined,
      });
      setChangeFor(null);
      await refreshDetail();
    } catch (err: any) {
      setChangeError(apiError(err, 'Failed to submit quantity change'));
    } finally {
      setChangeBusy(false);
    }
  };

  const approve = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      await axiosClient.post(`/quality/approvals/${detail.id}/approve`, {
        notes: 'All ingredients passed QA checks',
      });
      await loadList();
      setTab('approved');
      await refreshDetail();
    } catch (err: any) {
      setDetailError(apiError(err, 'Failed to approve consignment'));
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!detail || !rejectReason.trim()) return;
    setBusy(true);
    try {
      await axiosClient.post(`/quality/approvals/${detail.id}/reject`, {
        rejectionReason: rejectReason.trim(),
      });
      setRejectOpen(false);
      setRejectReason('');
      await loadList();
      await refreshDetail();
    } catch (err: any) {
      setDetailError(apiError(err, 'Failed to reject consignment'));
    } finally {
      setBusy(false);
    }
  };

  const deleteChecks = async () => {
    if (!detail) return;
    if (!window.confirm('Delete these quality checks and revert the consignment to RECEIVED?')) return;
    setBusy(true);
    try {
      await axiosClient.delete(`/quality/approvals/${detail.id}`);
      setDetail(null);
      setExpandedId(null);
      setSearchParams({}, { replace: true });
      await loadList();
    } catch (err: any) {
      setDetailError(apiError(err, 'Failed to delete quality checks'));
    } finally {
      setBusy(false);
    }
  };

  // ---- Render --------------------------------------------------------------

  const list = tab === 'pending' ? pending : approved;
  const approvalLocked = detail
    ? ['APPROVED', 'REJECTED'].includes(detail.status)
    : false;

  return (
    <div className="w-full mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Consignment QA</h2>
          <p className="text-[#737373] text-xs">
            Independent quality checks per ingredient, with proof-of-check attachments and consignment sign-off.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-[#E9E9E9] bg-white p-1">
          <button
            onClick={() => setTab('pending')}
            className={`px-3 h-7 rounded-md text-[10px] font-semibold transition-colors ${
              tab === 'pending' ? 'bg-[#AA3BFF] text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Awaiting QA ({pending.length})
          </button>
          <button
            onClick={() => setTab('approved')}
            className={`px-3 h-7 rounded-md text-[10px] font-semibold transition-colors ${
              tab === 'approved' ? 'bg-[#AA3BFF] text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Approved ({approved.length})
          </button>
        </div>
      </div>

      {listError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">
          {listError}
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[#E9E9E9] bg-white p-4">
              <Skeleton className="mb-3 h-4 w-48" />
              <Skeleton className="mb-2 h-3 w-full" />
              <Skeleton className="h-3 w-80" />
            </div>
          ))
        ) : list.length === 0 ? (
          <div className="rounded-xl border border-[#E9E9E9] bg-white">
            <EmptyState
              title={tab === 'pending' ? 'No consignments awaiting QA' : 'No approved consignments yet'}
              hint={
                tab === 'pending'
                  ? 'Received consignments will appear here for inspection.'
                  : 'Approved consignments appear here for distribution.'
              }
            />
          </div>
        ) : (
          list.map((consignment) => {
            const isOpen = expandedId === consignment.id;
            const approval = consignment.qualityApproval;
            const notStarted = !approval || consignment.status === 'RECEIVED';

            return (
              <div
                key={consignment.id}
                className="overflow-hidden rounded-xl border border-[#E9E9E9] bg-white"
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <button
                    onClick={() => openConsignment(consignment.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#AA3BFF]/10">
                      <ShieldCheck className="h-4 w-4 text-[#AA3BFF]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#171717]">
                        {consignment.consignmentNumber}
                      </p>
                      <p className="truncate text-[10px] text-slate-400">
                        {consignment.supplier?.name ?? '—'} → {consignment.warehouse?.name ?? '—'}
                        {consignment.receivedAt
                          ? ` · Received ${new Date(consignment.receivedAt).toLocaleDateString()}`
                          : ''}
                      </p>
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-2">
                    {approval ? (
                      <span
                        className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                          approvalStatusBadge[approval.status] || approvalStatusBadge.PENDING
                        }`}
                      >
                        QA: {approval.status}
                      </span>
                    ) : (
                      <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
                        Not started
                      </span>
                    )}
                    {notStarted && canMutate && (
                      <button
                        onClick={() => startChecks(consignment.id)}
                        disabled={busy}
                        className="rounded-lg bg-[#AA3BFF] px-2.5 h-7 text-[10px] font-semibold text-white hover:bg-[#9a2ff5] disabled:opacity-50"
                      >
                        Start checks
                      </button>
                    )}
                    <button
                      onClick={() => openConsignment(consignment.id)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="space-y-4 border-t border-slate-100 px-4 py-4">
                    {detailLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-24 w-full" />
                      </div>
                    ) : detailError ? (
                      <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        {detailError}
                      </div>
                    ) : !detail ? (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Clock className="h-4 w-4 text-slate-400" />
                        {canMutate
                          ? 'Quality checks have not been started for this consignment.'
                          : 'Quality checks have not been started yet.'}
                      </div>
                    ) : (
                      <>
                        {/* Summary */}
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                          <div className="rounded-xl border border-[#E9E9E9] bg-white p-3">
                            <p className="mb-1 text-[9px] font-semibold text-slate-500">Status</p>
                            <p className="text-sm font-bold text-slate-700">{detail.status}</p>
                          </div>
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                            <p className="mb-1 text-[9px] font-semibold text-emerald-600">
                              Ingredients passed
                            </p>
                            <p className="text-sm font-bold text-emerald-700">
                              {detail.summary.passedItems}/{detail.summary.totalItems}
                            </p>
                          </div>
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                            <p className="mb-1 text-[9px] font-semibold text-amber-600">Pending</p>
                            <p className="text-sm font-bold text-amber-700">
                              {detail.summary.pendingItems}
                            </p>
                          </div>
                          <div
                            className={`rounded-xl border p-3 ${
                              detail.summary.failedItems > 0
                                ? 'border-rose-200 bg-rose-50'
                                : 'border-[#E9E9E9] bg-white'
                            }`}
                          >
                            <p
                              className={`mb-1 text-[9px] font-semibold ${
                                detail.summary.failedItems > 0 ? 'text-rose-600' : 'text-slate-500'
                              }`}
                            >
                              Failed
                            </p>
                            <p
                              className={`text-sm font-bold ${
                                detail.summary.failedItems > 0 ? 'text-rose-700' : 'text-slate-700'
                              }`}
                            >
                              {detail.summary.failedItems}
                            </p>
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="rounded-xl border border-[#E9E9E9] bg-white p-4">
                          <div className="mb-2 flex justify-between">
                            <span className="text-xs font-semibold text-slate-600">
                              Overall completion · {detail.summary.totalChecks} check
                              {detail.summary.totalChecks === 1 ? '' : 's'}
                            </span>
                            <span className="text-xs font-bold text-slate-700">
                              {detail.summary.completionPercentage}%
                            </span>
                          </div>
                          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full bg-[#AA3BFF] transition-all"
                              style={{ width: `${detail.summary.completionPercentage}%` }}
                            />
                          </div>
                        </div>

                        {detail.rejectionReason && (
                          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                            <b>Rejected:</b> {detail.rejectionReason}
                          </div>
                        )}

                        {/* Ingredients */}
                        <div className="space-y-2">
                          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Ingredients ({detail.itemsByIngredient.length})
                          </h3>
                          {detail.itemsByIngredient.map((ingredient) => (
                            <IngredientCard
                              key={ingredient.consignmentItemId}
                              ingredient={ingredient}
                              approvalId={detail.id}
                              canMutate={canMutate}
                              approvalLocked={approvalLocked}
                              adjustment={
                                adjustmentsByItem.get(ingredient.consignmentItemId) ?? null
                              }
                              onSave={saveCheck}
                              onAddCheck={addCheck}
                              onUpload={uploadProof}
                              onDeleteAttachment={deleteAttachment}
                              onRequestChange={() => openChangeModal(ingredient)}
                            />
                          ))}
                        </div>

                        {/* Decision */}
                        {canMutate && !approvalLocked && (
                          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                            <button
                              onClick={approve}
                              disabled={
                                busy ||
                                detail.summary.pendingItems > 0 ||
                                detail.summary.failedItems > 0
                              }
                              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 h-9 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {busy ? (
                                <Loader className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                              Approve for release
                            </button>
                            <button
                              onClick={() => setRejectOpen(true)}
                              disabled={busy}
                              className="flex items-center gap-2 rounded-lg border border-rose-200 px-4 h-9 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </button>
                            {canDeleteChecks && (
                              <button
                                onClick={deleteChecks}
                                disabled={busy}
                                className="ml-auto flex items-center gap-2 rounded-lg px-3 h-9 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete checks
                              </button>
                            )}
                          </div>
                        )}

                        {detail.summary.failedItems > 0 && (
                          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[11px] text-rose-700">
                            {detail.summary.failedItems} ingredient(s) failed QA. Resolve or reject the
                            consignment before it can be released.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {rejectOpen && (
        <Modal onClose={() => setRejectOpen(false)}>
          <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-5">
            <h3 className="text-sm font-bold text-slate-700">Reject consignment?</h3>
            <p className="text-xs text-slate-600">
              The consignment stays blocked from inventory until re-inspected.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (required)"
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-rose-300"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setRejectOpen(false)}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={reject}
                disabled={busy || !rejectReason.trim()}
                className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {busy ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {changeFor && (
        <Modal onClose={() => setChangeFor(null)}>
          <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-5">
            <h3 className="text-sm font-bold text-slate-700">Request quantity change</h3>
            <p className="text-xs text-slate-500">
              {changeFor.material?.name} · current {changeFor.quantity} {changeFor.unitOfMeasure}
              {' '}· awaiting Head of QC approval before stock updates
            </p>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                New quantity
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={changeForm.newQuantity}
                onChange={(e) => setChangeForm({ ...changeForm, newQuantity: e.target.value })}
                className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-[#EA4335]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Reason
              </label>
              <select
                value={changeForm.reasonCode}
                onChange={(e) => setChangeForm({ ...changeForm, reasonCode: e.target.value })}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs focus:outline-none focus:border-[#EA4335]"
              >
                {QUANTITY_REASON_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={changeForm.reason}
              onChange={(e) => setChangeForm({ ...changeForm, reason: e.target.value })}
              placeholder="Notes (optional)"
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:border-[#EA4335]"
            />
            {changeError && <p className="text-[10px] text-rose-600">{changeError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => setChangeFor(null)}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={submitChange}
                disabled={changeBusy || !changeForm.newQuantity}
                className="flex-1 rounded-lg bg-[#EA4335] px-4 py-2 text-xs font-semibold text-white hover:bg-[#d3362a] disabled:opacity-50"
              >
                {changeBusy ? 'Submitting…' : 'Submit for approval'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
