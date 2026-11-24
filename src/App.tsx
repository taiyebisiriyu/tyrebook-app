import React, { useCallback, useState } from 'react';
import {
  Cloud,
  CloudOff,
  Home,
  Package,
  PlusCircle,
  RefreshCw,
  Settings,
  Users,
} from 'lucide-react';
import { DebtorsScreen } from './components/DebtorsScreen';
import { HomeScreen } from './components/HomeScreen';
import { NewSaleScreen } from './components/NewSaleScreen';
import { PWAInstallButton } from './components/PWAInstallButton';
import { ReceiptSheet } from './components/ReceiptSheet';
import { SettingsSheet } from './components/SettingsSheet';
import { StockScreen } from './components/StockScreen';
import { useTyreBookStore } from './hooks/useTyreBookStore';
import type { NavTab, ReceiptData } from './types/models';

export default function App() {
  const {
    snapshot,
    isLoading,
    isOnline,
    syncStatus,
    syncProviderName,
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
  } = useTyreBookStore();

  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [preselectedSaleCustomerId, setPreselectedSaleCustomerId] = useState<string | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleOpenCustomerLedger = useCallback((customerId: string) => {
    setSelectedCustomerId(customerId);
    setActiveTab('debtors');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleStartCreditSaleForCustomer = useCallback((customerId: string) => {
    setPreselectedSaleCustomerId(customerId);
    setActiveTab('new-sale');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleTabChange = useCallback((tab: NavTab) => {
    setActiveTab(tab);
    if (tab !== 'debtors') {
      setSelectedCustomerId(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const syncLabel = !isOnline
    ? 'Offline · Saved Locally'
    : syncStatus === 'syncing'
      ? 'Syncing...'
      : syncStatus === 'backed_up'
        ? 'Online · Backed Up'
        : 'Online · Saved Locally';

  if (isLoading || !snapshot) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#F6F7F8] p-6">
        <div className="text-center space-y-2">
          <p className="font-display text-lg font-bold text-slate-900">TyreBook</p>
          <p className="text-sm text-slate-500">Opening offline ledger...</p>
        </div>
      </div>
    );
  }

  const navItems: Array<{ id: NavTab; label: string; mobileLabel: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'home', label: 'Home', mobileLabel: 'Home', icon: Home },
    { id: 'debtors', label: 'Debtors', mobileLabel: 'Debtors', icon: Users },
    { id: 'new-sale', label: 'New Sale', mobileLabel: '+ New Sale', icon: PlusCircle },
    { id: 'stock', label: 'Stock', mobileLabel: 'Stock', icon: Package },
  ];

  return (
    <div className="min-h-dvh bg-[#F6F7F8] text-slate-900 flex flex-col">
      {/* Compact Sticky Top Bar */}
      <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200 pt-safe">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => handleTabChange('home')}
            className="font-display text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 text-left"
          >
            TyreBook
          </button>

          {/* Zone 2: Desktop Navigation Links */}
          <nav
            className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-600"
            aria-label="Primary navigation"
          >
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabChange(item.id)}
                  className={`py-1.5 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                    active
                      ? 'text-slate-900 font-semibold border-emerald-700'
                      : 'border-transparent hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Sync Status Indicator & Settings Trigger + PWA Install */}
          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton variant="compact" />
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Open backup, sync and settings"
              className={`min-h-[40px] flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                !isOnline
                  ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                  : syncStatus === 'backed_up'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
                    : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
              }`}
            >
              {!isOnline ? (
                <CloudOff className="w-3.5 h-3.5 text-amber-800 shrink-0" />
              ) : syncStatus === 'syncing' ? (
                <RefreshCw className="w-3.5 h-3.5 text-slate-700 animate-spin shrink-0" />
              ) : (
                <Cloud className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              )}
              <span className="max-w-[148px] sm:max-w-none truncate">{syncLabel}</span>
              <Settings className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-0.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Scrollable Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-4 pb-24 lg:pb-10">
        {activeTab === 'home' && (
          <HomeScreen
            customers={snapshot.customers}
            contracts={snapshot.credit_contracts}
            payments={snapshot.payments}
            cashSales={snapshot.cash_sales}
            stats={dashboardStats}
            onQuickCollect={recordPayment}
            onOpenCustomerLedger={handleOpenCustomerLedger}
            onNavigate={handleTabChange}
            onReceiptGenerated={setActiveReceipt}
          />
        )}

        {activeTab === 'debtors' && (
          <DebtorsScreen
            customers={snapshot.customers}
            contracts={snapshot.credit_contracts}
            payments={snapshot.payments}
            selectedCustomerId={selectedCustomerId}
            onSelectCustomer={setSelectedCustomerId}
            onRecordPayment={recordPayment}
            onReversePayment={reversePayment}
            onReceiptGenerated={setActiveReceipt}
            onStartCreditSaleForCustomer={handleStartCreditSaleForCustomer}
          />
        )}

        {activeTab === 'new-sale' && (
          <NewSaleScreen
            inventory={snapshot.inventory}
            customers={snapshot.customers}
            contracts={snapshot.credit_contracts}
            cashSales={snapshot.cash_sales}
            preselectedCustomerId={preselectedSaleCustomerId}
            onClearPreselectedCustomer={() => setPreselectedSaleCustomerId(null)}
            onAddCustomer={addCustomer}
            onCreateCreditSale={createCreditSale}
            onCreateCashSale={createCashSale}
            onCreateOpeningMigration={createOpeningMigration}
            onOpenCustomerLedger={handleOpenCustomerLedger}
          />
        )}

        {activeTab === 'stock' && (
          <StockScreen
            inventory={snapshot.inventory}
            onAddTyre={addTyre}
            onRestockTyre={restockTyre}
          />
        )}
      </main>

      {/* Android One-Handed Fixed Bottom Navigation (Mobile & Tablet) */}
      <nav
        aria-label="Bottom navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
      >
        <div className="grid grid-cols-4 items-center h-16 max-w-xl mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabChange(item.id)}
                className={`min-h-[56px] flex flex-col items-center justify-center gap-1 px-1 transition-colors ${
                  active ? 'text-emerald-800' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : 'stroke-[2]'}`} />
                <span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
                  {item.mobileLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Instant Payment Receipt & WhatsApp Share Sheet */}
      <ReceiptSheet receipt={activeReceipt} onClose={() => setActiveReceipt(null)} />

      {/* Backup, Sync & Settings Drawer */}
      <SettingsSheet
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        snapshot={snapshot}
        isOnline={isOnline}
        syncStatus={syncStatus}
        syncProviderName={syncProviderName}
        syncMessage={syncMessage}
        onSyncNow={syncNow}
        onUpdateShopName={updateShopName}
        onExportBackup={exportBackupJson}
        onRestoreBackup={restoreBackupJson}
        onClearSampleData={clearSampleData}
        onReloadSampleData={reloadSampleData}
      />
    </div>
  );
}
