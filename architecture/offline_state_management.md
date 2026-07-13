# Offline-First Architecture & State Management

This document details the **Three-Tier State Architecture** designed for offline-first resilience across both the ERP (batch processing) and SFA (field tracking) modules.

```
+------------------------------------------+
|            Zustand (Presenter)           |  <--- Fast, reactive, ephemeral UI state
+--------------------+---------------------+
                     | (Reads & Writes)
                     v
+------------------------------------------+
|       Dexie.js / IndexedDB (Vault)       |  <--- Local persistent storage (source of truth offline)
+--------------------+---------------------+
                     | (Syncs when online)
                     v
+------------------------------------------+
|          Sync Engine (Courier)           |  <--- Watches network status & coordinates API requests
+--------------------+---------------------+
                     | (REST / Postgres)
                     v
+------------------------------------------+
|          PostgreSQL Database Backend     |  <--- Central remote data store
+------------------------------------------+
```

---

## 1. Local Database Vault Setup (`src/lib/db.ts`)

Defines the IndexedDB schemas using Dexie.js.

```typescript
import Dexie, { Table } from 'dexie';
import { CustomerVisit, SfaOrder, ErpBatch } from '@/types'; // Import strict types

// Local sync status extensions
export interface SyncableRecord {
  localId?: string; // UUID generated locally before backend sync
  syncStatus: 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';
  updatedAt: string;
}

export type OfflineVisit = CustomerVisit & SyncableRecord;
export type OfflineOrder = SfaOrder & SyncableRecord;

class KIBLocalDatabase extends Dexie {
  visits!: Table<OfflineVisit, string>;
  orders!: Table<OfflineOrder, string>;
  batches!: Table<ErpBatch & SyncableRecord, string>;

  constructor() {
    super('KIB_Ecosystem_DB');
    
    // Define the schema: index the fields that are queried
    this.version(1).stores({
      visits: 'localId, rep_id, syncStatus, created_at',
      orders: 'localId, distributor_id, syncStatus',
      batches: 'localId, status, syncStatus'
    });
  }
}

export const db = new KIBLocalDatabase();
```

---

## 2. Zustand Store Interface (`src/stores/useSfaStore.ts`)

Updates the UI instantly (Optimistic UI updates), writes directly to Dexie, and initiates the Sync Engine automatically.

```typescript
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { db, OfflineOrder } from '@/lib/db';
import { syncEngine } from '@/lib/syncEngine';

interface SfaState {
  orders: OfflineOrder[];
  isLoading: boolean;
  
  // Actions
  loadLocalOrders: () => Promise<void>;
  createOrder: (orderData: Omit<OfflineOrder, 'localId' | 'syncStatus'>) => Promise<void>;
}

export const useSfaStore = create<SfaState>((set, get) => ({
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
      localId: uuidv4(),
      syncStatus: 'pending_create', // Always assume pending until confirmed
      updatedAt: new Date().toISOString(),
    };

    // A. Update Local UI State instantly (Optimistic UI)
    set((state) => ({ orders: [newOrder, ...state.orders] }));

    // B. Persist to Dexie for offline safety
    await db.orders.add(newOrder);

    // C. Trigger the Sync Engine (which determines if online)
    syncEngine.pushOrders();
  },
}));
```

---

## 3. Background Sync Engine (`src/lib/syncEngine.ts`)

Coordinates connection state monitoring and runs transactional synchronization routines.

```typescript
import { db } from './db';
import axios from 'axios';
import { useSfaStore } from '@/stores/useSfaStore';

export const syncEngine = {
  // Push pending orders to the central PostgreSQL database
  pushOrders: async () => {
    if (!navigator.onLine) return; // Exit if offline

    try {
      // Find all records waiting to be created on the server
      const pendingOrders = await db.orders
        .where('syncStatus')
        .equals('pending_create')
        .toArray();

      if (pendingOrders.length === 0) return;

      // Send to backend API
      const response = await axios.post('/api/sfa/orders/bulk-sync', pendingOrders);

      if (response.status === 200) {
        const syncedRecords = response.data; // Backend returns newly assigned server IDs

        // Update Dexie to mark them as synced
        await db.transaction('rw', db.orders, async () => {
          for (const record of syncedRecords) {
            await db.orders.update(record.localId, {
              syncStatus: 'synced',
              id: record.server_id // Assign the real PostgreSQL ID
            });
          }
        });

        // Refresh Zustand UI to reflect synced status
        useSfaStore.getState().loadLocalOrders();
      }
    } catch (error) {
      console.error('Background sync failed, will retry later:', error);
    }
  },

  // Setup global event listeners
  initListeners: () => {
    window.addEventListener('online', () => {
      console.log('Network restored. Initiating background sync...');
      syncEngine.pushOrders();
    });
  }
};
```

---

## 4. Initialization & Connection Monitoring (`src/App.tsx`)

Hooks up the listeners and hydrators at the root level of the app layout.

```tsx
import { useEffect } from 'react';
import { syncEngine } from '@/lib/syncEngine';
import { useSfaStore } from '@/stores/useSfaStore';

export default function SfaAppLayout({ children }) {
  const loadLocalOrders = useSfaStore((state) => state.loadLocalOrders);

  useEffect(() => {
    // 1. Load cached data instantly for snappy UX
    loadLocalOrders();

    // 2. Start listening for network reconnects
    syncEngine.initListeners();

    // 3. Attempt an initial sync just in case
    syncEngine.pushOrders();
  }, [loadLocalOrders]);

  return (
    <div className="min-h-screen bg-kib-slate">
      {/* Network Status Indicator */}
      {!navigator.onLine && (
        <div className="bg-amber-500 text-white text-center py-1 text-sm">
          Offline Mode - Changes saved locally
        </div>
      )}
      {children}
    </div>
  );
}
```
