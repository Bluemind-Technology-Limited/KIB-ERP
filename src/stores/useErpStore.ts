import { create } from 'zustand';
import { type ErpBatch } from '../types';

interface ErpState {
  batches: ErpBatch[];
  isLoading: boolean;
  setBatches: (batches: ErpBatch[]) => void;
  updateBatchStatus: (batchId: string, status: ErpBatch['status']) => void;
}

export const useErpStore = create<ErpState>((set) => ({
  batches: [],
  isLoading: false,
  setBatches: (batches) => set({ batches }),
  updateBatchStatus: (batchId, status) => set((state) => ({
    batches: state.batches.map((b) => b.id === batchId ? { ...b, status } : b)
  })),
}));
