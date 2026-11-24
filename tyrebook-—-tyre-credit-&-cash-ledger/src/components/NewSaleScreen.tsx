import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Banknote,
  BookOpen,
  CheckCircle2,
  CreditCard,
  Lock,
  Minus,
  Plus,
  UserPlus,
} from 'lucide-react';
import type { CashSale, CreditContract, Customer, InventoryItem } from '../types/models';
import { formatDateTime, formatNaira } from '../utils/format';

type SaleTab = 'credit' | 'cash' | 'migration';

interface NewSaleScreenProps {
  inventory: InventoryItem[];
  customers: Customer[];
  contracts: CreditContract[];
  cashSales: CashSale[];
  preselectedCustomerId?: string | null;
  onClearPreselectedCustomer?: () => void;
  onAddCustomer: (input: {
    full_name: string;
    phone: string;
    location: string;
    guarantor_name: string;
    guarantor_phone: string;
  }) => { ok: boolean; error?: string; data?: Customer };
  onCreateCreditSale: (input: {
    customer_id: string;
    tyre_id: string;
    qty: number;
    deposit: number;
    daily_installment: number;
  }) => { ok: boolean; error?: string; data?: CreditContract };
  onCreateCashSale: (input: {
    tyre_id: string;
    qty: number;
  }) => { ok: boolean; error?: string; data?: CashSale };
  onCreateOpeningMigration: (input: {
    customer_id: string;
    tyre_description: string;
    qty: number;
    remaining_balance: number;
    daily_installment: number;
    start_date?: string;
  }) => { ok: boolean; error?: string; data?: CreditContract };
  onOpenCustomerLedger: (customerId: string) => void;
}

export const NewSaleScreen: React.FC<NewSaleScreenProps> = ({
  inventory,
  customers,
  contracts,
  cashSales,
  preselectedCustomerId,
  onClearPreselectedCustomer,
  onAddCustomer,
  onCreateCreditSale,
  onCreateCashSale,
  onCreateOpeningMigration,
  onOpenCustomerLedger,
}) => {
  const [activeTab, setActiveTab] = useState<SaleTab>('credit');
  const [banner, setBanner] = useState<{
    type: 'ok' | 'err';
    text: string;
    customerId?: string;
  } | null>(null);

  // Inline New Customer toggle & fields (shared between Credit Sale & Migration)
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustLocation, setNewCustLocation] = useState('');
  const [newGuarantorName, setNewGuarantorName] = useState('');
  const [newGuarantorPhone, setNewGuarantorPhone] = useState('');

  // Tab 1: Credit Sale state
  const [creditCustomerId, setCreditCustomerId] = useState('');
  const [creditTyreId, setCreditTyreId] = useState('');
  const [creditQty, setCreditQty] = useState(1);
  const [creditDeposit, setCreditDeposit] = useState('20000');
  const [creditDaily, setCreditDaily] = useState('5000');

  // Tab 2: Cash Sale state
  const [cashTyreId, setCashTyreId] = useState('');
  const [cashQty, setCashQty] = useState(1);

  // Tab 3: Opening Balance Migration state
  const [migCustomerId, setMigCustomerId] = useState('');
  const [migTyreDesc, setMigTyreDesc] = useState('');
  const [migQty, setMigQty] = useState(1);
  const [migBalance, setMigBalance] = useState('');
  const [migDaily, setMigDaily] = useState('');
  const [migStartDate, setMigStartDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (preselectedCustomerId) {
      setActiveTab('credit');
      setCreditCustomerId(preselectedCustomerId);
      setAddingCustomer(false);
      onClearPreselectedCustomer?.();
    }
  }, [preselectedCustomerId, onClearPreselectedCustomer]);

  const inStockTyres = useMemo(
    () => inventory.filter((t) => t.stock_qty > 0),
    [inventory]
  );

  // Default tyre selections if empty
  const selectedCreditTyre = useMemo(
    () => inventory.find((t) => t.id === creditTyreId) ?? inStockTyres[0] ?? null,
    [inventory, creditTyreId, inStockTyres]
  );

  const selectedCashTyre = useMemo(
    () => inventory.find((t) => t.id === cashTyreId) ?? inStockTyres[0] ?? null,
    [inventory, cashTyreId, inStockTyres]
  );

  // Debt lock checks
  const getDebtLockInfo = (customerId: string) => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return null;
    const activeCon = contracts.find(
      (c) => c.customer_id === cust.id && c.status === 'Active'
    );
    if (cust.has_active_debt || activeCon) {
      return {
        customer: cust,
        balance: activeCon?.balance ?? 0,
        tyreDescription: activeCon?.tyre_description ?? 'Active credit contract',
      };
    }
    return null;
  };

  const creditDebtLock = useMemo(
    () => (creditCustomerId ? getDebtLockInfo(creditCustomerId) : null),
    [creditCustomerId, customers, contracts]
  );

  const migrationDebtLock = useMemo(
    () => (migCustomerId ? getDebtLockInfo(migCustomerId) : null),
    [migCustomerId, customers, contracts]
  );

  const handleSaveInlineCustomer = (target: 'credit' | 'migration') => {
    const res = onAddCustomer({
      full_name: newCustName,
      phone: newCustPhone,
      location: newCustLocation,
      guarantor_name: newGuarantorName,
      guarantor_phone: newGuarantorPhone,
    });
    if (!res.ok || !res.data) {
      setBanner({ type: 'err', text: res.error || 'Could not add customer.' });
      return;
    }
    if (target === 'credit') {
      setCreditCustomerId(res.data.id);
    } else {
      setMigCustomerId(res.data.id);
    }
    setAddingCustomer(false);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustLocation('');
    setNewGuarantorName('');
    setNewGuarantorPhone('');
    setBanner({ type: 'ok', text: `Added ${res.data.full_name}. Ready to complete sale.` });
  };

  // Calculations for Credit Sale preview
  const creditTotalPrice = selectedCreditTyre ? selectedCreditTyre.credit_price * creditQty : 0;
  const parsedDeposit = Math.max(0, Number(creditDeposit) || 0);
  const parsedDaily = Math.max(0, Number(creditDaily) || 0);
  const creditBalanceAfterDeposit = Math.max(0, creditTotalPrice - parsedDeposit);
  const estDays = parsedDaily > 0 ? Math.ceil(creditBalanceAfterDeposit / parsedDaily) : 0;

  // Calculations for Cash Sale preview
  const cashTotalAmount = selectedCashTyre ? selectedCashTyre.cash_price * cashQty : 0;

  const handleCreditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditCustomerId) {
      setBanner({ type: 'err', text: 'Select or add a customer first.' });
      return;
    }
    if (!selectedCreditTyre) {
      setBanner({ type: 'err', text: 'No in-stock tyre available. Restock inventory first.' });
      return;
    }
    const res = onCreateCreditSale({
      customer_id: creditCustomerId,
      tyre_id: selectedCreditTyre.id,
      qty: creditQty,
      deposit: parsedDeposit,
      daily_installment: parsedDaily,
    });
    if (!res.ok) {
      setBanner({ type: 'err', text: res.error || 'Credit sale failed.' });
      return;
    }
    const custName =
      customers.find((c) => c.id === creditCustomerId)?.full_name ?? 'Customer';
    setBanner({
      type: 'ok',
      text: `Credit sale saved for ${custName}. Stock deducted and ledger opened.`,
      customerId: creditCustomerId,
    });
    setCreditQty(1);
    setCreditCustomerId('');
  };

  const handleCashSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCashTyre) {
      setBanner({ type: 'err', text: 'No in-stock tyre available for cash sale.' });
      return;
    }
    const res = onCreateCashSale({
      tyre_id: selectedCashTyre.id,
      qty: cashQty,
    });
    if (!res.ok || !res.data) {
      setBanner({ type: 'err', text: res.error || 'Cash sale failed.' });
      return;
    }
    setBanner({
      type: 'ok',
      text: `Recorded cash sale of ${formatNaira(res.data.total_amount)} (${res.data.qty}x ${res.data.tyre_description}). Stock updated.`,
    });
    setCashQty(1);
  };

  const handleMigrationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!migCustomerId) {
      setBanner({ type: 'err', text: 'Select or add a customer first.' });
      return;
    }
    const res = onCreateOpeningMigration({
      customer_id: migCustomerId,
      tyre_description: migTyreDesc,
      qty: migQty,
      remaining_balance: Number(migBalance) || 0,
      daily_installment: Number(migDaily) || 0,
      start_date: migStartDate,
    });
    if (!res.ok) {
      setBanner({ type: 'err', text: res.error || 'Opening balance migration failed.' });
      return;
    }
    const custName =
      customers.find((c) => c.id === migCustomerId)?.full_name ?? 'Customer';
    setBanner({
      type: 'ok',
      text: `Migrated notebook balance for ${custName} without deducting stock.`,
      customerId: migCustomerId,
    });
    setMigCustomerId('');
    setMigTyreDesc('');
    setMigBalance('');
    setMigDaily('');
    setMigQty(1);
  };

  const renderInlineCustomerCreator = (target: 'credit' | 'migration') => (
    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-900">New Customer Details</span>
        <button
          type="button"
          onClick={() => setAddingCustomer(false)}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1"
        >
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="Full Name *"
          value={newCustName}
          onChange={(e) => setNewCustName(e.target.value)}
          className="min-h-[46px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
        />
        <input
          type="tel"
          placeholder="Phone (e.g. 0803 123 4567) *"
          value={newCustPhone}
          onChange={(e) => setNewCustPhone(e.target.value)}
          className="min-h-[46px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
        />
        <input
          type="text"
          placeholder="Location / Park / Market"
          value={newCustLocation}
          onChange={(e) => setNewCustLocation(e.target.value)}
          className="sm:col-span-2 min-h-[46px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
        />
        <input
          type="text"
          placeholder="Guarantor Full Name"
          value={newGuarantorName}
          onChange={(e) => setNewGuarantorName(e.target.value)}
          className="min-h-[46px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
        />
        <input
          type="tel"
          placeholder="Guarantor Phone"
          value={newGuarantorPhone}
          onChange={(e) => setNewGuarantorPhone(e.target.value)}
          className="min-h-[46px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
        />
      </div>
      <button
        type="button"
        onClick={() => handleSaveInlineCustomer(target)}
        className="w-full min-h-[46px] rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800"
      >
        Save & Select Customer
      </button>
    </div>
  );

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* 3-Tab Segmented Navigation */}
      <div
        className="grid grid-cols-3 gap-1 p-1 bg-slate-200/80 rounded-xl"
        role="tablist"
        aria-label="New sale type"
      >
        {(
          [
            { id: 'credit', label: 'Credit Sale', icon: CreditCard },
            { id: 'cash', label: 'Cash Sale', icon: Banknote },
            { id: 'migration', label: 'Opening Bal.', icon: BookOpen },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isCurrent = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              onClick={() => {
                setActiveTab(tab.id);
                setBanner(null);
                setAddingCustomer(false);
              }}
              className={`min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                isCurrent
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0 hidden sm:block" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Feedback Banner */}
      {banner && (
        <div
          className={`rounded-xl px-4 py-3.5 border flex items-center justify-between gap-3 ${
            banner.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-start gap-2.5 text-sm font-medium">
            {banner.type === 'ok' && (
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            )}
            <span>{banner.text}</span>
          </div>
          {banner.customerId && (
            <button
              type="button"
              onClick={() => onOpenCustomerLedger(banner.customerId!)}
              className="min-h-[40px] px-3 rounded-lg bg-emerald-700 text-xs font-bold text-white whitespace-nowrap shrink-0 flex items-center gap-1"
            >
              <span>Open Ledger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* TAB 1: CREDIT SALE */}
      {activeTab === 'credit' && (
        <form
          onSubmit={handleCreditSubmit}
          className="rounded-2xl bg-white border border-slate-200 p-5 space-y-5"
        >
          <div>
            <h2 className="text-base font-bold text-slate-900">New Credit Sale</h2>
            <p className="text-xs text-slate-500">
              Auto-applies credit price and deducts sold quantity from stock
            </p>
          </div>

          {/* Step 1: Select or Add Customer */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="credit-customer-select"
                className="text-sm font-semibold text-slate-800"
              >
                1. Customer
              </label>
              {!addingCustomer && (
                <button
                  type="button"
                  onClick={() => setAddingCustomer(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-900 min-h-[36px] px-2"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add New Customer</span>
                </button>
              )}
            </div>

            {addingCustomer ? (
              renderInlineCustomerCreator('credit')
            ) : (
              <select
                id="credit-customer-select"
                value={creditCustomerId}
                onChange={(e) => {
                  setCreditCustomerId(e.target.value);
                  setBanner(null);
                }}
                className="w-full min-h-[48px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-900 focus:border-slate-900 focus:outline-none"
              >
                <option value="">— Select customer —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} ({c.phone}){c.has_active_debt ? ' — ACTIVE DEBT' : ''}
                  </option>
                ))}
              </select>
            )}

            {/* STRICT SINGLE ACTIVE DEBT LOCK BLOCK */}
            {creditDebtLock && (
              <div className="rounded-xl bg-red-50 border border-red-300 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-red-900">
                      Credit Sale Blocked — Existing Active Debt
                    </p>
                    <p className="text-xs text-red-800 leading-relaxed">
                      <strong>{creditDebtLock.customer.full_name}</strong> currently owes{' '}
                      <strong className="font-mono text-sm">
                        {formatNaira(creditDebtLock.balance)}
                      </strong>{' '}
                      ({creditDebtLock.tyreDescription}). Customers cannot hold two active credit
                      purchases at once.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenCustomerLedger(creditDebtLock.customer.id)}
                  className="w-full min-h-[44px] rounded-xl bg-red-800 text-xs font-bold text-white hover:bg-red-900"
                >
                  Open {creditDebtLock.customer.full_name}&apos;s Ledger Instead
                </button>
              </div>
            )}
          </div>

          {/* Step 2: Select Tyre & Quantity */}
          <div className={`space-y-3 ${creditDebtLock ? 'opacity-45 pointer-events-none' : ''}`}>
            <label
              htmlFor="credit-tyre-select"
              className="block text-sm font-semibold text-slate-800"
            >
              2. Tyre & Quantity (Credit Price Auto-Applied)
            </label>
            <select
              id="credit-tyre-select"
              value={selectedCreditTyre?.id ?? ''}
              onChange={(e) => {
                setCreditTyreId(e.target.value);
                setCreditQty(1);
              }}
              disabled={inStockTyres.length === 0}
              className="w-full min-h-[48px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-900 focus:border-slate-900 focus:outline-none"
            >
              {inStockTyres.length === 0 ? (
                <option value="">Out of stock — restock inventory first</option>
              ) : (
                inStockTyres.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.size} {t.brand} ({t.condition}) — {formatNaira(t.credit_price)} ·{' '}
                    {t.stock_qty} in stock
                  </option>
                ))
              )}
            </select>

            {selectedCreditTyre && (
              <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                <div>
                  <span className="block text-xs text-slate-500">Quantity</span>
                  <span className="text-xs font-medium text-slate-700">
                    Max {selectedCreditTyre.stock_qty} available
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCreditQty((q) => Math.max(1, q - 1))}
                    disabled={creditQty <= 1}
                    aria-label="Decrease quantity"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-900 disabled:opacity-40"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-lg font-bold text-slate-900 w-7 text-center tabular-nums">
                    {creditQty}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCreditQty((q) => Math.min(selectedCreditTyre.stock_qty, q + 1))
                    }
                    disabled={creditQty >= selectedCreditTyre.stock_qty}
                    aria-label="Increase quantity"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-900 disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Deposit & Daily Installment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label
                  htmlFor="credit-deposit"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Initial Deposit (₦)
                </label>
                <input
                  id="credit-deposit"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={creditDeposit}
                  onChange={(e) => setCreditDeposit(e.target.value)}
                  className="w-full min-h-[48px] rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-base font-bold text-slate-900 tabular-nums focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="credit-daily"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Daily Installment (₦)
                </label>
                <input
                  id="credit-daily"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  required
                  value={creditDaily}
                  onChange={(e) => setCreditDaily(e.target.value)}
                  className="w-full min-h-[48px] rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-base font-bold text-slate-900 tabular-nums focus:border-slate-900 focus:outline-none"
                />
              </div>
            </div>

            {/* Live Credit Summary Box */}
            {selectedCreditTyre && (
              <div className="rounded-xl bg-slate-900 text-white p-4 space-y-2">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>
                    Total Credit Price ({creditQty} × {formatNaira(selectedCreditTyre.credit_price)})
                  </span>
                  <span className="font-mono font-semibold text-white tabular-nums">
                    {formatNaira(creditTotalPrice)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Less Deposit Paid Today</span>
                  <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                    -{formatNaira(parsedDeposit)}
                  </span>
                </div>
                <div className="h-px bg-slate-800 my-1" />
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold">Starting Debt Balance</span>
                  <span className="font-mono text-xl font-bold tabular-nums">
                    {formatNaira(creditBalanceAfterDeposit)}
                  </span>
                </div>
                {estDays > 0 && (
                  <p className="text-[11px] text-slate-400 tabular-nums">
                    Est. {estDays} daily payment{estDays > 1 ? 's' : ''} of {formatNaira(parsedDaily)}
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={Boolean(creditDebtLock) || !selectedCreditTyre}
              className="w-full min-h-[52px] rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-bold text-white shadow-xs hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 active:scale-[0.98] transition-transform"
            >
              Confirm Credit Sale & Deduct Stock
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: CASH SALE */}
      {activeTab === 'cash' && (
        <div className="space-y-5">
          <form
            onSubmit={handleCashSubmit}
            className="rounded-2xl bg-white border border-slate-200 p-5 space-y-5"
          >
            <div>
              <h2 className="text-base font-bold text-slate-900">Record Cash Sale</h2>
              <p className="text-xs text-slate-500">
                Auto-applies cash price, adds to Today&apos;s Cash in Hand, and deducts stock
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="cash-tyre-select"
                className="block text-sm font-semibold text-slate-800"
              >
                Select Tyre
              </label>
              <select
                id="cash-tyre-select"
                value={selectedCashTyre?.id ?? ''}
                onChange={(e) => {
                  setCashTyreId(e.target.value);
                  setCashQty(1);
                }}
                disabled={inStockTyres.length === 0}
                className="w-full min-h-[48px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-900 focus:border-slate-900 focus:outline-none"
              >
                {inStockTyres.length === 0 ? (
                  <option value="">No tyres in stock</option>
                ) : (
                  inStockTyres.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.size} {t.brand} ({t.condition}) — {formatNaira(t.cash_price)} ·{' '}
                      {t.stock_qty} left
                    </option>
                  ))
                )}
              </select>
            </div>

            {selectedCashTyre && (
              <>
                <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                  <div>
                    <span className="block text-xs text-slate-500">Quantity Sold</span>
                    <span className="text-xs font-medium text-slate-700">
                      Unit Cash Price: {formatNaira(selectedCashTyre.cash_price)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCashQty((q) => Math.max(1, q - 1))}
                      disabled={cashQty <= 1}
                      aria-label="Decrease cash sale quantity"
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-900 disabled:opacity-40"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-mono text-lg font-bold text-slate-900 w-7 text-center tabular-nums">
                      {cashQty}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCashQty((q) => Math.min(selectedCashTyre.stock_qty, q + 1))
                      }
                      disabled={cashQty >= selectedCashTyre.stock_qty}
                      aria-label="Increase cash sale quantity"
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-900 disabled:opacity-40"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-900 text-white p-4 flex items-baseline justify-between">
                  <span className="text-sm font-medium text-slate-300">Total Cash to Collect</span>
                  <span className="font-mono text-2xl font-bold text-emerald-400 tabular-nums">
                    {formatNaira(cashTotalAmount)}
                  </span>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={!selectedCashTyre}
              className="w-full min-h-[52px] rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-bold text-white shadow-xs hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 active:scale-[0.98] transition-transform"
            >
              Record Cash Sale
            </button>
          </form>

          {/* Recent Cash Sales Log */}
          {cashSales.length > 0 && (
            <section className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Recent Cash Sales</h3>
                <span className="text-xs font-mono text-slate-500 tabular-nums">
                  {cashSales.length} total
                </span>
              </div>
              <ul className="divide-y divide-slate-100">
                {cashSales.slice(0, 8).map((sale) => (
                  <li key={sale.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {sale.qty}x {sale.tyre_description}
                      </p>
                      <p className="font-mono text-xs text-slate-500 tabular-nums">
                        {formatDateTime(sale.sold_at)}
                      </p>
                    </div>
                    <span className="font-mono text-sm font-bold text-slate-900 tabular-nums shrink-0">
                      {formatNaira(sale.total_amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* TAB 3: OPENING BALANCE MIGRATION */}
      {activeTab === 'migration' && (
        <form
          onSubmit={handleMigrationSubmit}
          className="rounded-2xl bg-white border border-slate-200 p-5 space-y-5"
        >
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">Opening Balance Migration</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Transfer an existing debtor from your paper notebook into TyreBook with their current
              remaining balance. <strong>Stock inventory will NOT be deducted.</strong>
            </p>
          </div>

          {/* Select / Add Customer */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="mig-customer-select"
                className="text-sm font-semibold text-slate-800"
              >
                Customer
              </label>
              {!addingCustomer && (
                <button
                  type="button"
                  onClick={() => setAddingCustomer(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-900 min-h-[36px] px-2"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add New Customer</span>
                </button>
              )}
            </div>

            {addingCustomer ? (
              renderInlineCustomerCreator('migration')
            ) : (
              <select
                id="mig-customer-select"
                value={migCustomerId}
                onChange={(e) => {
                  setMigCustomerId(e.target.value);
                  setBanner(null);
                }}
                className="w-full min-h-[48px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-900 focus:border-slate-900 focus:outline-none"
              >
                <option value="">— Select existing or new customer —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} ({c.phone}){c.has_active_debt ? ' — ACTIVE DEBT' : ''}
                  </option>
                ))}
              </select>
            )}

            {migrationDebtLock && (
              <div className="rounded-xl bg-red-50 border border-red-300 p-4 flex items-start gap-3">
                <Lock className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                <p className="text-xs text-red-800">
                  <strong>{migrationDebtLock.customer.full_name}</strong> already has an active
                  balance of{' '}
                  <strong className="font-mono">{formatNaira(migrationDebtLock.balance)}</strong>.
                </p>
              </div>
            )}
          </div>

          <div
            className={`space-y-4 ${migrationDebtLock ? 'opacity-45 pointer-events-none' : ''}`}
          >
            <div>
              <label
                htmlFor="mig-tyre-desc"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Tyre Description from Notebook
              </label>
              <input
                id="mig-tyre-desc"
                type="text"
                required
                placeholder="e.g. 2x Michelin 205/55 R16 (Tokunbo)"
                value={migTyreDesc}
                onChange={(e) => setMigTyreDesc(e.target.value)}
                className="w-full min-h-[48px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="mig-balance"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Current Remaining Balance (₦)
                </label>
                <input
                  id="mig-balance"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  required
                  placeholder="e.g. 45000"
                  value={migBalance}
                  onChange={(e) => setMigBalance(e.target.value)}
                  className="w-full min-h-[48px] rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-base font-bold text-slate-900 tabular-nums focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="mig-daily"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Daily Installment (₦)
                </label>
                <input
                  id="mig-daily"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  required
                  placeholder="e.g. 5000"
                  value={migDaily}
                  onChange={(e) => setMigDaily(e.target.value)}
                  className="w-full min-h-[48px] rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-base font-bold text-slate-900 tabular-nums focus:border-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="mig-qty"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Tyre Qty (For Record)
                </label>
                <input
                  id="mig-qty"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={migQty}
                  onChange={(e) => setMigQty(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-sm font-bold text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="mig-date"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Start Tracking From
                </label>
                <input
                  id="mig-date"
                  type="date"
                  value={migStartDate}
                  onChange={(e) => setMigStartDate(e.target.value)}
                  className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={Boolean(migrationDebtLock)}
              className="w-full min-h-[52px] rounded-xl bg-slate-900 px-4 py-3.5 text-base font-bold text-white hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 active:scale-[0.98] transition-transform"
            >
              Save Opening Balance (No Stock Change)
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
