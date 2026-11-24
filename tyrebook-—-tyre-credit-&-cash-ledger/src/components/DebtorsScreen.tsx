import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  ChevronRight,
  MessageCircle,
  Phone,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { CreditContract, Customer, Payment, ReceiptData } from '../types/models';
import {
  buildWhatsAppChatUrl,
  formatDateTime,
  formatNaira,
  formatShortDate,
  formatTelHref,
  getOverdueArrears,
  hasValidPaymentToday,
  isContractOverdue,
} from '../utils/format';

type DebtorFilter = 'active' | 'overdue' | 'cleared';

interface DebtorsScreenProps {
  customers: Customer[];
  contracts: CreditContract[];
  payments: Payment[];
  selectedCustomerId: string | null;
  onSelectCustomer: (customerId: string | null) => void;
  onRecordPayment: (
    contractId: string,
    amount: number
  ) => { ok: boolean; error?: string; data?: ReceiptData };
  onReversePayment: (paymentId: string) => { ok: boolean; error?: string };
  onReceiptGenerated: (receipt: ReceiptData) => void;
  onStartCreditSaleForCustomer: (customerId: string) => void;
}

export const DebtorsScreen: React.FC<DebtorsScreenProps> = ({
  customers,
  contracts,
  payments,
  selectedCustomerId,
  onSelectCustomer,
  onRecordPayment,
  onReversePayment,
  onReceiptGenerated,
  onStartCreditSaleForCustomer,
}) => {
  const [filter, setFilter] = useState<DebtorFilter>('active');
  const [searchQuery, setSearchQuery] = useState('');

  // Payment modal state
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentError, setPaymentError] = useState('');

  // Reversal confirmation modal state
  const [paymentToReverse, setPaymentToReverse] = useState<Payment | null>(null);
  const [reversalFeedback, setReversalFeedback] = useState('');

  const now = new Date();

  // Compute enriched customer rows
  const enrichedCustomers = useMemo(() => {
    return customers.map((customer) => {
      const custContracts = contracts
        .filter((c) => c.customer_id === customer.id)
        .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());

      const activeContract = custContracts.find((c) => c.status === 'Active') ?? null;
      const latestContract = activeContract ?? custContracts[0] ?? null;
      const overdue = activeContract ? isContractOverdue(activeContract, now) : false;
      const arrears = activeContract ? getOverdueArrears(activeContract, now) : 0;
      const paidToday = activeContract
        ? hasValidPaymentToday(activeContract.id, payments, now)
        : false;

      return {
        customer,
        activeContract,
        latestContract,
        allContracts: custContracts,
        overdue,
        arrears,
        paidToday,
      };
    });
  }, [customers, contracts, payments]);

  const counts = useMemo(() => {
    let active = 0;
    let overdue = 0;
    let cleared = 0;
    for (const row of enrichedCustomers) {
      if (row.activeContract) {
        active += 1;
        if (row.overdue) overdue += 1;
      } else {
        cleared += 1;
      }
    }
    return { active, overdue, cleared };
  }, [enrichedCustomers]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedCustomers.filter((row) => {
      if (filter === 'active' && !row.activeContract) return false;
      if (filter === 'overdue' && !row.overdue) return false;
      if (filter === 'cleared' && row.activeContract) return false;

      if (!q) return true;
      return (
        row.customer.full_name.toLowerCase().includes(q) ||
        row.customer.phone.toLowerCase().includes(q) ||
        row.customer.location.toLowerCase().includes(q) ||
        (row.latestContract?.tyre_description.toLowerCase().includes(q) ?? false)
      );
    });
  }, [enrichedCustomers, filter, searchQuery]);

  const selectedRow = useMemo(
    () => enrichedCustomers.find((r) => r.customer.id === selectedCustomerId) ?? null,
    [enrichedCustomers, selectedCustomerId]
  );

  // --- CUSTOMER LEDGER DETAIL VIEW ---
  if (selectedRow) {
    const { customer, activeContract, latestContract, overdue, arrears } = selectedRow;
    const displayContract = activeContract ?? latestContract;

    const customerPayments = payments
      .filter((p) => p.customer_id === customer.id)
      .sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());

    const progressPct =
      displayContract && displayContract.total_price > 0
        ? Math.min(100, Math.round((displayContract.amount_paid / displayContract.total_price) * 100))
        : 0;

    const openPaymentForm = () => {
      if (!activeContract) return;
      const defaultAmt = Math.min(activeContract.daily_installment, activeContract.balance);
      setPaymentAmountInput(String(defaultAmt));
      setPaymentError('');
      setShowPaymentSheet(true);
    };

    const handleSubmitPayment = (e: React.FormEvent) => {
      e.preventDefault();
      if (!activeContract) return;
      const num = Number(paymentAmountInput.replace(/[^\d.]/g, ''));
      const res = onRecordPayment(activeContract.id, num);
      if (!res.ok) {
        setPaymentError(res.error || 'Could not record payment.');
        return;
      }
      setShowPaymentSheet(false);
      setPaymentError('');
      if (res.data) {
        onReceiptGenerated(res.data);
      }
    };

    const handleConfirmReverse = () => {
      if (!paymentToReverse) return;
      const res = onReversePayment(paymentToReverse.id);
      setPaymentToReverse(null);
      if (res.ok) {
        setReversalFeedback(
          `Reversed ${formatNaira(paymentToReverse.amount)} and added it back to balance.`
        );
        setTimeout(() => setReversalFeedback(''), 5000);
      }
    };

    const waReminderMsg = activeContract
      ? `Hello ${customer.full_name}, this is a quick update on your tyre credit (${activeContract.tyre_description}). Current remaining balance is ${formatNaira(activeContract.balance)} (Daily installment: ${formatNaira(activeContract.daily_installment)}). Thank you.`
      : `Hello ${customer.full_name}, thank you for doing business with us.`;

    return (
      <div className="space-y-5">
        {/* Top Back Navigation */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onSelectCustomer(null)}
            className="min-h-[44px] min-w-[44px] -ml-1 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 active:scale-[0.97] transition"
            aria-label="Back to debtors list"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-slate-900 truncate">{customer.full_name}</h2>
            <p className="text-xs text-slate-500 truncate">
              {customer.location} · {customer.phone}
            </p>
          </div>
        </div>

        {reversalFeedback && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm font-medium text-amber-950">
            {reversalFeedback}
          </div>
        )}

        <div className="space-y-5 lg:grid lg:grid-cols-12 lg:gap-6 lg:space-y-0 items-start">
          {/* Left Column: Customer Contact, Guarantor & Contract Summary */}
          <div className="space-y-4 lg:col-span-6">
            {/* Call & WhatsApp Action Strip */}
            <div className="grid grid-cols-2 gap-3">
              <a
                href={formatTelHref(customer.phone)}
                className="min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 active:scale-[0.98] transition-transform"
              >
                <Phone className="w-4 h-4 shrink-0" />
                <span>Call Customer</span>
              </a>
              <a
                href={buildWhatsAppChatUrl(customer.phone, waReminderMsg)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[48px] flex items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 active:scale-[0.98] transition-transform"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>WhatsApp</span>
              </a>
            </div>

            {/* Credit Contract Summary Card */}
            {displayContract ? (
              <section className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-medium text-slate-500">
                      {displayContract.status === 'Active'
                        ? 'Active Credit Contract'
                        : 'Last Cleared Contract'}
                    </span>
                    <h3 className="mt-0.5 text-base font-bold text-slate-900">
                      {displayContract.tyre_description}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Started {formatShortDate(displayContract.start_date)}
                      {displayContract.is_opening_migration ? ' · Opening Balance Migration' : ''}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold shrink-0 ${
                      displayContract.status === 'Paid'
                        ? 'text-emerald-700'
                        : overdue
                          ? 'text-amber-800'
                          : 'text-slate-700'
                    }`}
                  >
                    {displayContract.status === 'Paid'
                      ? 'Cleared'
                      : overdue
                        ? 'Overdue'
                        : 'Active'}
                  </span>
                </div>

                {overdue && activeContract && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 flex items-center gap-2 text-xs font-semibold text-amber-900">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-700" />
                    <span>
                      Behind schedule by {formatNaira(arrears)} based on start date
                    </span>
                  </div>
                )}

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Repayment Progress</span>
                    <span className="font-mono font-semibold tabular-nums">{progressPct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-700 transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* 4-Metric Financial Grid */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="block text-xs text-slate-500">Total Price</span>
                    <span className="mt-0.5 block font-mono text-base font-bold text-slate-900 tabular-nums">
                      {formatNaira(displayContract.total_price)}
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="block text-xs text-slate-500">Amount Paid</span>
                    <span className="mt-0.5 block font-mono text-base font-bold text-emerald-700 tabular-nums">
                      {formatNaira(displayContract.amount_paid)}
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-900 p-3 text-white">
                    <span className="block text-xs text-slate-300">Remaining Balance</span>
                    <span className="mt-0.5 block font-mono text-lg font-bold tabular-nums">
                      {formatNaira(displayContract.balance)}
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="block text-xs text-slate-500">Daily Installment</span>
                    <span className="mt-0.5 block font-mono text-base font-bold text-slate-900 tabular-nums">
                      {formatNaira(displayContract.daily_installment)}
                    </span>
                  </div>
                </div>

                {/* Prominent Primary CTA: Record Payment or Start New Credit Sale */}
                {activeContract ? (
                  <button
                    type="button"
                    onClick={openPaymentForm}
                    className="w-full min-h-[52px] flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-bold text-white shadow-sm hover:bg-emerald-800 active:scale-[0.98] transition-transform"
                  >
                    <Plus className="w-5 h-5 shrink-0" />
                    <span>Record Payment</span>
                  </button>
                ) : (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                      <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                      <span>All debt cleared — eligible for new credit</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onStartCreditSaleForCustomer(customer.id)}
                      className="w-full min-h-[46px] rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 active:scale-[0.98] transition-transform"
                    >
                      Start New Credit Sale for {customer.full_name.split(' ')[0]}
                    </button>
                  </div>
                )}
              </section>
            ) : (
              <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3">
                <p className="text-sm text-slate-600">
                  No credit contracts recorded yet for this customer.
                </p>
                <button
                  type="button"
                  onClick={() => onStartCreditSaleForCustomer(customer.id)}
                  className="w-full min-h-[48px] rounded-xl bg-emerald-700 text-sm font-bold text-white"
                >
                  Create Credit Sale
                </button>
              </div>
            )}

            {/* Guarantor Information */}
            <section className="rounded-2xl bg-white border border-slate-200 p-4 flex items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <ShieldCheck className="w-5 h-5 text-slate-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <span className="block text-xs text-slate-500">Guarantor</span>
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {customer.guarantor_name}
                  </p>
                  <p className="text-xs font-mono text-slate-600 tabular-nums">
                    {customer.guarantor_phone}
                  </p>
                </div>
              </div>
              {customer.guarantor_phone && customer.guarantor_phone !== 'Not provided' && (
                <a
                  href={formatTelHref(customer.guarantor_phone)}
                  className="min-h-[44px] px-3.5 flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-800 hover:bg-slate-100 shrink-0"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call</span>
                </a>
              )}
            </section>
          </div>

          {/* Right Column: Chronological Payment History Log */}
          <section className="lg:col-span-6 rounded-2xl bg-white border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Payment History Log</h3>
                <p className="text-xs text-slate-500">
                  Permanent audit trail · Payments cannot be deleted
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                {customerPayments.length} {customerPayments.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>

            {customerPayments.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No installment payments recorded yet.
                {displayContract && displayContract.deposit > 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    Initial deposit of {formatNaira(displayContract.deposit)} was recorded on{' '}
                    {formatDateTime(displayContract.start_date)}.
                  </p>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {customerPayments.map((payment) => {
                  const isReversed = payment.status === 'Reversed';
                  return (
                    <li
                      key={payment.id}
                      className={`px-5 py-3.5 flex items-center justify-between gap-3 ${
                        isReversed ? 'bg-slate-50/80' : ''
                      }`}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-base font-bold tabular-nums ${
                              isReversed
                                ? 'line-through text-slate-400'
                                : 'text-slate-900'
                            }`}
                          >
                            {formatNaira(payment.amount)}
                          </span>
                          <span
                            className={`text-xs font-semibold ${
                              isReversed ? 'text-red-700' : 'text-emerald-700'
                            }`}
                          >
                            · {payment.status}
                          </span>
                        </div>
                        <p className="font-mono text-xs text-slate-500 tabular-nums">
                          {formatDateTime(payment.paid_at)}
                        </p>
                        {isReversed && payment.reversed_at && (
                          <p className="text-[11px] text-red-700">
                            Reversed on {formatDateTime(payment.reversed_at)}
                          </p>
                        )}
                      </div>

                      {!isReversed && (
                        <button
                          type="button"
                          onClick={() => setPaymentToReverse(payment)}
                          className="min-h-[40px] px-3 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-red-700 hover:bg-red-50 hover:border-red-200 active:scale-[0.98] transition shrink-0"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reverse</span>
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {displayContract && displayContract.deposit > 0 && (
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>Initial Deposit ({formatDateTime(displayContract.start_date)})</span>
                <span className="font-mono font-semibold text-slate-800 tabular-nums">
                  {formatNaira(displayContract.deposit)}
                </span>
              </div>
            )}
          </section>
        </div>

        {/* Record Payment Bottom Sheet */}
        {showPaymentSheet && activeContract && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl border-t sm:border border-slate-200 overflow-hidden pb-safe">
              <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 sm:hidden" />
              <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Record Payment</h3>
                  <p className="text-xs text-slate-500">
                    {customer.full_name} · Balance {formatNaira(activeContract.balance)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPaymentSheet(false)}
                  className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitPayment} className="p-5 space-y-4">
                <div>
                  <label
                    htmlFor="record-payment-amount"
                    className="block text-sm font-semibold text-slate-800 mb-1.5"
                  >
                    Amount Collected (₦)
                  </label>
                  <input
                    id="record-payment-amount"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={activeContract.balance}
                    step={1}
                    required
                    value={paymentAmountInput}
                    onChange={(e) => {
                      setPaymentAmountInput(e.target.value);
                      setPaymentError('');
                    }}
                    className="w-full min-h-[54px] rounded-xl border border-slate-300 bg-white px-4 font-mono text-2xl font-bold text-slate-900 tabular-nums focus:border-emerald-700 focus:outline-none"
                  />
                </div>

                {/* Quick Amount Presets */}
                <div className="flex flex-wrap gap-2">
                  {[
                    {
                      label: `Daily (${formatNaira(Math.min(activeContract.daily_installment, activeContract.balance))})`,
                      val: Math.min(activeContract.daily_installment, activeContract.balance),
                    },
                    ...(activeContract.daily_installment * 2 <= activeContract.balance
                      ? [
                          {
                            label: `2 Days (${formatNaira(activeContract.daily_installment * 2)})`,
                            val: activeContract.daily_installment * 2,
                          },
                        ]
                      : []),
                    {
                      label: `Clear Balance (${formatNaira(activeContract.balance)})`,
                      val: activeContract.balance,
                    },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setPaymentAmountInput(String(preset.val))}
                      className="min-h-[40px] px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {paymentError && (
                  <p className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm font-medium text-red-800">
                    {paymentError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full min-h-[52px] flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-base font-bold text-white hover:bg-emerald-800 active:scale-[0.98] transition-transform"
                >
                  <Banknote className="w-5 h-5" />
                  <span>Save Payment & Receipt</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Reverse Payment Confirmation Modal */}
        {paymentToReverse && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl bg-white p-6 shadow-2xl space-y-4 pb-safe">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Reverse this payment?</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    This marks the{' '}
                    <strong className="font-mono text-slate-900">
                      {formatNaira(paymentToReverse.amount)}
                    </strong>{' '}
                    payment from{' '}
                    <span className="font-mono text-xs">{formatDateTime(paymentToReverse.paid_at)}</span>{' '}
                    as <strong>Reversed</strong> (it will remain visible in history) and adds{' '}
                    <strong className="font-mono text-slate-900">
                      {formatNaira(paymentToReverse.amount)}
                    </strong>{' '}
                    back to {customer.full_name}&apos;s balance.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentToReverse(null)}
                  className="min-h-[48px] rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReverse}
                  className="min-h-[48px] rounded-xl bg-red-700 text-sm font-bold text-white hover:bg-red-800"
                >
                  Confirm Reverse
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- DEBTORS LIST VIEW ---
  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search customer, phone, location, or tyre..."
          className="w-full min-h-[48px] rounded-xl border border-slate-300 bg-white pl-11 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Segmented Control: Active | Overdue | Cleared */}
      <div
        className="grid grid-cols-3 gap-1 p-1 bg-slate-200/80 rounded-xl"
        role="tablist"
        aria-label="Filter debtors"
      >
        {(
          [
            { id: 'active', label: `Active (${counts.active})` },
            { id: 'overdue', label: `Overdue (${counts.overdue})` },
            { id: 'cleared', label: `Cleared (${counts.cleared})` },
          ] as const
        ).map((tab) => {
          const isCurrent = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              onClick={() => setFilter(tab.id)}
              className={`min-h-[42px] rounded-lg px-2 py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap tabular-nums ${
                isCurrent
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Customers List */}
      {filteredRows.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center space-y-1.5">
          <p className="text-base font-bold text-slate-900">No customers match this view</p>
          <p className="text-sm text-slate-500">
            {searchQuery
              ? 'Try another name, phone number, or location.'
              : filter === 'overdue'
                ? 'Great news — no active debtors are behind schedule.'
                : 'Add a customer through New Sale to start tracking their ledger.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100 overflow-hidden lg:grid lg:grid-cols-2 lg:divide-y-0 lg:gap-px lg:bg-slate-200">
          {filteredRows.map(({ customer, activeContract, latestContract, overdue, arrears, paidToday }) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => onSelectCustomer(customer.id)}
              className="w-full min-h-[76px] bg-white px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50 active:bg-slate-100 transition-colors"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-bold text-slate-900 truncate">
                    {customer.full_name}
                  </span>
                  {overdue && (
                    <span className="text-xs font-bold text-amber-800 whitespace-nowrap">
                      · Overdue {formatNaira(arrears)}
                    </span>
                  )}
                  {activeContract && paidToday && !overdue && (
                    <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">
                      · Paid today
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 truncate">
                  {customer.location}
                  {latestContract ? ` · ${latestContract.tyre_description}` : ''}
                </p>

                {activeContract && (
                  <p className="text-xs font-mono text-slate-600 tabular-nums">
                    Daily {formatNaira(activeContract.daily_installment)} · Paid{' '}
                    {formatNaira(activeContract.amount_paid)} of{' '}
                    {formatNaira(activeContract.total_price)}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  {activeContract ? (
                    <>
                      <span className="block text-[11px] text-slate-500">Balance</span>
                      <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
                        {formatNaira(activeContract.balance)}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs font-bold text-emerald-700">Cleared</span>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
