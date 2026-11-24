import React from 'react';
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  ChevronRight,
  Package,
  TrendingUp,
  Users,
} from 'lucide-react';
import type {
  CashSale,
  CreditContract,
  Customer,
  NavTab,
  Payment,
  ReceiptData,
} from '../types/models';
import {
  formatDateTime,
  formatNaira,
  getOverdueArrears,
  hasValidPaymentToday,
  isContractOverdue,
  isSameLocalDay,
} from '../utils/format';

interface HomeScreenProps {
  customers: Customer[];
  contracts: CreditContract[];
  payments: Payment[];
  cashSales: CashSale[];
  stats: {
    creditCollectionsToday: number;
    cashSalesToday: number;
    totalCashInHandToday: number;
    totalOutstandingDebt: number;
    activeDebtorsCount: number;
    lowStockCount: number;
  };
  onQuickCollect: (contractId: string, amount: number) => {
    ok: boolean;
    error?: string;
    data?: ReceiptData;
  };
  onOpenCustomerLedger: (customerId: string) => void;
  onNavigate: (tab: NavTab) => void;
  onReceiptGenerated: (receipt: ReceiptData) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  customers,
  contracts,
  payments,
  cashSales,
  stats,
  onQuickCollect,
  onOpenCustomerLedger,
  onNavigate,
  onReceiptGenerated,
}) => {
  const customerMap = new Map(customers.map((c) => [c.id, c]));
  const now = new Date();

  const activeContracts = contracts.filter((c) => c.status === 'Active' && c.balance > 0);

  // Active debtors who have NOT made a valid payment today
  const pendingToday = activeContracts
    .filter((c) => !hasValidPaymentToday(c.id, payments, now))
    .map((contract) => ({
      contract,
      customer: customerMap.get(contract.customer_id),
      overdue: isContractOverdue(contract, now),
      arrears: getOverdueArrears(contract, now),
    }))
    .filter((entry): entry is typeof entry & { customer: Customer } => Boolean(entry.customer))
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.arrears - a.arrears);

  const collectedTodayCount = activeContracts.length - pendingToday.length;

  const todayPayments = payments
    .filter((p) => p.status === 'Valid' && isSameLocalDay(p.paid_at, now))
    .sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());

  const todayCashSales = cashSales
    .filter((s) => isSameLocalDay(s.sold_at, now))
    .sort((a, b) => new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime());

  const handleOneTapCollect = (contract: CreditContract) => {
    const collectAmount = Math.min(contract.daily_installment, contract.balance);
    const res = onQuickCollect(contract.id, collectAmount);
    if (res.ok && res.data) {
      onReceiptGenerated(res.data);
    }
  };

  return (
    <div className="space-y-6 lg:grid lg:grid-cols-12 lg:gap-6 lg:space-y-0 items-start">
      {/* Left Column on Desktop / Top on Mobile: Cash in Hand & KPIs */}
      <div className="space-y-4 lg:col-span-5">
        {/* Dominant Focal Anchor: Total Cash in Hand Today */}
        <section className="rounded-2xl bg-slate-900 text-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">
              Total Cash in Hand Today
            </span>
            <span className="text-xs font-mono text-emerald-400 tabular-nums">
              {new Intl.DateTimeFormat('en-NG', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              }).format(now)}
            </span>
          </div>

          <p className="mt-2 font-mono text-3xl sm:text-4xl font-bold tracking-tight text-white tabular-nums">
            {formatNaira(stats.totalCashInHandToday)}
          </p>

          <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 gap-3">
            <div>
              <span className="block text-xs text-slate-400">Credit Collections Today</span>
              <span className="mt-0.5 block font-mono text-base font-semibold text-emerald-400 tabular-nums">
                {formatNaira(stats.creditCollectionsToday)}
              </span>
            </div>
            <div>
              <span className="block text-xs text-slate-400">Cash Sales Today</span>
              <span className="mt-0.5 block font-mono text-base font-semibold text-white tabular-nums">
                {formatNaira(stats.cashSalesToday)}
              </span>
            </div>
          </div>
        </section>

        {/* Secondary Metrics Row: Outstanding Debt & Active Debtors */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onNavigate('debtors')}
            className="text-left rounded-2xl bg-white border border-slate-200 p-4 hover:border-slate-300 active:scale-[0.99] transition"
          >
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Outstanding Debt</span>
              <TrendingUp className="w-4 h-4 text-slate-400 shrink-0" />
            </div>
            <p className="mt-2 font-mono text-xl font-bold text-slate-900 tabular-nums truncate">
              {formatNaira(stats.totalOutstandingDebt)}
            </p>
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500">
              View ledger <ArrowRight className="w-3 h-3" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('debtors')}
            className="text-left rounded-2xl bg-white border border-slate-200 p-4 hover:border-slate-300 active:scale-[0.99] transition"
          >
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Active Debtors</span>
              <Users className="w-4 h-4 text-slate-400 shrink-0" />
            </div>
            <p className="mt-2 font-mono text-xl font-bold text-slate-900 tabular-nums">
              {stats.activeDebtorsCount}
            </p>
            <span className="mt-1 block text-xs text-slate-500 tabular-nums">
              {collectedTodayCount} paid today · {pendingToday.length} left
            </span>
          </button>
        </div>

        {/* Low Stock Alert Strip when applicable */}
        {stats.lowStockCount > 0 && (
          <button
            type="button"
            onClick={() => onNavigate('stock')}
            className="w-full min-h-[48px] flex items-center justify-between gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-left hover:bg-amber-100/70 transition"
          >
            <div className="flex items-center gap-2.5">
              <Package className="w-4 h-4 text-amber-800 shrink-0" />
              <span className="text-sm font-semibold text-amber-950">
                {stats.lowStockCount} tyre size{stats.lowStockCount > 1 ? 's' : ''} running low on stock
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-800 shrink-0" />
          </button>
        )}

        {/* Today's Collected Cash Log (Visible below summary on desktop & mobile) */}
        <section className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Today&apos;s Cash Entries</h2>
            <span className="text-xs text-slate-500 tabular-nums">
              {todayPayments.length + todayCashSales.length} recorded
            </span>
          </div>

          {todayPayments.length === 0 && todayCashSales.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              No payments or cash sales recorded yet today.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {todayPayments.map((payment) => {
                const cust = customerMap.get(payment.customer_id);
                return (
                  <li key={payment.id}>
                    <button
                      type="button"
                      onClick={() => cust && onOpenCustomerLedger(cust.id)}
                      className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {cust?.full_name ?? 'Customer'}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          Credit payment · {formatDateTime(payment.paid_at)}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-bold text-emerald-700 tabular-nums shrink-0">
                        +{formatNaira(payment.amount)}
                      </span>
                    </button>
                  </li>
                );
              })}
              {todayCashSales.map((sale) => (
                <li
                  key={sale.id}
                  className="px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {sale.qty}x {sale.tyre_description}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      Cash sale · {formatDateTime(sale.sold_at)}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-bold text-slate-900 tabular-nums shrink-0">
                    +{formatNaira(sale.total_amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Right Column on Desktop / Primary Action Feed on Mobile: Pending Collections Today */}
      <section className="lg:col-span-7 space-y-3">
        <div className="flex items-baseline justify-between px-0.5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Pending Collections Today</h2>
            <p className="text-xs text-slate-500">
              Active debtors who have not paid today — tap once to collect
            </p>
          </div>
          <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums">
            {pendingToday.length} pending
          </span>
        </div>

        {pendingToday.length === 0 ? (
          <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-700 mx-auto" />
            <p className="text-base font-bold text-slate-900">All caught up for today</p>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              {stats.activeDebtorsCount === 0
                ? 'There are no active credit debtors right now. Tap New Sale below to record a sale.'
                : 'Every active debtor has already made a valid payment today.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingToday.map(({ contract, customer, overdue, arrears }) => {
              const collectAmount = Math.min(contract.daily_installment, contract.balance);
              return (
                <div
                  key={contract.id}
                  className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3.5"
                >
                  <button
                    type="button"
                    onClick={() => onOpenCustomerLedger(customer.id)}
                    className="w-full text-left flex items-start justify-between gap-3 group"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                          {customer.full_name}
                        </span>
                        {overdue && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            Overdue {formatNaira(arrears)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {customer.location} · {contract.tyre_description}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="block text-[11px] text-slate-500">Balance</span>
                      <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                        {formatNaira(contract.balance)}
                      </span>
                    </div>
                  </button>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleOneTapCollect(contract)}
                      className="flex-1 min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-emerald-800 active:scale-[0.98] transition-transform"
                    >
                      <Banknote className="w-4 h-4 shrink-0" />
                      <span className="tabular-nums">Collect {formatNaira(collectAmount)}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenCustomerLedger(customer.id)}
                      className="min-h-[48px] px-3.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 active:scale-[0.98] transition-transform whitespace-nowrap shrink-0"
                    >
                      Ledger
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
