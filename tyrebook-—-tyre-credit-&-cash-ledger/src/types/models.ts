export type TyreCondition = 'New' | 'Tokunbo';

export interface InventoryItem {
  id: string;
  brand: string;
  size: string; // e.g., 205/55 R16
  condition: TyreCondition;
  stock_qty: number; // Strictly >= 0
  cash_price: number; // Nigerian Naira (₦)
  credit_price: number; // Nigerian Naira (₦)
}

export interface Customer {
  id: string;
  full_name: string;
  phone: string;
  location: string;
  guarantor_name: string;
  guarantor_phone: string;
  has_active_debt: boolean;
}

export type ContractStatus = 'Active' | 'Paid';

export interface CreditContract {
  id: string;
  customer_id: string;
  tyre_id?: string;
  tyre_description: string;
  qty: number;
  total_price: number;
  deposit: number;
  daily_installment: number;
  amount_paid: number;
  balance: number;
  start_date: string; // ISO timestamp
  status: ContractStatus;
  is_opening_migration?: boolean;
}

export type PaymentStatus = 'Valid' | 'Reversed';

export interface Payment {
  id: string;
  contract_id: string;
  customer_id: string;
  amount: number;
  paid_at: string; // ISO timestamp
  status: PaymentStatus;
  reversed_at?: string;
}

export interface CashSale {
  id: string;
  tyre_id: string;
  tyre_description: string;
  qty: number;
  unit_price: number;
  total_amount: number;
  sold_at: string; // ISO timestamp
}

export interface AppMeta {
  shop_name: string;
  is_sample_data: boolean;
  last_synced_at: string | null;
  last_backup_at: string | null;
  pending_sync_count: number;
}

export interface TyreBookSnapshot {
  version: number;
  exported_at: string;
  inventory: InventoryItem[];
  customers: Customer[];
  credit_contracts: CreditContract[];
  payments: Payment[];
  cash_sales: CashSale[];
  meta: AppMeta;
}

export interface ReceiptData {
  paymentId: string;
  customerName: string;
  customerPhone: string;
  tyreDescription: string;
  amountPaid: number;
  paidAt: string;
  remainingBalance: number;
  contractStatus: ContractStatus;
  shopName: string;
}

export type SyncStatusMode = 'backed_up' | 'saved_locally' | 'syncing' | 'offline';

export type NavTab = 'home' | 'debtors' | 'new-sale' | 'stock';
