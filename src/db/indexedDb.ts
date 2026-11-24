import type { TyreBookSnapshot } from '../types/models';

const DB_NAME = 'tyrebook_ng_db';
const DB_VERSION = 1;
const SNAPSHOT_STORE = 'snapshots';
const SNAPSHOT_KEY = 'primary';
const LS_FALLBACK_KEY = 'tyrebook_ng_snapshot_v1';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        db.createObjectStore(SNAPSHOT_STORE);
      }
      // Also create normalized stores for structured table inspection & future per-record indexing
      const stores = ['inventory', 'customers', 'credit_contracts', 'payments', 'cash_sales'];
      for (const storeName of stores) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

export async function loadSnapshotFromLocal(): Promise<TyreBookSnapshot | null> {
  try {
    const db = await openDatabase();
    return await new Promise<TyreBookSnapshot | null>((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
      const store = tx.objectStore(SNAPSHOT_STORE);
      const req = store.get(SNAPSHOT_KEY);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as TyreBookSnapshot | undefined) ?? null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    try {
      const raw = localStorage.getItem(LS_FALLBACK_KEY);
      return raw ? (JSON.parse(raw) as TyreBookSnapshot) : null;
    } catch {
      return null;
    }
  }
}

export async function saveSnapshotToLocal(snapshot: TyreBookSnapshot): Promise<void> {
  const stamped: TyreBookSnapshot = {
    ...snapshot,
    exported_at: new Date().toISOString(),
  };

  // Always mirror compact backup in LocalStorage as secondary resilience
  try {
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(stamped));
  } catch {
    // Ignore quota errors on fallback mirror
  }

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        [SNAPSHOT_STORE, 'inventory', 'customers', 'credit_contracts', 'payments', 'cash_sales'],
        'readwrite'
      );

      tx.objectStore(SNAPSHOT_STORE).put(stamped, SNAPSHOT_KEY);

      const syncTable = <T extends { id: string }>(storeName: string, rows: T[]) => {
        const os = tx.objectStore(storeName);
        os.clear();
        for (const row of rows) {
          os.put(row);
        }
      };

      syncTable('inventory', stamped.inventory);
      syncTable('customers', stamped.customers);
      syncTable('credit_contracts', stamped.credit_contracts);
      syncTable('payments', stamped.payments);
      syncTable('cash_sales', stamped.cash_sales);

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // LocalStorage mirror already succeeded
  }
}

export function validateBackupJson(raw: unknown): { valid: true; data: TyreBookSnapshot } | { valid: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Backup file is not a valid JSON object.' };
  }
  const obj = raw as Partial<TyreBookSnapshot>;
  if (
    !Array.isArray(obj.inventory) ||
    !Array.isArray(obj.customers) ||
    !Array.isArray(obj.credit_contracts) ||
    !Array.isArray(obj.payments) ||
    !Array.isArray(obj.cash_sales)
  ) {
    return {
      valid: false,
      error: 'Missing required TyreBook tables (inventory, customers, credit_contracts, payments, cash_sales).',
    };
  }

  const normalized: TyreBookSnapshot = {
    version: typeof obj.version === 'number' ? obj.version : 1,
    exported_at: typeof obj.exported_at === 'string' ? obj.exported_at : new Date().toISOString(),
    inventory: obj.inventory,
    customers: obj.customers,
    credit_contracts: obj.credit_contracts,
    payments: obj.payments,
    cash_sales: obj.cash_sales,
    meta: {
      shop_name: obj.meta?.shop_name || 'My Tyre Shop',
      is_sample_data: Boolean(obj.meta?.is_sample_data),
      last_synced_at: obj.meta?.last_synced_at ?? null,
      last_backup_at: new Date().toISOString(),
      pending_sync_count: obj.meta?.pending_sync_count ?? 0,
    },
  };

  return { valid: true, data: normalized };
}
