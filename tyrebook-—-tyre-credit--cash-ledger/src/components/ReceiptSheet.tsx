import React, { useState } from 'react';
import { Check, CheckCircle2, Copy, MessageCircle, X } from 'lucide-react';
import type { ReceiptData } from '../types/models';
import {
  buildWhatsAppReceiptText,
  buildWhatsAppReceiptUrl,
  formatDateTime,
  formatNaira,
} from '../utils/format';

interface ReceiptSheetProps {
  receipt: ReceiptData | null;
  onClose: () => void;
}

export const ReceiptSheet: React.FC<ReceiptSheetProps> = ({ receipt, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!receipt) return null;

  const waUrl = buildWhatsAppReceiptUrl(receipt);
  const plainText = buildWhatsAppReceiptText(receipt);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked in some embedded contexts
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-sheet-title"
    >
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl border-t sm:border border-slate-200 overflow-hidden pb-safe">
        <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 sm:hidden" />

        <div className="px-5 pt-4 pb-3 flex items-start justify-between border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0" />
            <div>
              <h2 id="receipt-sheet-title" className="text-lg font-bold text-slate-900">
                Payment Recorded
              </h2>
              <p className="text-xs text-slate-500">
                {receipt.remainingBalance === 0
                  ? 'Debt cleared in full'
                  : 'Saved offline to customer ledger'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt"
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* High-contrast receipt slip */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2.5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-xs font-medium text-slate-500">Amount Paid</span>
              <span className="font-mono text-2xl font-bold text-emerald-700 tabular-nums">
                {formatNaira(receipt.amountPaid)}
              </span>
            </div>
            <div className="h-px bg-slate-200" />
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="text-slate-500">Customer</span>
              <span className="font-semibold text-slate-900 text-right">{receipt.customerName}</span>
            </div>
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="text-slate-500">Item</span>
              <span className="font-medium text-slate-800 text-right">{receipt.tyreDescription}</span>
            </div>
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="text-slate-500">Date & Time</span>
              <span className="font-mono text-xs font-medium text-slate-800 tabular-nums text-right">
                {formatDateTime(receipt.paidAt)}
              </span>
            </div>
            <div className="h-px bg-slate-200" />
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="text-slate-600 font-medium">Remaining Balance</span>
              <span
                className={`font-mono text-base font-bold tabular-nums ${
                  receipt.remainingBalance === 0 ? 'text-emerald-700' : 'text-slate-900'
                }`}
              >
                {receipt.remainingBalance === 0 ? '₦0 (Cleared)' : formatNaira(receipt.remainingBalance)}
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[52px] flex items-center justify-center gap-2.5 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 active:scale-[0.98] transition-transform"
            >
              <MessageCircle className="w-5 h-5 shrink-0" />
              <span>Share Receipt on WhatsApp</span>
            </a>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleCopy}
                className="min-h-[46px] flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 active:scale-[0.98] transition-transform"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-700" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[46px] rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 active:scale-[0.98] transition-transform"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
