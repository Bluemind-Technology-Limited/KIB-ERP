import { db } from './db';
import axios from 'axios';
import { useSfaStore } from '../stores/useSfaStore';

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
        const syncedRecords = response.data;

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
