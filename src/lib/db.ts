import Dexie, { type Table } from 'dexie';
import { type CustomerVisit, type SfaOrder, type ErpBatch } from '../types';

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
    
    // Define the schema: only index the fields you query by
    this.version(1).stores({
      visits: 'localId, rep_id, syncStatus, created_at',
      orders: 'localId, distributor_id, syncStatus',
      batches: 'localId, status, syncStatus'
    });
  }
}

export const db = new KIBLocalDatabase();
