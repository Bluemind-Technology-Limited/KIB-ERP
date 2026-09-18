import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, variant?: ToastVariant, duration?: number) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const DEFAULT_DURATIONS: Record<ToastVariant, number> = {
  success: 3500,
  error: 6000,
  info: 4000,
};

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  push: (message, variant = 'info', duration) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((state) => {
      // A single page load fires several parallel requests, so one outage can
      // reject several of them at once. Collapse identical back-to-back
      // messages instead of stacking duplicates.
      const last = state.toasts[state.toasts.length - 1];
      if (last && last.message === message && last.variant === variant) return state;
      return {
        toasts: [...state.toasts, { id, message, variant, duration: duration ?? DEFAULT_DURATIONS[variant] }],
      };
    });
    return id;
  },

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  clear: () => set({ toasts: [] }),
}));

/** Imperative API — usable from anywhere, including outside React. */
export const toast = {
  success: (message: string, duration?: number) => useToastStore.getState().push(message, 'success', duration),
  error: (message: string, duration?: number) => useToastStore.getState().push(message, 'error', duration),
  info: (message: string, duration?: number) => useToastStore.getState().push(message, 'info', duration),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
  clear: () => useToastStore.getState().clear(),
};
