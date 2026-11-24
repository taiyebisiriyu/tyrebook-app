import React, { useMemo, useState } from 'react';
import { AlertTriangle, PackagePlus, Plus, Search, X } from 'lucide-react';
import type { InventoryItem, TyreCondition } from '../types/models';
import { formatNaira } from '../utils/format';

type StockFilter = 'all' | 'New' | 'Tokunbo' | 'low';

interface StockScreenProps {
  inventory: InventoryItem[];
  onAddTyre: (input: {
    brand: string;
    size: string;
    condition: TyreCondition;
    stock_qty: number;
    cash_price: number;
    credit_price: number;
  }) => { ok: boolean; error?: string };
  onRestockTyre: (tyreId: string, addQty: number) => { ok: boolean; error?: string };
}

const COMMON_SIZES = ['185/65 R15', '195/65 R15', '205/55 R16', '215/60 R16', '265/65 R17'];

export const StockScreen: React.FC<StockScreenProps> = ({
  inventory,
  onAddTyre,
  onRestockTyre,
}) => {
  const [filter, setFilter] = useState<StockFilter>('all');
  const [search, setSearch] = useState('');

  // Add New Tyre sheet state
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('');
  const [condition, setCondition] = useState<TyreCondition>('New');
  const [stockQty, setStockQty] = useState('4');
  const [cashPrice, setCashPrice] = useState('');
  const [creditPrice, setCreditPrice] = useState('');
  const [formError, setFormError] = useState('');

  // Restock sheet state
  const [restockTarget, setRestockTarget] = useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty] = useState('4');

  const totalUnits = useMemo(
    () => inventory.reduce((sum, item) => sum + item.stock_qty, 0),
    [inventory]
  );
  const lowStockCount = useMemo(
    () => inventory.filter((item) => item.stock_qty <= 3).length,
    [inventory]
  );

  const filteredInventory = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inventory.filter((item) => {
      if (filter === 'New' && item.condition !== 'New') return false;
      if (filter === 'Tokunbo' && item.condition !== 'Tokunbo') return false;
      if (filter === 'low' && item.stock_qty > 3) return false;
      if (!q) return true;
      return (
        item.brand.toLowerCase().includes(q) ||
        item.size.toLowerCase().includes(q) ||
        item.condition.toLowerCase().includes(q)
      );
    });
  }, [inventory, filter, search]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onAddTyre({
      brand,
      size,
      condition,
      stock_qty: Number(stockQty) || 0,
      cash_price: Number(cashPrice) || 0,
      credit_price: Number(creditPrice) || 0,
    });
    if (!res.ok) {
      setFormError(res.error || 'Could not save tyre.');
      return;
    }
    setShowAddSheet(false);
    setBrand('');
    setSize('');
    setCondition('New');
    setStockQty('4');
    setCashPrice('');
    setCreditPrice('');
    setFormError('');
  };

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockTarget) return;
    const res = onRestockTyre(restockTarget.id, Number(restockQty) || 0);
    if (res.ok) {
      setRestockTarget(null);
      setRestockQty('4');
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Action Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Tyre Inventory</h2>
          <p className="text-xs text-slate-500 tabular-nums">
            {totalUnits} total tyres in shop · {lowStockCount} low stock (≤ 3)
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormError('');
            setShowAddSheet(true);
          }}
          className="min-h-[46px] flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 active:scale-[0.98] transition-transform whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Tyre</span>
        </button>
      </div>

      {/* Search & Filter Controls */}
      <div className="space-y-3 sm:flex sm:items-center sm:gap-3 sm:space-y-0">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brand or size (e.g. 205/55 R16)..."
            className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear stock search"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center absolute right-1 top-1/2 -translate-y-1/2 text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200/80 rounded-xl shrink-0">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'New', label: 'New' },
              { id: 'Tokunbo', label: 'Tokunbo' },
              { id: 'low', label: `Low (${lowStockCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`min-h-[38px] rounded-lg px-2.5 text-xs font-semibold transition-colors whitespace-nowrap tabular-nums ${
                filter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tyre Inventory List / Responsive Grid */}
      {filteredInventory.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center space-y-2">
          <p className="text-base font-bold text-slate-900">No tyres found</p>
          <p className="text-sm text-slate-500">
            Tap &ldquo;Add New Tyre&rdquo; to stock your shop sizes and pricing.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredInventory.map((item) => {
            const isOut = item.stock_qty === 0;
            const isLow = item.stock_qty > 0 && item.stock_qty <= 3;

            return (
              <article
                key={item.id}
                className="rounded-2xl bg-white border border-slate-200 p-4 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-base font-bold text-slate-900 tracking-tight">
                        {item.size}
                      </p>
                      <p className="text-sm text-slate-600">
                        {item.brand} · {item.condition}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="block text-[11px] text-slate-500">In Stock</span>
                      <span
                        className={`font-mono text-lg font-bold tabular-nums ${
                          isOut
                            ? 'text-red-700'
                            : isLow
                              ? 'text-amber-800'
                              : 'text-slate-900'
                        }`}
                      >
                        {item.stock_qty}
                      </span>
                    </div>
                  </div>

                  {/* Low-stock / Out-of-stock semantic badge (<= 3 rule) */}
                  {(isLow || isOut) && (
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold ${
                        isOut
                          ? 'bg-red-50 text-red-800 border border-red-200'
                          : 'bg-amber-50 text-amber-900 border border-amber-200'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {isOut ? 'Out of Stock' : `Low Stock · ${item.stock_qty} left`}
                      </span>
                    </div>
                  )}

                  {/* Pricing Pair */}
                  <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                    <div>
                      <span className="block text-[11px] text-slate-500">Cash Price</span>
                      <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                        {formatNaira(item.cash_price)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-500">Credit Price</span>
                      <span className="font-mono text-sm font-bold text-emerald-800 tabular-nums">
                        {formatNaira(item.credit_price)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setRestockTarget(item);
                    setRestockQty('4');
                  }}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-50 text-sm font-semibold text-slate-900 hover:bg-slate-100 active:scale-[0.98] transition-transform"
                >
                  <PackagePlus className="w-4 h-4 shrink-0" />
                  <span>+ Restock</span>
                </button>
              </article>
            );
          })}
        </div>
      )}

      {/* Add New Tyre Bottom Sheet */}
      {showAddSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full sm:max-w-md max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl border-t sm:border border-slate-200 overflow-hidden">
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 sm:hidden shrink-0" />
            <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-bold text-slate-900">Add New Tyre</h3>
              <button
                type="button"
                onClick={() => setShowAddSheet(false)}
                aria-label="Close add tyre form"
                className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="overflow-y-auto p-5 space-y-4 pb-safe">
              {formError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm font-medium text-red-800">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Brand *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Michelin, Triangle, Dunlop"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tyre Size *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 205/55 R16"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {COMMON_SIZES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSize(s)}
                      className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs text-slate-700 hover:bg-slate-100"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Condition
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
                    {(['New', 'Tokunbo'] as const).map((cond) => (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => setCondition(cond)}
                        className={`min-h-[38px] rounded-lg text-xs font-semibold transition ${
                          condition === cond
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        {cond}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Opening Stock Qty
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    required
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                    className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-base font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Cash Price (₦) *
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    required
                    placeholder="e.g. 60000"
                    value={cashPrice}
                    onChange={(e) => setCashPrice(e.target.value)}
                    className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-base font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Credit Price (₦) *
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    required
                    placeholder="e.g. 75000"
                    value={creditPrice}
                    onChange={(e) => setCreditPrice(e.target.value)}
                    className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-base font-bold text-slate-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full min-h-[52px] rounded-xl bg-emerald-700 text-base font-bold text-white hover:bg-emerald-800 active:scale-[0.98] transition-transform"
              >
                Save to Inventory
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Quick Restock Bottom Sheet */}
      {restockTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl border-t sm:border border-slate-200 overflow-hidden pb-safe">
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 sm:hidden" />
            <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Restock Tyre</h3>
                <p className="text-xs text-slate-500">
                  {restockTarget.size} {restockTarget.brand} ({restockTarget.condition}) · Current:{' '}
                  {restockTarget.stock_qty}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRestockTarget(null)}
                className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Units Arriving (Add to Stock)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full min-h-[52px] rounded-xl border border-slate-300 bg-white px-4 font-mono text-2xl font-bold text-slate-900 tabular-nums"
                />
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 4, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRestockQty(String(n))}
                    className="min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 font-mono text-sm font-bold text-slate-900 hover:bg-slate-100"
                  >
                    +{n}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                className="w-full min-h-[50px] rounded-xl bg-slate-900 text-sm font-bold text-white hover:bg-slate-800 active:scale-[0.98] transition-transform"
              >
                Add {Number(restockQty) || 0} Unit(s) · New Total{' '}
                {restockTarget.stock_qty + (Number(restockQty) || 0)}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
