'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  BarChart2,
} from 'lucide-react';
import { dashboardApi } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────
interface HourSlot   { hour: number; orders: number; revenue: number }
interface TypeSlot   { type: string; count: number; revenue: number; pct: number }
interface ItemSlot   { rank: number; id: string; name: string; qty: number; revenue: number }
interface RecentOrder {
  id: string; billNo: string; orderType: string; tableNumber: number | null;
  totalAmount: number; status: string; settlementStatus: string;
  paymentMethod: string; createdAt: string;
}
interface DashboardData {
  today:     { revenue: number; orders: number; avgOrderValue: number; cancelledToday: number };
  yesterday: { revenue: number; orders: number };
  week:      { revenue: number; orders: number };
  month:     { revenue: number; orders: number };
  growth:    { revenue: number | null; orders: number | null };
  hourly:         HourSlot[];
  orderTypeBreakdown: TypeSlot[];
  topItemsToday:  ItemSlot[];
  topItemsWeek:   ItemSlot[];
  recentOrders:   RecentOrder[];
}

// ─── Helpers ──────────────────────────────────────────────────────
const fc  = (v: number) => `₹${Number(v || 0).toFixed(2)}`;
const fcs = (v: number) => {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000)   return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${Number(v).toFixed(0)}`;
};

const TYPE_COLORS: Record<string, string> = {
  DINE_IN:   'bg-blue-500',
  TAKE_AWAY: 'bg-orange-500',
  ONLINE:    'bg-purple-500',
  QR:        'bg-cyan-500',
};
const TYPE_TEXT: Record<string, string> = {
  DINE_IN:   'text-blue-700',
  TAKE_AWAY: 'text-orange-700',
  ONLINE:    'text-purple-700',
  QR:        'text-cyan-700',
};
const PMT_BADGE: Record<string, string> = {
  CASH:    'bg-emerald-100 text-emerald-700',
  QR:      'bg-cyan-100    text-cyan-700',
  CARD:    'bg-blue-100    text-blue-700',
  SPLIT:   'bg-orange-100  text-orange-700',
  UNKNOWN: 'bg-gray-100    text-gray-600',
};

// ─── Sub-components ───────────────────────────────────────────────
function GrowthBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[11px] text-gray-400">—</span>;
  if (value > 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
      <TrendingUp className="w-3 h-3" />+{value}%
    </span>
  );
  if (value < 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-500">
      <TrendingDown className="w-3 h-3" />{value}%
    </span>
  );
  return <span className="inline-flex items-center gap-0.5 text-xs text-gray-400"><Minus className="w-3 h-3" />0%</span>;
}

function StatCard({
  label, value, sub, accent = false, color = 'text-slate-900',
}: { label: string; value: string; sub?: React.ReactNode; accent?: boolean; color?: string }) {
  return (
    <div className={clsx(
      'rounded-2xl p-5 shadow-sm',
      accent
        ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white'
        : 'bg-white border border-gray-100',
    )}>
      <div className={clsx('text-[10px] uppercase tracking-[0.18em] mb-1', accent ? 'opacity-70' : 'text-gray-400')}>
        {label}
      </div>
      <div className={clsx('text-3xl font-black', accent ? 'text-white' : color)}>{value}</div>
      {sub && <div className={clsx('mt-1.5 text-xs', accent ? 'opacity-80' : 'text-gray-400')}>{sub}</div>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [data, setData]           = useState<DashboardData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await dashboardApi.summary();
      setData(res.data);
      setLastRefresh(new Date());
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const maxHourOrders   = data ? Math.max(...data.hourly.map(h => h.orders), 1)         : 1;
  const maxTodayQty     = data?.topItemsToday[0]?.qty  ?? 1;
  const maxWeekQty      = data?.topItemsWeek[0]?.qty   ?? 1;

  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50/30 to-white">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-6">

        {/* ── Header ── */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-lg hover:bg-white/70 border border-transparent hover:border-gray-200">
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-orange-600 tracking-tight">Dashboard</h1>
              <p className="text-[11px] text-gray-400">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                {lastRefresh && ` · Refreshed ${lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
                {' · Auto-refreshes every 30s'}
              </p>
            </div>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
        </header>

        {/* ── Skeleton ── */}
        {loading && !data && (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={clsx('h-28 rounded-2xl bg-gray-100 animate-pulse', i === 0 ? 'col-span-2' : '')} />
            ))}
          </div>
        )}

        {data && (
          <>
            {/* ── Row 1: KPI cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-5">
              {/* Today Revenue — full-colour hero card */}
              <div className="col-span-2 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white p-5 shadow-md">
                <div className="text-[10px] uppercase tracking-widest opacity-75 mb-1">Today Revenue</div>
                <div className="text-4xl font-black">{fcs(data.today.revenue)}</div>
                <div className="text-sm opacity-80 mt-0.5">{fc(data.today.revenue)}</div>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <GrowthBadge value={data.growth.revenue} />
                  <span className="text-[11px] opacity-70">vs yesterday ({fcs(data.yesterday.revenue)})</span>
                </div>
              </div>

              {/* Orders today */}
              <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
                <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Orders Today</div>
                <div className="text-3xl font-black text-slate-900">{data.today.orders}</div>
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <GrowthBadge value={data.growth.orders} />
                  <span className="text-[11px] text-gray-400">vs {data.yesterday.orders} yesterday</span>
                </div>
              </div>

              {/* Avg order value */}
              <StatCard
                label="Avg Order"
                value={fcs(data.today.avgOrderValue)}
                sub="per bill today"
                color="text-blue-600"
              />

              {/* Cancelled */}
              <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
                <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Cancelled</div>
                <div className={clsx('text-3xl font-black', data.today.cancelledToday > 0 ? 'text-red-500' : 'text-gray-300')}>
                  {data.today.cancelledToday}
                </div>
                <div className="text-[11px] text-gray-400 mt-1">orders today</div>
              </div>

              {/* Week */}
              <StatCard label="This Week"  value={fcs(data.week.revenue)}  sub={`${data.week.orders} orders`}  color="text-indigo-600" />
              {/* Month */}
              <StatCard label="This Month" value={fcs(data.month.revenue)} sub={`${data.month.orders} orders`} color="text-emerald-600" />
            </div>

            {/* ── Row 2: Hourly chart + Order types ── */}
            <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-4 mb-5">

              {/* Hourly bar chart */}
              <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-bold text-gray-600 uppercase tracking-widest">Hourly Orders — Today</h2>
                  <span className="text-[11px] text-gray-400">Hover a bar for detail</span>
                </div>
                <div className="flex items-end gap-[3px] h-32">
                  {data.hourly.map(h => {
                    const pct = maxHourOrders > 0 ? (h.orders / maxHourOrders) * 100 : 0;
                    const isPeakHour = h.orders > 0 && h.orders === maxHourOrders;
                    return (
                      <div key={h.hour} className="flex-1 flex flex-col items-center group relative">
                        {/* tooltip */}
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] rounded-lg px-2 py-1 opacity-0 group-hover:opacity-100 whitespace-nowrap z-20 pointer-events-none shadow-lg">
                          {String(h.hour).padStart(2, '0')}:00
                          <br />{h.orders} order{h.orders !== 1 ? 's' : ''}
                          {h.revenue > 0 && <><br />{fc(h.revenue)}</>}
                        </div>
                        <div
                          className={clsx(
                            'w-full rounded-t-sm transition-all cursor-default',
                            h.orders === 0
                              ? 'bg-gray-100'
                              : isPeakHour
                                ? 'bg-orange-600 hover:bg-orange-700'
                                : 'bg-orange-400 hover:bg-orange-500',
                          )}
                          style={{ height: pct > 0 ? `${Math.max(pct, 6)}%` : '3px' }}
                        />
                        {/* x-axis label every 6h */}
                        {h.hour % 6 === 0 && (
                          <span className="absolute -bottom-5 text-[9px] text-gray-400">
                            {h.hour === 0 ? '12A' : h.hour === 12 ? '12P' : h.hour < 12 ? `${h.hour}A` : `${h.hour - 12}P`}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 flex items-center gap-4 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-600 inline-block" />Peak hour</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-400 inline-block" />Active hours</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-100 inline-block border" />No orders</span>
                </div>
              </div>

              {/* Order type breakdown */}
              <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
                <h2 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-4">Order Types — Today</h2>
                {data.orderTypeBreakdown.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-sm text-gray-400">No orders today</div>
                ) : (
                  <div className="space-y-4">
                    {data.orderTypeBreakdown.map(t => (
                      <div key={t.type}>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className={clsx('w-2.5 h-2.5 rounded-full', TYPE_COLORS[t.type] || 'bg-gray-400')} />
                            <span className={clsx('font-semibold', TYPE_TEXT[t.type] || 'text-gray-700')}>
                              {t.type.replace('_', ' ')}
                            </span>
                          </div>
                          <span className="text-gray-500">{t.count} · <span className="font-semibold">{t.pct}%</span></span>
                        </div>
                        <div className="h-2.5 rounded-full bg-gray-100">
                          <div
                            className={clsx('h-2.5 rounded-full', TYPE_COLORS[t.type] || 'bg-gray-400')}
                            style={{ width: `${t.pct}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5 text-right">{fc(t.revenue)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Row 3: Top items ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">

              {/* Top items today */}
              <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
                <h2 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Star className="w-4 h-4 text-orange-500" />
                  Top Items — Today
                </h2>
                {data.topItemsToday.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-sm text-gray-400">No paid sales today</div>
                ) : (
                  <div className="space-y-4">
                    {data.topItemsToday.map(item => (
                      <div key={item.id}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={clsx(
                            'w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0',
                            item.rank <= 3 ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600',
                          )}>
                            {item.rank}
                          </span>
                          <span className="text-sm font-semibold text-slate-800 flex-1 truncate">{item.name}</span>
                          <span className="text-base font-black text-orange-600 shrink-0">{item.qty}×</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 ml-9">
                          <div
                            className="h-1.5 rounded-full bg-orange-400"
                            style={{ width: `${maxTodayQty > 0 ? (item.qty / maxTodayQty) * 100 : 0}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-gray-400 ml-9 mt-0.5">{fc(item.revenue)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top items this week */}
              <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
                <h2 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-indigo-500" />
                  Top Items — This Week
                </h2>
                {data.topItemsWeek.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-sm text-gray-400">No paid sales this week</div>
                ) : (
                  <div className="space-y-4">
                    {data.topItemsWeek.map(item => (
                      <div key={item.id}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={clsx(
                            'w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0',
                            item.rank <= 3 ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600',
                          )}>
                            {item.rank}
                          </span>
                          <span className="text-sm font-semibold text-slate-800 flex-1 truncate">{item.name}</span>
                          <span className="text-base font-black text-indigo-600 shrink-0">{item.qty}×</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 ml-9">
                          <div
                            className="h-1.5 rounded-full bg-indigo-400"
                            style={{ width: `${maxWeekQty > 0 ? (item.qty / maxWeekQty) * 100 : 0}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-gray-400 ml-9 mt-0.5">{fc(item.revenue)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Row 4: Recent completed orders ── */}
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50 flex items-center justify-between">
                <h2 className="text-xs font-bold text-gray-600 uppercase tracking-widest">Recent Completed Orders</h2>
                <span className="text-[11px] text-gray-400">Last 10 paid bills</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-widest">
                    <tr>
                      <th className="px-5 py-3 text-left">Bill #</th>
                      <th className="px-5 py-3 text-left">Type</th>
                      <th className="px-5 py-3 text-left">Table</th>
                      <th className="px-5 py-3 text-right">Amount</th>
                      <th className="px-5 py-3 text-left">Payment</th>
                      <th className="px-5 py-3 text-left">Time</th>
                      <th className="px-5 py-3 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-gray-400">
                          No completed orders yet
                        </td>
                      </tr>
                    ) : (
                      data.recentOrders.map(o => (
                        <tr key={o.id} className="border-t border-gray-50 hover:bg-orange-50/30 transition-colors">
                          <td className="px-5 py-3 font-semibold text-slate-800">#{o.billNo}</td>
                          <td className="px-5 py-3">
                            <span className={clsx(
                              'inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold text-white',
                              TYPE_COLORS[o.orderType] || 'bg-gray-400',
                            )}>
                              {o.orderType.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-gray-600">
                            {o.tableNumber ? `T-${o.tableNumber}` : '—'}
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-slate-900">{fc(o.totalAmount)}</td>
                          <td className="px-5 py-3">
                            <span className={clsx(
                              'inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold',
                              PMT_BADGE[o.paymentMethod] || PMT_BADGE.UNKNOWN,
                            )}>
                              {o.paymentMethod}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-gray-500 text-xs">
                            {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-5 py-3 text-gray-400 text-xs">
                            {new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
