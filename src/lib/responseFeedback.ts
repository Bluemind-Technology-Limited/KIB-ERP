import type { AxiosError, AxiosResponse } from 'axios';
import { toast } from '../stores/useToastStore';
import { toUserMessage } from './httpMessages';

/** Default success copy for mutating requests (reads stay silent). */
const MUTATION_SUCCESS_MESSAGES: Record<string, string> = {
  post: 'Saved successfully',
  put: 'Saved successfully',
  patch: 'Saved successfully',
  delete: 'Deleted successfully',
};

/**
 * Raises the success toast for a mutating request. Reads (GET/HEAD) stay
 * silent so page loads don't spam notifications, and a caller can customise or
 * suppress the message with `{ toast: { success: '…' } }` / `{ toast: false }`.
 */
export function toastSuccessFor(response: AxiosResponse): void {
  const method = (response.config.method ?? '').toLowerCase();
  const fallback = MUTATION_SUCCESS_MESSAGES[method];
  const toastOption = response.config.toast;

  if (!fallback || toastOption === false) return;

  const message = typeof toastOption === 'object' ? toastOption.success ?? fallback : fallback;
  toast.success(message);
}

/**
 * Rewrites a failed request so no raw backend or axios text can reach the UI —
 * every existing `err.response.data.error` / `err.message` read in the app then
 * resolves to the friendly sentence — and raises a single error toast.
 */
export function normalizeAndToastRejection(error: AxiosError): void {
  const message = toUserMessage(error);

  if (error instanceof Error) {
    error.message = message;
  }

  if (error?.response) {
    const { data } = error.response;
    // `data` can be a non-object (e.g. an HTML error page), so rebuild it.
    error.response.data =
      data && typeof data === 'object' ? { ...data, error: message } : { error: message };
  }

  if (error?.config?.toast !== false) {
    toast.error(message);
  }
}
