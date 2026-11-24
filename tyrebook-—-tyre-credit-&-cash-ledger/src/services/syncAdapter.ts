import type { TyreBookSnapshot } from '../types/models';

export interface SyncResult {
  success: boolean;
  syncedAt: string | null;
  provider: 'local' | 'supabase';
  message: string;
}

export interface CloudSyncProvider {
  readonly providerName: 'local' | 'supabase';
  isConfigured(): boolean;
  pushSnapshot(snapshot: TyreBookSnapshot): Promise<SyncResult>;
  pullSnapshot(): Promise<TyreBookSnapshot | null>;
}

interface SupabaseErrorPayload {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
}

function toIsoTimestamp(value: string | null | undefined, fallbackNow = true): string | null {
  if (!value) return fallbackNow ? new Date().toISOString() : null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackNow ? new Date().toISOString() : null;
  }
  return parsed.toISOString();
}

function toInt(value: unknown, min = 0): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.round(num));
}

async function extractSupabaseErrorDetail(res: Response): Promise<string> {
  try {
    const rawText = await res.text();
    if (!rawText) return res.statusText || 'Unknown error';
    try {
      const parsed = JSON.parse(rawText) as SupabaseErrorPayload;
      const parts: string[] = [];
      if (parsed.message) parts.push(parsed.message);
      if (parsed.details) parts.push(`Details: ${parsed.details}`);
      if (parsed.hint) parts.push(`Hint: ${parsed.hint}`);
      if (parsed.code) parts.push(`[${parsed.code}]`);
      return parts.length > 0 ? parts.join(' — ') : rawText;
    } catch {
      return rawText;
    }
  } catch {
    return res.statusText || 'Unable to read error response';
  }
}

/**
 * Clean Supabase REST sync adapter structured for the exact 5 TyreBook tables:
 * inventory, customers, credit_contracts, payments, cash_sales.
 * Activates automatically when VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY are configured.
 */
export class SupabaseSyncProvider implements CloudSyncProvider {
  readonly providerName = 'supabase' as const;
  private url: string;
  private anonKey: string;

  constructor(url?: string, anonKey?: string) {
    this.url = (url ?? import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '');
    this.anonKey = (anonKey ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  }

  isConfigured(): boolean {
    return Boolean(this.url && this.anonKey);
  }

  private get readHeaders(): HeadersInit {
    return {
      apikey: this.anonKey,
      Authorization: `Bearer ${this.anonKey}`,
      'Content-Type': 'application/json',
    };
  }

  private get upsertHeaders(): HeadersInit {
    return {
      apikey: this.anonKey,
      Authorization: `Bearer ${this.anonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    };
  }

  private async upsertRows(table: string, rows: Record<string, unknown>[]): Promise<void> {
    if (rows.length === 0) return;

    const res = await fetch(`${this.url}/rest/v1/${table}?on_conflict=id`, {
      method: 'POST',
      headers: this.upsertHeaders,
      body: JSON.stringify(rows),
    });

    if (!res.ok) {
      const detail = await extractSupabaseErrorDetail(res);
      const errMsg = `Supabase upsert failed on ${table} (${res.status}): ${detail}`;
      console.error('[TyreBook Sync]', errMsg);
      throw new Error(errMsg);
    }
  }

  async pushSnapshot(snapshot: TyreBookSnapshot): Promise<SyncResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        syncedAt: null,
        provider: 'supabase',
        message: 'Supabase credentials not configured; data remains safely stored in IndexedDB.',
      };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return {
        success: false,
        syncedAt: null,
        provider: 'supabase',
        message: 'Device is offline. Changes queued locally in IndexedDB.',
      };
    }

    try {
      const inventoryIds = new Set(snapshot.inventory.map((item) => item.id));
      const customerIds = new Set(snapshot.customers.map((c) => c.id));

      // Normalize every table so ALL rows in a batch share identical keys (required by PostgREST)
      // and strictly conform to Postgres column types, nullability, and foreign keys.
      const inventoryRows = snapshot.inventory.map((item) => ({
        id: String(item.id),
        brand: String(item.brand || 'Unknown'),
        size: String(item.size || 'Unknown'),
        condition: item.condition === 'Tokunbo' ? 'Tokunbo' : 'New',
        stock_qty: toInt(item.stock_qty, 0),
        cash_price: toInt(item.cash_price, 1),
        credit_price: toInt(item.credit_price, 1),
      }));

      const customerRows = snapshot.customers.map((c) => ({
        id: String(c.id),
        full_name: String(c.full_name || 'Unknown'),
        phone: String(c.phone || ''),
        location: String(c.location ?? ''),
        guarantor_name: String(c.guarantor_name ?? ''),
        guarantor_phone: String(c.guarantor_phone ?? ''),
        has_active_debt: Boolean(c.has_active_debt),
      }));

      const validContracts = snapshot.credit_contracts.filter((c) =>
        customerIds.has(c.customer_id)
      );
      const contractIds = new Set(validContracts.map((c) => c.id));

      const mapContractRow = (c: TyreBookSnapshot['credit_contracts'][number]) => ({
        id: String(c.id),
        customer_id: String(c.customer_id),
        tyre_id: c.tyre_id && inventoryIds.has(c.tyre_id) ? String(c.tyre_id) : null,
        tyre_description: String(c.tyre_description || 'Tyre Credit'),
        qty: toInt(c.qty, 1),
        total_price: toInt(c.total_price, 0),
        deposit: toInt(c.deposit, 0),
        daily_installment: toInt(c.daily_installment, 1),
        amount_paid: toInt(c.amount_paid, 0),
        balance: toInt(c.balance, 0),
        start_date: toIsoTimestamp(c.start_date, true)!,
        status: c.status === 'Paid' ? 'Paid' : 'Active',
        is_opening_migration: Boolean(c.is_opening_migration),
      });

      // Upsert Paid contracts before Active contracts so the single-active-contract partial unique index never collides
      const paidContractRows = validContracts
        .filter((c) => c.status === 'Paid')
        .map(mapContractRow);
      const activeContractRows = validContracts
        .filter((c) => c.status !== 'Paid')
        .map(mapContractRow);

      const paymentRows = snapshot.payments
        .filter((p) => contractIds.has(p.contract_id) && customerIds.has(p.customer_id))
        .map((p) => ({
          id: String(p.id),
          contract_id: String(p.contract_id),
          customer_id: String(p.customer_id),
          amount: toInt(p.amount, 1),
          paid_at: toIsoTimestamp(p.paid_at, true)!,
          status: p.status === 'Reversed' ? 'Reversed' : 'Valid',
          reversed_at: p.reversed_at ? toIsoTimestamp(p.reversed_at, false) : null,
        }));

      const cashSaleRows = snapshot.cash_sales.map((s) => ({
        id: String(s.id),
        tyre_id: s.tyre_id && inventoryIds.has(s.tyre_id) ? String(s.tyre_id) : null,
        tyre_description: String(s.tyre_description || 'Tyre Cash Sale'),
        qty: toInt(s.qty, 1),
        unit_price: toInt(s.unit_price, 1),
        total_amount: toInt(s.total_amount, 1),
        sold_at: toIsoTimestamp(s.sold_at, true)!,
      }));

      // Upsert in strict foreign-key dependency order
      await this.upsertRows('inventory', inventoryRows);
      await this.upsertRows('customers', customerRows);
      await this.upsertRows('credit_contracts', paidContractRows);
      await this.upsertRows('credit_contracts', activeContractRows);
      await this.upsertRows('payments', paymentRows);
      await this.upsertRows('cash_sales', cashSaleRows);

      return {
        success: true,
        syncedAt: new Date().toISOString(),
        provider: 'supabase',
        message: 'All 5 tables synced cleanly to Supabase cloud.',
      };
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Cloud sync failed; local IndexedDB copy is intact.';
      return {
        success: false,
        syncedAt: null,
        provider: 'supabase',
        message: msg,
      };
    }
  }

  async pullSnapshot(): Promise<TyreBookSnapshot | null> {
    if (!this.isConfigured() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return null;
    }

    try {
      const fetchTable = async <T>(table: string): Promise<T[]> => {
        const res = await fetch(`${this.url}/rest/v1/${table}?select=*`, {
          headers: this.readHeaders,
        });
        if (!res.ok) {
          const detail = await extractSupabaseErrorDetail(res);
          throw new Error(`Failed reading ${table} (${res.status}): ${detail}`);
        }
        return (await res.json()) as T[];
      };

      const [inventory, customers, credit_contracts, payments, cash_sales] = await Promise.all([
        fetchTable<TyreBookSnapshot['inventory'][number]>('inventory'),
        fetchTable<TyreBookSnapshot['customers'][number]>('customers'),
        fetchTable<TyreBookSnapshot['credit_contracts'][number]>('credit_contracts'),
        fetchTable<TyreBookSnapshot['payments'][number]>('payments'),
        fetchTable<TyreBookSnapshot['cash_sales'][number]>('cash_sales'),
      ]);

      return {
        version: 1,
        exported_at: new Date().toISOString(),
        inventory,
        customers,
        credit_contracts: credit_contracts.map((c) => ({
          ...c,
          tyre_id: c.tyre_id ?? undefined,
          is_opening_migration: Boolean(c.is_opening_migration),
        })),
        payments: payments.map((p) => ({
          ...p,
          reversed_at: p.reversed_at ?? undefined,
        })),
        cash_sales: cash_sales.map((s) => ({
          ...s,
          tyre_id: s.tyre_id ?? '',
        })),
        meta: {
          shop_name: 'My Tyre Shop',
          is_sample_data: false,
          last_synced_at: new Date().toISOString(),
          last_backup_at: null,
          pending_sync_count: 0,
        },
      };
    } catch (err) {
      console.error('[TyreBook Pull]', err);
      return null;
    }
  }
}

export class LocalOfflineSyncProvider implements CloudSyncProvider {
  readonly providerName = 'local' as const;

  isConfigured(): boolean {
    return true;
  }

  async pushSnapshot(_snapshot: TyreBookSnapshot): Promise<SyncResult> {
    return {
      success: true,
      syncedAt: new Date().toISOString(),
      provider: 'local',
      message: 'Saved locally in IndexedDB on this device.',
    };
  }

  async pullSnapshot(): Promise<TyreBookSnapshot | null> {
    return null;
  }
}

export function createSyncProvider(): CloudSyncProvider {
  const supabase = new SupabaseSyncProvider();
  if (supabase.isConfigured()) {
    return supabase;
  }
  return new LocalOfflineSyncProvider();
}
