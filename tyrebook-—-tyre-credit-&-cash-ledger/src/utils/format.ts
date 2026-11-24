import type { CreditContract, Payment, ReceiptData } from '../types/models';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatNaira(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  const sign = safe < 0 ? '-' : '';
  return `${sign}₦${Math.abs(safe).toLocaleString('en-NG')}`;
}

/**
 * Formats an ISO timestamp as "DD MMM YYYY, hh:mm AM/PM"
 * e.g. "22 Nov 2026, 08:30 AM"
 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hourStr = String(hours).padStart(2, '0');
  return `${day} ${month} ${year}, ${hourStr}:${minutes} ${ampm}`;
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export function isSameLocalDay(isoA: string, dateB: Date = new Date()): boolean {
  const a = new Date(isoA);
  if (Number.isNaN(a.getTime())) return false;
  return (
    a.getFullYear() === dateB.getFullYear() &&
    a.getMonth() === dateB.getMonth() &&
    a.getDate() === dateB.getDate()
  );
}

/**
 * Returns full calendar days elapsed between start_date and today (local time).
 */
export function getCalendarDaysElapsed(startDateIso: string, now: Date = new Date()): number {
  const start = new Date(startDateIso);
  if (Number.isNaN(start.getTime())) return 0;
  const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = nowMidnight.getTime() - startMidnight.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Expected paid amount based on start_date:
 * deposit + (daysElapsed * daily_installment), capped at total_price.
 */
export function getExpectedPaidByToday(contract: CreditContract, now: Date = new Date()): number {
  const daysElapsed = getCalendarDaysElapsed(contract.start_date, now);
  const expected = contract.deposit + daysElapsed * contract.daily_installment;
  return Math.min(contract.total_price, expected);
}

/**
 * Contract is overdue when active and expected payments based on start_date exceed amount_paid.
 */
export function isContractOverdue(contract: CreditContract, now: Date = new Date()): boolean {
  if (contract.status !== 'Active' || contract.balance <= 0) return false;
  return getExpectedPaidByToday(contract, now) > contract.amount_paid;
}

export function getOverdueArrears(contract: CreditContract, now: Date = new Date()): number {
  if (contract.status !== 'Active' || contract.balance <= 0) return 0;
  return Math.max(0, getExpectedPaidByToday(contract, now) - contract.amount_paid);
}

export function hasValidPaymentToday(
  contractId: string,
  payments: Payment[],
  now: Date = new Date()
): boolean {
  return payments.some(
    (p) => p.contract_id === contractId && p.status === 'Valid' && isSameLocalDay(p.paid_at, now)
  );
}

/**
 * Normalizes Nigerian phone numbers for wa.me links (234XXXXXXXXXX)
 */
export function normalizeNigerianWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('234') && digits.length >= 13) return digits;
  if (digits.startsWith('0') && digits.length >= 10) return `234${digits.slice(1)}`;
  if (digits.length === 10) return `234${digits}`;
  return digits;
}

export function formatTelHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return `tel:${cleaned}`;
}

export function buildWhatsAppReceiptText(receipt: ReceiptData): string {
  const lines = [
    `*PAYMENT RECEIPT — ${receipt.shopName.toUpperCase()}*`,
    `Customer: ${receipt.customerName}`,
    `Item: ${receipt.tyreDescription}`,
    `Amount Paid: ${formatNaira(receipt.amountPaid)}`,
    `Date & Time: ${formatDateTime(receipt.paidAt)}`,
    `Remaining Balance: ${formatNaira(receipt.remainingBalance)}`,
    receipt.remainingBalance === 0
      ? `Status: CLEARED IN FULL`
      : `Status: Active Credit`,
    ``,
    `Thank you for your patronage.`,
  ];
  return lines.join('\n');
}

export function buildWhatsAppReceiptUrl(receipt: ReceiptData): string {
  const phone = normalizeNigerianWhatsAppNumber(receipt.customerPhone);
  const text = encodeURIComponent(buildWhatsAppReceiptText(receipt));
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
}

export function buildWhatsAppChatUrl(phone: string, prefillMessage?: string): string {
  const waNum = normalizeNigerianWhatsAppNumber(phone);
  const base = waNum ? `https://wa.me/${waNum}` : `https://wa.me/`;
  if (!prefillMessage) return base;
  return `${base}?text=${encodeURIComponent(prefillMessage)}`;
}

export function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}
