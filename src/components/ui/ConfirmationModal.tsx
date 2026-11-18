import { Modal } from './Modal';
import { Button } from './Button';

type ConfirmationType = 'delete' | 'create' | 'update' | 'submit' | 'action';

interface ConfirmationModalProps {
  type: ConfirmationType;
  title: string;
  message?: string;
  description?: string;
  isOpen?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  /** Validation/API error to display inside the confirmation modal. */
  error?: string;
}

export function ConfirmationModal({
  type,
  title,
  message,
  description,
  onConfirm,
  onCancel,
  isLoading = false,
  confirmText,
  cancelText = 'Cancel',
  error,
}: ConfirmationModalProps) {
  const displayMessage = message || description || 'Are you sure you want to proceed?';

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
      <div className="w-full max-w-sm space-y-4 rounded-xl bg-surface p-6 shadow-lg">
        <div>
          <h3 className="text-sm font-bold text-ink">{title}</h3>
          <p className="mt-1 text-xs text-ink-muted">{displayMessage}</p>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            onClick={onCancel}
            disabled={isLoading}
            className="h-8 flex-1 px-3 text-xs disabled:opacity-50"
          >
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="btn-3d h-8 flex-1 px-3 disabled:opacity-50"
          >
            <span className="text-xs font-semibold text-white">
              {isLoading
                ? type === 'delete'
                  ? 'Deleting…'
                  : type === 'create'
                    ? 'Creating…'
                    : type === 'update'
                      ? 'Saving…'
                      : 'Processing…'
                : finalConfirmText}
            </span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
