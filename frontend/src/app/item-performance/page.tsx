'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { ArrowLeft, RefreshCw, RotateCcw, BarChart3 } from 'lucide-react';
import { ordersApi } from '@/lib/api';
import type { ItemPerformanceEntry, OrderType } from '@/types';

const orderModeOptions: Array<'ALL' | OrderType> = ['ALL', 'DINE_IN', 'TAKE_AWAY', 'ONLINE', 'QR'];

const formatCurrency = (v: number) => `₹${Number(v || 0).toFixed(2)}`;

export default function ItemPerformancePage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [orderType, setOrderType] = useState<'ALL' | OrderType>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    totalItems: 0,
    totalQuantity: 0,
    totalSales: 0,
  });
  const [entries, setEntries] = useState<ItemPerformanceEntry[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await ordersApi.itemPerformance({
        from,
        to,
        orderType,
        search: search.trim() || undefined,
      });
      setSummary(res.data.summary);
      setEntries(res.data.entries);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load item performance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetFilters = () => {
    setFrom('');
    setTo('');
    setOrderType('ALL');
    setSearch('');
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50">
      <div className="max-w-[1260px] mx-auto px-3 sm:px-6 py-6 sm:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/" className="p-2 rounded-lg hover:bg-white/70 border border-transparent hover:border-gray-200">
                <ArrowLeft className="w-4 h-4 text-gray-600" />
              </Link>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-700">Item Performance</h1>
            </div>
            <p className="text-[11px] sm:text-xs tracking-[0.2em] uppercase text-emerald-500 mt-2">
              Sold items ranked by quantity from high to low
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Loads all paid sales by default. Use dates only when you want to narrow the report.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full sm:w-auto">
            <div className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 shadow-sm">
              <div className="text-[10px] tracking-[0.2em] text-gray-400 uppercase">Unique Items</div>
              <div className="text-3xl font-black text-emerald-700">{summary.totalItems}</div>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 shadow-sm">
              <div className="text-[10px] tracking-[0.2em] text-gray-400 uppercase">Total Qty Sold</div>
              <div className="text-3xl font-black text-lime-700">{summary.totalQuantity}</div>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 shadow-sm">
              <div className="text-[10px] tracking-[0.2em] text-gray-400 uppercase">Gross Sales</div>
              <div className="text-3xl font-black text-slate-800">{formatCurrency(summary.totalSales)}</div>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-emerald-100 bg-white/95 shadow-sm p-4 sm:p-5">
          <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1.1fr_0.9fr_1.5fr_auto] gap-3 items-end">
            <label className="text-xs text-gray-500 uppercase tracking-wide">
              From
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
              />
            </label>

            <label className="text-xs text-gray-500 uppercase tracking-wide">
              To
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
              />
            </label>

            <label className="text-xs text-gray-500 uppercase tracking-wide">
              Order Mode
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as 'ALL' | OrderType)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
              >
                {orderModeOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="text-xs text-gray-500 uppercase tracking-wide">
              Search Item
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') load();
                }}
                placeholder="Search by item name"
                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
              />
            </label>

            <div className="flex gap-2 xl:justify-end">
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                <RotateCcw className="w-4 h-4" /> Reset
              </button>
              <button
                onClick={load}
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} /> Apply
              </button>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-emerald-100 bg-white/95 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-lime-50 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white inline-flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Sold Items Ranking</h2>
              <p className="text-sm text-slate-500">Highest quantity first</p>
            </div>
          </div>

          {entries.length === 0 ? (
            <div className="px-6 py-16 text-center text-gray-500">No sold items found for the selected filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-[0.18em]">
                  <tr>
                    <th className="px-4 sm:px-6 py-4 text-left">Rank</th>
                    <th className="px-4 sm:px-6 py-4 text-left">Item</th>
                    <th className="px-4 sm:px-6 py-4 text-right">Qty Sold</th>
                    <th className="px-4 sm:px-6 py-4 text-right">% of Items</th>
                    <th className="px-4 sm:px-6 py-4 text-right">% of Sales</th>
                    <th className="px-4 sm:px-6 py-4 text-right">Orders</th>
                    <th className="px-4 sm:px-6 py-4 text-right">Gross Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const totalQty = entries.reduce((s, e) => s + e.totalQuantity, 0);
                    const totalSalesAmt = entries.reduce((s, e) => s + e.grossSales, 0);
                    return entries.map((entry, index) => {
                      const qtyPct = totalQty > 0 ? ((entry.totalQuantity / totalQty) * 100).toFixed(1) : '0.0';
                      const salesPct = totalSalesAmt > 0 ? ((entry.grossSales / totalSalesAmt) * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={entry.menuItemId} className="border-t border-slate-100 hover:bg-emerald-50/40">
                          <td className="px-4 sm:px-6 py-4">
                            <span className={clsx(
                              'inline-flex min-w-10 items-center justify-center rounded-full px-3 py-1 text-xs font-bold',
                              index < 3 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700',
                            )}>
                              #{entry.rank}
                            </span>
                          </td>
                          <td className="px-4 sm:px-6 py-4">
                            <div className="font-semibold text-slate-900">{entry.menuItemName}</div>
                            <div className="text-xs text-slate-400">{entry.menuItemId}</div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-right text-lg font-black text-emerald-700">{entry.totalQuantity}</td>
                          <td className="px-4 sm:px-6 py-4 text-right">
                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-lime-700">
                              {qtyPct}%
                            </span>
                            <div className="mt-1 h-1.5 w-20 rounded-full bg-slate-100 ml-auto">
                              <div className="h-1.5 rounded-full bg-lime-500" style={{ width: `${qtyPct}%` }} />
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-right">
                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700">
                              {salesPct}%
                            </span>
                            <div className="mt-1 h-1.5 w-20 rounded-full bg-slate-100 ml-auto">
                              <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${salesPct}%` }} />
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-right font-semibold text-slate-700">{entry.orderCount}</td>
                          <td className="px-4 sm:px-6 py-4 text-right font-semibold text-slate-900">{formatCurrency(entry.grossSales)}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}