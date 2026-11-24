import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createEmptySnapshot, createSampleSnapshot } from '../data/sampleData';
import { loadSnapshotFromLocal, saveSnapshotToLocal, validateBackupJson } from '../db/indexedDb';
import { createSyncProvider } from '../services/syncAdapter';
import type {
  CashSale,
  CreditContract,
  Customer,
  InventoryItem,
  Payment,
  ReceiptData,
  SyncStatusMode,
  TyreBookSnapshot,
  TyreCondition,
} from '../types/models';
import { formatNaira, generateId, isSameLocalDay } from '../utils/format';
import { useOnlineStatus } from './useOnlineStatus';

export interface ActionResult<T = void> {
  ok: boolean;
  error?: string;
  data?: T;
}

export function useTyreBookStore() {
  const isOnline = useOnlineStatus();
  const syncProviderRef = useRef(createSyncProvider());
  const [snapshot, setSnapshot] = useState<TyreBookSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string>('');

  // Load persisted IndexedDB snapshot on mount, or seed Nigerian sample dataset on first launch
  useEffect(() => {
    let active = true;
    (async () => {
      const existing = await loadSnapshotFromLocal();
      if (!active) return;
      if (existing) {
        setSnapshot(existing);
      } else {
        const seeded = createSampleSnapshot();
        await saveSnapshotToLocal(seeded);
        if (active) setSnapshot(seeded);
      }
      setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const commit = useCallback(
    (updater: (prev: TyreBookSnapshot) => TyreBookSnapshot) => {
      setSnapshot((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        const provider = syncProviderRef.current;
        const withSyncMeta: TyreBookSnapshot = {
          ...next,
          exported_at: new Date().toISOString(),
          meta: {
            ...next.meta,
            pending_sync_count:
              provider.providerName === 'supabase'
                ? next.meta.pending_sync_count + 1
                : 0,
            last_synced_at:
              isOnline && provider.providerName === 'local'
                ? new Date().toISOString()
                : next.meta.last_synced_at,
          },
        };
        void saveSnapshotToLocal(withSyncMeta);

        if (isOnline && provider.providerName === 'supabase' && provider.isConfigured()) {
          void provider.pushSnapshot(withSyncMeta).then((res) => {
            setSyncMessage(res.message);
            if (res.success && res.syncedAt) {
              setSnapshot((latest) => {
                if (!latest) return latest;
                const synced: TyreBookSnapshot = {
                  ...latest,
                  meta: {
                    ...latest.meta,
                    last_synced_at: res.syncedAt,
                    pending_sync_count: 0,
                  },
                };
                void saveSnapshotToLocal(synced);
                return synced;
              });
            }
          });
        }
        return withSyncMeta;
      });
    },
    [isOnline]
  );

  // Sync status mode for top bar indicator
  const syncStatus: SyncStatusMode = useMemo(() => {
    if (!isOnline) return 'offline';
    if (isSyncing) return 'syncing';
    const provider = syncProviderRef.current;
    if (provider.providerName === 'supabase' && provider.isConfigured()) {
      return (snapshot?.meta.pending_sync_count ?? 0) === 0 ? 'backed_up' : 'saved_locally';
    }
    return snapshot?.meta.last_backup_at ? 'backed_up' : 'saved_locally';
  }, [isOnline, isSyncing, snapshot?.meta.pending_sync_count, snapshot?.meta.last_backup_at]);

  const syncNow = useCallback(async (): Promise<ActionResult<string>> => {
    if (!snapshot) return { ok: false, error: 'Database not ready.' };
    if (!isOnline) {
      const msg = 'Offline — All data is safely stored locally in IndexedDB.';
      setSyncMessage(msg);
      return { ok: false, error: msg };
    }
    setIsSyncing(true);
    try {
      const res = await syncProviderRef.current.pushSnapshot(snapshot);
      setSyncMessage(res.message);
      if (res.success && res.syncedAt) {
        setSnapshot((prev) => {
          if (!prev) return prev;
          const synced: TyreBookSnapshot = {
            ...prev,
            meta: {
              ...prev.meta,
              last_synced_at: res.syncedAt,
              pending_sync_count: 0,
            },
          };
          void saveSnapshotToLocal(synced);
          return synced;
        });
      }
      return { ok: res.success, data: res.message, error: res.success ? undefined : res.message };
    } finally {
      setIsSyncing(false);
    }
  }, [snapshot, isOnline]);

  // --- Inventory Actions ---
  const addTyre = useCallback(
    (input: {
      brand: string;
      size: string;
      condition: TyreCondition;
      stock_qty: number;
      cash_price: number;
      credit_price: number;
    }): ActionResult<InventoryItem> => {
      const brand = input.brand.trim();
      const size = input.size.trim().toUpperCase();
      if (!brand || !size) {
        return { ok: false, error: 'Brand and tyre size are required.' };
      }
      if (input.stock_qty < 0) {
        return { ok: false, error: 'Stock quantity cannot be negative.' };
      }
      if (input.cash_price <= 0 || input.credit_price <= 0) {
        return { ok: false, error: 'Cash and credit prices must be greater than ₦0.' };
      }

      const item: InventoryItem = {
        id: generateId('inv'),
        brand,
        size,
        condition: input.condition,
        stock_qty: Math.floor(input.stock_qty),
        cash_price: Math.round(input.cash_price),
        credit_price: Math.round(input.credit_price),
      };

      commit((prev) => ({
        ...prev,
        inventory: [item, ...prev.inventory],
      }));
      return { ok: true, data: item };
    },
    [commit]
  );

  const restockTyre = useCallback(
    (tyreId: string, addQty: number): ActionResult => {
      const delta = Math.floor(addQty);
      if (delta <= 0) {
        return { ok: false, error: 'Restock quantity must be at least 1.' };
      }
      commit((prev) => ({
        ...prev,
        inventory: prev.inventory.map((t) =>
          t.id === tyreId ? { ...t, stock_qty: Math.max(0, t.stock_qty + delta) } : t
        ),
      }));
      return { ok: true };
    },
    [commit]
  );

  // --- Customer Actions ---
  const addCustomer = useCallback(
    (input: {
      full_name: string;
      phone: string;
      location: string;
      guarantor_name: string;
      guarantor_phone: string;
    }): ActionResult<Customer> => {
      const full_name = input.full_name.trim();
      const phone = input.phone.trim();
      if (!full_name || !phone) {
        return { ok: false, error: 'Customer full name and phone number are required.' };
      }
      const customer: Customer = {
        id: generateId('cust'),
        full_name,
        phone,
        location: input.location.trim() || 'Not specified',
        guarantor_name: input.guarantor_name.trim() || 'Not provided',
        guarantor_phone: input.guarantor_phone.trim() || 'Not provided',
        has_active_debt: false,
      };
      commit((prev) => ({
        ...prev,
        customers: [customer, ...prev.customers],
      }));
      return { ok: true, data: customer };
    },
    [commit]
  );

  // --- Credit Sale (Tab 1) ---
  const createCreditSale = useCallback(
    (input: {
      customer_id: string;
      tyre_id: string;
      qty: number;
      deposit: number;
      daily_installment: number;
    }): ActionResult<CreditContract> => {
      if (!snapshot) return { ok: false, error: 'Store not loaded.' };
      const customer = snapshot.customers.find((c) => c.id === input.customer_id);
      if (!customer) return { ok: false, error: 'Selected customer was not found.' };

      // STRICT RULE: Single active debt lock
      const existingActive = snapshot.credit_contracts.find(
        (c) => c.customer_id === customer.id && c.status === 'Active'
      );
      if (customer.has_active_debt || existingActive) {
        const rem = existingActive ? formatNaira(existingActive.balance) : 'an active balance';
        return {
          ok: false,
          error: `${customer.full_name} already has an active credit balance of ${rem}. Clear existing debt first.`,
        };
      }

      const tyre = snapshot.inventory.find((t) => t.id === input.tyre_id);
      if (!tyre) return { ok: false, error: 'Selected tyre was not found.' };

      const qty = Math.floor(input.qty);
      if (qty <= 0) return { ok: false, error: 'Quantity must be at least 1.' };
      if (tyre.stock_qty < qty) {
        return {
          ok: false,
          error: `Insufficient stock: only ${tyre.stock_qty} unit(s) available.`,
        };
      }

      const total_price = tyre.credit_price * qty;
      const deposit = Math.max(0, Math.round(input.deposit));
      const daily_installment = Math.round(input.daily_installment);

      if (deposit >= total_price) {
        return {
          ok: false,
          error: 'Deposit covers the full credit price. Record this under Cash Sale instead.',
        };
      }
      if (daily_installment <= 0) {
        return { ok: false, error: 'Daily installment must be greater than ₦0.' };
      }

      const balance = total_price - deposit;
      const contract: CreditContract = {
        id: generateId('con'),
        customer_id: customer.id,
        tyre_id: tyre.id,
        tyre_description: `${qty}x ${tyre.brand} ${tyre.size} (${tyre.condition})`,
        qty,
        total_price,
        deposit,
        daily_installment,
        amount_paid: deposit,
        balance,
        start_date: new Date().toISOString(),
        status: 'Active',
      };

      commit((prev) => ({
        ...prev,
        inventory: prev.inventory.map((t) =>
          t.id === tyre.id ? { ...t, stock_qty: Math.max(0, t.stock_qty - qty) } : t
        ),
        customers: prev.customers.map((c) =>
          c.id === customer.id ? { ...c, has_active_debt: true } : c
        ),
        credit_contracts: [contract, ...prev.credit_contracts],
      }));

      return { ok: true, data: contract };
    },
    [snapshot, commit]
  );

  // --- Cash Sale (Tab 2) ---
  const createCashSale = useCallback(
    (input: { tyre_id: string; qty: number }): ActionResult<CashSale> => {
      if (!snapshot) return { ok: false, error: 'Store not loaded.' };
      const tyre = snapshot.inventory.find((t) => t.id === input.tyre_id);
      if (!tyre) return { ok: false, error: 'Selected tyre was not found.' };

      const qty = Math.floor(input.qty);
      if (qty <= 0) return { ok: false, error: 'Quantity must be at least 1.' };
      if (tyre.stock_qty < qty) {
        return {
          ok: false,
          error: `Insufficient stock: only ${tyre.stock_qty} unit(s) available.`,
        };
      }

      const sale: CashSale = {
        id: generateId('cash'),
        tyre_id: tyre.id,
        tyre_description: `${tyre.brand} ${tyre.size} (${tyre.condition})`,
        qty,
        unit_price: tyre.cash_price,
        total_amount: tyre.cash_price * qty,
        sold_at: new Date().toISOString(),
      };

      commit((prev) => ({
        ...prev,
        inventory: prev.inventory.map((t) =>
          t.id === tyre.id ? { ...t, stock_qty: Math.max(0, t.stock_qty - qty) } : t
        ),
        cash_sales: [sale, ...prev.cash_sales],
      }));

      return { ok: true, data: sale };
    },
    [snapshot, commit]
  );

  // --- Opening Balance Migration (Tab 3: No inventory deduction) ---
  const createOpeningMigration = useCallback(
    (input: {
      customer_id: string;
      tyre_description: string;
      qty: number;
      remaining_balance: number;
      daily_installment: number;
      start_date?: string;
    }): ActionResult<CreditContract> => {
      if (!snapshot) return { ok: false, error: 'Store not loaded.' };
      const customer = snapshot.customers.find((c) => c.id === input.customer_id);
      if (!customer) return { ok: false, error: 'Selected customer was not found.' };

      const existingActive = snapshot.credit_contracts.find(
        (c) => c.customer_id === customer.id && c.status === 'Active'
      );
      if (customer.has_active_debt || existingActive) {
        const rem = existingActive ? formatNaira(existingActive.balance) : 'an active balance';
        return {
          ok: false,
          error: `${customer.full_name} already has an active debt (${rem}). Cannot add a second active contract.`,
        };
      }

      const remaining_balance = Math.round(input.remaining_balance);
      const daily_installment = Math.round(input.daily_installment);
      if (remaining_balance <= 0) {
        return { ok: false, error: 'Current remaining balance must be greater than ₦0.' };
      }
      if (daily_installment <= 0) {
        return { ok: false, error: 'Daily installment must be greater than ₦0.' };
      }

      const startIso = input.start_date
        ? new Date(`${input.start_date}T09:00:00`).toISOString()
        : new Date().toISOString();

      const contract: CreditContract = {
        id: generateId('mig'),
        customer_id: customer.id,
        tyre_description: input.tyre_description.trim() || 'Migrated Notebook Balance',
        qty: Math.max(1, Math.floor(input.qty || 1)),
        total_price: remaining_balance,
        deposit: 0,
        daily_installment,
        amount_paid: 0,
        balance: remaining_balance,
        start_date: startIso,
        status: 'Active',
        is_opening_migration: true,
      };

      commit((prev) => ({
        ...prev,
        customers: prev.customers.map((c) =>
          c.id === customer.id ? { ...c, has_active_debt: true } : c
        ),
        credit_contracts: [contract, ...prev.credit_contracts],
      }));

      return { ok: true, data: contract };
    },
    [snapshot, commit]
  );

  // --- Record Installment Payment ---
  const recordPayment = useCallback(
    (contractId: string, rawAmount: number): ActionResult<ReceiptData> => {
      if (!snapshot) return { ok: false, error: 'Store not loaded.' };
      const contract = snapshot.credit_contracts.find((c) => c.id === contractId);
      if (!contract) return { ok: false, error: 'Credit contract not found.' };
      if (contract.status === 'Paid' || contract.balance <= 0) {
        return { ok: false, error: 'This credit contract is already fully paid.' };
      }

      const customer = snapshot.customers.find((c) => c.id === contract.customer_id);
      if (!customer) return { ok: false, error: 'Customer not found.' };

      const amount = Math.round(rawAmount);
      if (amount <= 0) {
        return { ok: false, error: 'Payment amount must be greater than ₦0.' };
      }
      if (amount > contract.balance) {
        return {
          ok: false,
          error: `Amount exceeds remaining balance of ${formatNaira(contract.balance)}.`,
        };
      }

      const paidAt = new Date().toISOString();
      const newBalance = Math.max(0, contract.balance - amount);
      const newStatus: CreditContract['status'] = newBalance === 0 ? 'Paid' : 'Active';

      const payment: Payment = {
        id: generateId('pay'),
        contract_id: contract.id,
        customer_id: customer.id,
        amount,
        paid_at: paidAt,
        status: 'Valid',
      };

      commit((prev) => ({
        ...prev,
        payments: [payment, ...prev.payments],
        credit_contracts: prev.credit_contracts.map((c) =>
          c.id === contract.id
            ? {
                ...c,
                amount_paid: c.amount_paid + amount,
                balance: newBalance,
                status: newStatus,
              }
            : c
        ),
        customers: prev.customers.map((cust) =>
          cust.id === customer.id
            ? { ...cust, has_active_debt: newBalance > 0 }
            : cust
        ),
      }));

      return {
        ok: true,
        data: {
          paymentId: payment.id,
          customerName: customer.full_name,
          customerPhone: customer.phone,
          tyreDescription: contract.tyre_description,
          amountPaid: amount,
          paidAt,
          remainingBalance: newBalance,
          contractStatus: newStatus,
          shopName: snapshot.meta.shop_name,
        },
      };
    },
    [snapshot, commit]
  );

  // --- Reverse Payment (Immutable audit log: never delete!) ---
  const reversePayment = useCallback(
    (paymentId: string): ActionResult => {
      if (!snapshot) return { ok: false, error: 'Store not loaded.' };
      const payment = snapshot.payments.find((p) => p.id === paymentId);
      if (!payment) return { ok: false, error: 'Payment record not found.' };
      if (payment.status === 'Reversed') {
        return { ok: false, error: 'This payment has already been reversed.' };
      }

      const contract = snapshot.credit_contracts.find((c) => c.id === payment.contract_id);
      if (!contract) return { ok: false, error: 'Associated credit contract not found.' };

      const restoredBalance = Math.min(contract.total_price, contract.balance + payment.amount);
      const restoredPaid = Math.max(contract.deposit, contract.amount_paid - payment.amount);
      const reversedAt = new Date().toISOString();

      commit((prev) => ({
        ...prev,
        payments: prev.payments.map((p) =>
          p.id === payment.id ? { ...p, status: 'Reversed', reversed_at: reversedAt } : p
        ),
        credit_contracts: prev.credit_contracts.map((c) =>
          c.id === contract.id
            ? {
                ...c,
                amount_paid: restoredPaid,
                balance: restoredBalance,
                status: restoredBalance > 0 ? 'Active' : 'Paid',
              }
            : c
        ),
        customers: prev.customers.map((cust) =>
          cust.id === payment.customer_id
            ? { ...cust, has_active_debt: restoredBalance > 0 }
            : cust
        ),
      }));

      return { ok: true };
    },
    [snapshot, commit]
  );

  // --- Settings / Backup / Recovery Actions ---
  const updateShopName = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      commit((prev) => ({
        ...prev,
        meta: { ...prev.meta, shop_name: trimmed },
      }));
    },
    [commit]
  );

  const exportBackupJson = useCallback((): ActionResult => {
    if (!snapshot) return { ok: false, error: 'No data to export.' };
    const nowIso = new Date().toISOString();
    const exportPayload: TyreBookSnapshot = {
      ...snapshot,
      exported_at: nowIso,
      meta: { ...snapshot.meta, last_backup_at: nowIso },
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStamp = nowIso.slice(0, 10);
    a.href = url;
    a.download = `tyrebook-backup-${dateStamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    commit((prev) => ({
      ...prev,
      meta: { ...prev.meta, last_backup_at: nowIso },
    }));
    return { ok: true };
  }, [snapshot, commit]);

  const restoreBackupJson = useCallback((jsonText: string): ActionResult => {
    try {
      const parsed = JSON.parse(jsonText);
      const checked = validateBackupJson(parsed);
      if (!checked.valid) {
        return { ok: false, error: checked.error };
      }
      setSnapshot(checked.data);
      void saveSnapshotToLocal(checked.data);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not read JSON file. Please pick a valid TyreBook backup.' };
    }
  }, []);

  const clearSampleData = useCallback(() => {
    const empty = createEmptySnapshot(snapshot?.meta.shop_name || 'My Tyre Shop');
    setSnapshot(empty);
    void saveSnapshotToLocal(empty);
  }, [snapshot?.meta.shop_name]);

  const reloadSampleData = useCallback(() => {
    const seeded = createSampleSnapshot();
    setSnapshot(seeded);
    void saveSnapshotToLocal(seeded);
  }, []);

  // --- Computed Dashboard Metrics ---
  const dashboardStats = useMemo(() => {
    if (!snapshot) {
      return {
        creditCollectionsToday: 0,
        cashSalesToday: 0,
        totalCashInHandToday: 0,
        totalOutstandingDebt: 0,
        activeDebtorsCount: 0,
        lowStockCount: 0,
      };
    }

    const now = new Date();
    const validPaymentsToday = snapshot.payments
      .filter((p) => p.status === 'Valid' && isSameLocalDay(p.paid_at, now))
      .reduce((sum, p) => sum + p.amount, 0);

    const newDepositsToday = snapshot.credit_contracts
      .filter((c) => !c.is_opening_migration && c.deposit > 0 && isSameLocalDay(c.start_date, now))
      .reduce((sum, c) => sum + c.deposit, 0);

    const creditCollectionsToday = validPaymentsToday + newDepositsToday;

    const cashSalesToday = snapshot.cash_sales
      .filter((s) => isSameLocalDay(s.sold_at, now))
      .reduce((sum, s) => sum + s.total_amount, 0);

    const activeContracts = snapshot.credit_contracts.filter((c) => c.status === 'Active');
    const totalOutstandingDebt = activeContracts.reduce((sum, c) => sum + c.balance, 0);
    const lowStockCount = snapshot.inventory.filter((t) => t.stock_qty <= 3).length;

    return {
      creditCollectionsToday,
      cashSalesToday,
      totalCashInHandToday: creditCollectionsToday + cashSalesToday,
      totalOutstandingDebt,
      activeDebtorsCount: activeContracts.length,
      lowStockCount,
    };
  }, [snapshot]);

  return {
    snapshot,
    isLoading,
    isOnline,
    syncStatus,
    syncProviderName: syncProviderRef.current.providerName,
    syncMessage,
    dashboardStats,
    syncNow,
    addTyre,
    restockTyre,
    addCustomer,
    createCreditSale,
    createCashSale,
    createOpeningMigration,
    recordPayment,
    reversePayment,
    updateShopName,
    exportBackupJson,
    restoreBackupJson,
    clearSampleData,
    reloadSampleData,
  };
}
