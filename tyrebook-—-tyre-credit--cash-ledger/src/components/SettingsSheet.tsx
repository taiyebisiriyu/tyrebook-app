import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Cloud,
  Database,
  Download,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
  WifiOff,
  X,
} from 'lucide-react';
import type { SyncStatusMode, TyreBookSnapshot } from '../types/models';
import { formatDateTime } from '../utils/format';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: TyreBookSnapshot;
  isOnline: boolean;
  syncStatus: SyncStatusMode;
  syncProviderName: 'local' | 'supabase';
  syncMessage: string;
  onSyncNow: () => Promise<{ ok: boolean; error?: string; data?: string }>;
  onUpdateShopName: (name: string) => void;
  onExportBackup: () => { ok: boolean; error?: string };
  onRestoreBackup: (jsonText: string) => { ok: boolean; error?: string };
  onClearSampleData: () => void;
  onReloadSampleData: () => void;
}

export const SettingsSheet: React.FC<SettingsSheetProps> = ({
  isOpen,
  onClose,
  snapshot,
  isOnline,
  syncStatus,
  syncProviderName,
  syncMessage,
  onSyncNow,
  onUpdateShopName,
  onExportBackup,
  onRestoreBackup,
  onClearSampleData,
  onReloadSampleData,
}) => {
  const [shopNameInput, setShopNameInput] = useState(snapshot.meta.shop_name);
  const [confirmClear, setConfirmClear] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSaveShopName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopNameInput.trim()) return;
    onUpdateShopName(shopNameInput);
    setFeedback({ type: 'ok', text: 'Shop name updated for receipts.' });
  };

  const handleExport = () => {
    const res = onExportBackup();
    setFeedback(
      res.ok
        ? { type: 'ok', text: 'JSON backup downloaded to your device.' }
        : { type: 'err', text: res.error || 'Export failed.' }
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      const res = onRestoreBackup(content);
      setFeedback(
        res.ok
          ? { type: 'ok', text: 'Backup restored successfully to IndexedDB.' }
          : { type: 'err', text: res.error || 'Restore failed.' }
      );
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSyncClick = async () => {
    const res = await onSyncNow();
    setFeedback({
      type: res.ok ? 'ok' : 'err',
      text: res.data || res.error || 'Sync checked.',
    });
  };

  const handleConfirmClear = () => {
    onClearSampleData();
    setConfirmClear(false);
    setFeedback({
      type: 'ok',
      text: 'All sample records cleared. Ready for live shop use.',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="w-full sm:max-w-lg max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl border-t sm:border border-slate-200 overflow-hidden">
        <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 sm:hidden shrink-0" />

        <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-200 shrink-0">
          <div>
            <h2 id="settings-title" className="text-lg font-bold text-slate-900">
              Backup, Sync & Settings
            </h2>
            <p className="text-xs text-slate-500">
              Offline-first IndexedDB storage · Zero-cost JSON recovery
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-6 pb-safe">
          {feedback && (
            <div
              className={`rounded-xl px-4 py-3 text-sm font-medium border ${
                feedback.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {/* Sync & Offline Status Section */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Storage & Cloud Sync</h3>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {isOnline ? (
                    <Cloud className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {!isOnline
                        ? 'Offline — Saved Locally in IndexedDB'
                        : syncStatus === 'backed_up'
                          ? 'Online — Backed Up'
                          : 'Online — Saved Locally on Phone'}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Adapter:{' '}
                      {syncProviderName === 'supabase'
                        ? 'Supabase Cloud Sync Active'
                        : 'Local IndexedDB (Supabase adapter ready via env vars)'}
                    </p>
                    {snapshot.meta.last_synced_at && (
                      <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                        Last synced: {formatDateTime(snapshot.meta.last_synced_at)}
                      </p>
                    )}
                    {snapshot.meta.last_backup_at && (
                      <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                        Last JSON export: {formatDateTime(snapshot.meta.last_backup_at)}
                      </p>
                    )}
                    {syncMessage && (
                      <p
                        className={`text-xs mt-1.5 font-medium break-words ${
                          syncMessage.toLowerCase().includes('failed') ||
                          syncMessage.toLowerCase().includes('error')
                            ? 'text-red-700'
                            : 'text-emerald-800'
                        }`}
                      >
                        {syncMessage}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs text-slate-600 pt-2 border-t border-slate-200 font-mono tabular-nums">
                <div>Inventory: {snapshot.inventory.length} items</div>
                <div>Customers: {snapshot.customers.length} records</div>
                <div>Contracts: {snapshot.credit_contracts.length} total</div>
                <div>Payments: {snapshot.payments.length} entries</div>
              </div>

              <button
                type="button"
                onClick={handleSyncClick}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100 active:scale-[0.98] transition-transform"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Verify & Sync Storage</span>
              </button>
            </div>
          </section>

          {/* Manual JSON Backup & Restore */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Manual JSON Backup & Restore</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Export your entire ledger to a JSON file and save it to Google Drive or WhatsApp
              yourself weekly for zero-cost recovery if you change phones.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleExport}
                className="min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 active:scale-[0.98] transition-transform"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Export Backup JSON</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[48px] flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 active:scale-[0.98] transition-transform"
              >
                <Upload className="w-4 h-4 shrink-0" />
                <span>Restore Backup</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </section>

          {/* Install App to Home Screen */}
          <PWAInstallButton variant="full" />

          {/* Shop Name on Receipts */}
          <section className="space-y-2.5">
            <h3 className="text-sm font-bold text-slate-900">Business Name (Shown on Receipts)</h3>
            <form onSubmit={handleSaveShopName} className="flex gap-2">
              <input
                type="text"
                value={shopNameInput}
                onChange={(e) => setShopNameInput(e.target.value)}
                placeholder="e.g. Kolawole Tyres & Credit"
                className="flex-1 min-h-[46px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
              <button
                type="submit"
                className="min-h-[46px] rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 shrink-0"
              >
                Save
              </button>
            </form>
          </section>

          {/* Sample Data Handover Controls */}
          <section className="space-y-3 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-700" />
              <h3 className="text-sm font-bold text-slate-900">Client Handover & Sample Data</h3>
            </div>

            {!confirmClear ? (
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 hover:bg-red-100 active:scale-[0.98] transition-transform"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span>Clear Sample Data (Start Fresh)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onReloadSampleData();
                    setFeedback({ type: 'ok', text: 'Nigerian tyre shop sample data reloaded.' });
                  }}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>Reload Sample Demo Data</span>
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-red-300 bg-red-50 p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                  <div className="text-sm text-red-900">
                    <p className="font-bold">Wipe all current records?</p>
                    <p className="text-xs text-red-800 mt-1">
                      This clears all inventory, customers, credit contracts, payments, and cash
                      sales so you can hand over a clean ledger. Export a backup first if needed.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmClear}
                    className="min-h-[44px] rounded-xl bg-red-700 text-sm font-semibold text-white hover:bg-red-800"
                  >
                    Yes, Clear All
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
