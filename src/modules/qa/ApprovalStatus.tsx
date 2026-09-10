import { CheckCircle2, AlertCircle, Clock, XCircle } from 'lucide-react';

interface ApprovalStatusProps {
  status: string;
  passedItems: number;
  failedItems: number;
  totalItems: number;
  completionPercentage: number;
  approvedAt?: string;
  rejectionReason?: string;
  notes?: string;
}

export default function ApprovalStatus({
  status,
  passedItems,
  failedItems,
  totalItems,
  completionPercentage,
  approvedAt,
  rejectionReason,
  notes,
}: ApprovalStatusProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle2 className="w-6 h-6 text-green-600" />;
      case 'REJECTED':
        return <XCircle className="w-6 h-6 text-rose-600" />;
      case 'FAILED':
        return <AlertCircle className="w-6 h-6 text-rose-600" />;
      case 'IN_PROGRESS':
        return <Clock className="w-6 h-6 text-blue-600" />;
      default:
        return <Clock className="w-6 h-6 text-slate-600" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-50 border-green-200 text-green-700';
      case 'REJECTED':
        return 'bg-rose-50 border-rose-200 text-rose-700';
      case 'FAILED':
        return 'bg-rose-50 border-rose-200 text-rose-700';
      case 'IN_PROGRESS':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'APPROVED':
        return '✓ Approved - Ready for Distribution';
      case 'REJECTED':
        return '✗ Rejected';
      case 'FAILED':
        return '⚠ Failed Checks';
      case 'IN_PROGRESS':
        return '◐ In Progress';
      case 'PENDING':
        return '○ Pending Review';
      default:
        return status;
    }
  };

  return (
    <div className={`rounded-xl border p-4 ${getStatusColor()}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <div>
            <p className="font-bold text-sm">{getStatusLabel()}</p>
            {approvedAt && (
              <p className="text-[9px] opacity-75">
                {status === 'APPROVED' ? 'Approved on' : 'Updated on'} {new Date(approvedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {status !== 'REJECTED' && (
        <div className="mb-3">
          <div className="flex justify-between mb-1">
            <span className="text-[9px] font-semibold opacity-75">Completion</span>
            <span className="text-[9px] font-bold opacity-75">{completionPercentage}%</span>
          </div>
          <div className="w-full h-2 bg-black/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-current opacity-50 transition-all"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="opacity-75">
          <p className="text-[9px] font-semibold mb-0.5">Total</p>
          <p className="text-sm font-bold">{totalItems}</p>
        </div>
        <div className="opacity-75">
          <p className="text-[9px] font-semibold mb-0.5">Passed</p>
          <p className="text-sm font-bold text-green-600">{passedItems}</p>
        </div>
        <div className="opacity-75">
          <p className="text-[9px] font-semibold mb-0.5">Failed</p>
          <p className="text-sm font-bold text-rose-600">{failedItems}</p>
        </div>
      </div>

      {/* Rejection Reason */}
      {rejectionReason && (
        <div className="border-t border-current opacity-25 pt-3">
          <p className="text-[9px] font-semibold opacity-75 mb-1">Rejection Reason:</p>
          <p className="text-xs opacity-75">{rejectionReason}</p>
        </div>
      )}

      {/* Notes */}
      {notes && (
        <div className="border-t border-current opacity-25 pt-3">
          <p className="text-[9px] font-semibold opacity-75 mb-1">Notes:</p>
          <p className="text-xs opacity-75">{notes}</p>
        </div>
      )}
    </div>
  );
}
