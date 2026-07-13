import { create } from 'zustand';
import { db, type OfflineOrder } from '../lib/db';
import { syncEngine } from '../lib/syncEngine';

interface SfaState {
  orders: OfflineOrder[];
  isLoading: boolean;
  
  // Actions
  loadLocalOrders: () => Promise<void>;
  createOrder: (orderData: Omit<OfflineOrder, 'localId' | 'syncStatus' | 'updatedAt'>) => Promise<void>;
}

export const useSfaStore = create<SfaState>((set) => ({
  orders: [],
  isLoading: false,

  // 1. Hydrate UI from local Dexie database on startup
  loadLocalOrders: async () => {
    set({ isLoading: true });
    try {
      const localOrders = await db.orders.toArray();
      set({ orders: localOrders, isLoading: false });
    } catch (error) {
      console.error('Failed to load local orders', error);
      set({ isLoading: false });
    }
  },

  // 2. Handle new order creation (Online or Offline)
  createOrder: async (orderData) => {
    const newOrder: OfflineOrder = {
      ...orderData,
      localId: crypto.randomUUID(),
      syncStatus: 'pending_create', // Always assume pending until confirmed
      updatedAt: new Date().toISOString(),
    };

    // A. Update Local UI State instantly (Optimistic UI)
    set((state) => ({ orders: [newOrder, ...state.orders] }));

    // B. Persist to Dexie for offline safety
    await db.orders.add(newOrder);

    // C. Trigger the Sync Engine (it will check if online)
    syncEngine.pushOrders();
  },
}));
