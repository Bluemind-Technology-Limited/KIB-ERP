import { AlertCircle, X } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';

interface FailedItem {
  id: string;
  material: {
    name: string;
    sku: string;
  };
  checkType: string;
  remarks?: string;
  checkedBy?: {
    fullName: string;
  };
  checkedAt?: string;
}

interface FailedItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  failedItems: FailedItem[];
}

export default function FailedItemsModal({ isOpen, onClose, failedItems }: FailedItemsModalProps) {
  if (!isOpen) return null;

  return (
    <Modal onClose={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-slate-700">Failed QA Checks</h3>
              <p className="text-xs text-slate-500 mt-1">
                {failedItems.length} item(s) did not pass quality inspection
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Failed Items List */}
        <div className="space-y-2 border-t pt-4">
          {failedItems.map((item, idx) => (
            <div key={item.id} className="border border-rose-200 rounded-lg p-3 bg-rose-50">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-700">
                    {idx + 1}. {item.material?.name}
                  </p>
                  <p className="text-[9px] text-slate-500 mt-0.5">SKU: {item.material?.sku}</p>
                </div>
                <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded text-[9px] font-semibold">
                  FAILED
                </span>
              </div>

              {/* Check Details */}
              <div className="space-y-1 mt-2 bg-white rounded p-2 border border-rose-100">
                <div className="flex justify-between text-[9px]">
                  <span className="text-slate-600">Check Type:</span>
                  <span className="font-semibold text-slate-700">{item.checkType}</span>
                </div>
                {item.checkedBy && (
                  <div className="flex justify-between text-[9px]">
                    <span className="text-slate-600">Checked by:</span>
                    <span className="font-semibold text-slate-700">{item.checkedBy.fullName}</span>
                  </div>
                )}
                {item.checkedAt && (
                  <div className="flex justify-between text-[9px]">
                    <span className="text-slate-600">Date:</span>
                    <span className="font-semibold text-slate-700">
                      {new Date(item.checkedAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Remarks */}
              {item.remarks && (
                <div className="mt-2">
                  <p className="text-[9px] font-semibold text-slate-600 mb-1">Issue Details:</p>
                  <p className="text-xs text-rose-700 bg-white rounded p-2 border border-rose-100">
                    {item.remarks}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Action */}
        <div className="border-t pt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-lg hover:bg-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
