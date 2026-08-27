import { AlertCircle, CheckCircle2, Trash2, Plus, Save } from 'lucide-react';
import { Modal } from './Modal';

type ConfirmationType = 'delete' | 'create' | 'update' | 'submit' | 'action';

interface ConfirmationModalProps {
  type: ConfirmationType;
  title: string;
  description?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  confirmText?: string;
  cancelText?: string;
}

const getIcon = (type: ConfirmationType) => {
  switch (type) {
    case 'delete':
      return { Icon: Trash2, bgClass: 'bg-rose-100', iconClass: 'text-rose-600', buttonClass: 'bg-rose-600 hover:bg-rose-700' };
    case 'create':
      return { Icon: Plus, bgClass: 'bg-emerald-100', iconClass: 'text-emerald-600', buttonClass: 'bg-emerald-600 hover:bg-emerald-700' };
    case 'update':
    case 'submit':
      return { Icon: Save, bgClass: 'bg-sky-100', iconClass: 'text-sky-600', buttonClass: 'bg-sky-600 hover:bg-sky-700' };
    case 'action':
      return { Icon: CheckCircle2, bgClass: 'bg-blue-100', iconClass: 'text-blue-600', buttonClass: 'bg-blue-600 hover:bg-blue-700' };
    default:
      return { Icon: AlertCircle, bgClass: 'bg-slate-100', iconClass: 'text-slate-600', buttonClass: 'bg-slate-600 hover:bg-slate-700' };
  }
};

export function ConfirmationModal({
  type,
  title,
  description = 'Are you sure you want to proceed?',
  onConfirm,
  onCancel,
  isLoading = false,
  confirmText,
  cancelText = 'Cancel',
}: ConfirmationModalProps) {
  const { Icon, bgClass, iconClass, buttonClass } = getIcon(type);

  const defaultConfirmText = {
    delete: 'Delete',
    create: 'Create',
    update: 'Save',
    submit: 'Submit',
    action: 'Confirm',
  }[type];

  const finalConfirmText = confirmText || defaultConfirmText;

  return (
    <Modal onClose={onCancel}>
      <div className="w-full max-w-sm bg-white rounded-xl shadow-lg p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 w-10 h-10 rounded-full ${bgClass} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${iconClass}`} />
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
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 h-8 px-3 rounded-lg ${buttonClass} text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1`}
          >
            {isLoading ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {type === 'delete' ? 'Deleting...' : type === 'create' ? 'Creating...' : type === 'update' ? 'Saving...' : 'Processing...'}
              </>
            ) : (
              <>
                <Icon className="w-3 h-3" />
                {finalConfirmText}
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
