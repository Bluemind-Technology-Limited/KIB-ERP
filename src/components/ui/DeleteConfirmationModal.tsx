import { Trash2 } from 'lucide-react';
import { Modal } from './Modal';

interface DeleteConfirmationModalProps {
  title: string;
  description?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function DeleteConfirmationModal({
  title,
  description = 'This action cannot be undone.',
  onConfirm,
  onCancel,
  isLoading = false,
}: DeleteConfirmationModalProps) {
  return (
    <Modal onClose={onCancel}>
      <div className="w-full max-w-sm bg-white rounded-xl shadow-lg p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#171717]">{title}</h3>
            <p className="text-xs text-slate-500 mt-1">{description}</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 h-8 px-3 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 h-8 px-3 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
          >
            {isLoading ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-3 h-3" />
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
