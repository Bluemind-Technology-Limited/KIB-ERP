import { Modal } from './Modal';
import { Button } from './Button';

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
      <div className="w-full max-w-sm bg-surface rounded-xl shadow-lg p-6 space-y-4">
        {/* Header */}
        <div>
          <h3 className="text-sm font-bold text-ink">{title}</h3>
          <p className="mt-1 text-xs text-ink-muted">{description}</p>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 h-8 px-3 text-xs disabled:opacity-50"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="btn-3d flex-1 h-8 px-3 text-xs disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {isLoading ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                Delete
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
