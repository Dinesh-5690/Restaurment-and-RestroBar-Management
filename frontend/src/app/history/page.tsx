'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, RefreshCw, RotateCcw, Printer, Download } from 'lucide-react';
import clsx from 'clsx';
import * as XLSX from 'xlsx';
import { ordersApi } from '@/lib/api';
import { getPrintSettings, getPrintSettingsAsync } from '@/lib/printSettings';
import { buildReceiptPayloadFromOrder, printCommonReceipt } from '@/lib/receiptPrint';
import PaymentModal, { type ReceiptItem as PaymentReceiptItem, type PaymentMethod as PaymentSettleMethod } from '@/components/pos/PaymentModal';
import type { Order, OrderType, PaymentMethod, SettlementStatus } from '@/types';

const settlementOptions: Array<'ALL' | SettlementStatus> = ['ALL', 'PAID', 'UNPAID', 'CANCELLED', 'REFUNDED'];
const orderModeOptions: Array<'ALL' | OrderType> = ['ALL', 'DINE_IN', 'TAKE_AWAY', 'ONLINE', 'QR'];
const methodOptions: Array<'ALL' | PaymentMethod> = ['ALL', 'CASH', 'QR', 'CARD', 'SPLIT', 'UNKNOWN'];

const formatCurrency = (v: number) => `₹${Number(v || 0).toFixed(2)}`;

const settlementBadge: Record<string, string> = {
  PAID: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  UNPAID: 'bg-amber-100 text-amber-700 border-amber-300',
  CANCELLED: 'bg-rose-100 text-rose-700 border-rose-300',
  REFUNDED: 'bg-violet-100 text-violet-700 border-violet-300',
};

const methodBadge: Record<string, string> = {
  CASH: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  QR: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  CARD: 'bg-blue-50 text-blue-700 border-blue-200',
  SPLIT: 'bg-orange-50 text-orange-700 border-orange-200',
  UNKNOWN: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function FinancialHistoryPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [settlement, setSettlement] = useState<'ALL' | SettlementStatus>('ALL');
  const [orderType, setOrderType] = useState<'ALL' | OrderType>('ALL');
  const [method, setMethod] = useState<'ALL' | PaymentMethod>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const [summary, setSummary] = useState({
    lifetimeRevenue: 0,
    filteredPool: 0,
    entryCount: 0,
  });
  const [entries, setEntries] = useState<Order[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [paymentSession, setPaymentSession] = useState<{
    label: string;
    amount: number;
    orderIds: string[];
    items?: PaymentReceiptItem[];
    billNo?: string;
  } | null>(null);
  const [openingPaymentOrderId, setOpeningPaymentOrderId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await ordersApi.transactions({
        from,
        to,
        settlement,
        orderType,
        method,
        search: search.trim() || undefined,
      });
      setSummary(res.data.summary);
      setEntries(res.data.entries);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetFilters = () => {
    setFrom(today);
    setTo(today);
    setSettlement('ALL');
    setOrderType('ALL');
    setMethod('ALL');
    setSearch('');
  };

  const onRefund = async (order: Order) => {
    const reason = prompt('Refund reason (optional):') || undefined;
    try {
      await ordersApi.refund(order.id, reason);
      toast.success('Order refunded');
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Refund failed');
    }
  };

  const exportExcel = () => {
    if (entries.length === 0) {
      toast.error('No data to export');
      return;
    }

    const rows = entries.map((order) => {
      const billNo = order.billNo ?? `BILL-${order.id.slice(0, 8).toUpperCase()}`;
      const settlementText = order.settlementStatus || 'UNPAID';
      const serviceMode =
        order.orderType === 'DINE_IN'
          ? `DINE_IN${order.tableNumber ? ` (T-${order.tableNumber})` : ''}`
          : order.orderType;

      return {
        'Receipt #': billNo,
        'Order ID': order.id,
        Date: new Date(order.createdAt).toLocaleDateString(),
        Time: new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        'Service Mode': serviceMode,
        Method: settlementText === 'UNPAID' ? '' : (order.paymentMethod || 'UNKNOWN'),
        Settlement: settlementText,
        Status: order.status,
        'Net Value': Number(order.totalAmount || 0),
        'Settled At': order.settledAt ? new Date(order.settledAt).toLocaleString() : '',
        'Refunded At': order.refundedAt ? new Date(order.refundedAt).toLocaleString() : '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');

    const fromPart = from || 'all';
    const toPart = to || 'all';
    const fileName = `transactions_${fromPart}_to_${toPart}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success('Excel exported');
  };

  const printReceipt = async (order: Order) => {
    let printOrder: Order = order;
    try {
      const detail = await ordersApi.get(order.id);
      if (detail?.data) {
        printOrder = detail.data;
      }
    } catch {
      // Continue with list payload if detail fetch fails.
    }

    let printSettings = getPrintSettings();
    try {
      printSettings = await getPrintSettingsAsync({ prefer: 'api' });
    } catch {
      // Keep local fallback settings if async load fails.
    }
    const payload = buildReceiptPayloadFromOrder(printOrder, {
      printSettings,
    });

    printCommonReceipt(payload, () => {
      // no-op
    });
  };

  const openPaymentForOrder = async (order: Order) => {
    if ((order.settlementStatus || 'UNPAID') !== 'UNPAID') {
      return;
    }

    setOpeningPaymentOrderId(order.id);
    try {
      let paymentOrder: Order = order;
      try {
        const detail = await ordersApi.get(order.id);
        if (detail?.data) {
          paymentOrder = detail.data;
        }
      } catch {
        // Use row payload if detail fetch fails.
      }

      const mappedItems: PaymentReceiptItem[] = (paymentOrder.items || []).map((item) => ({
        menuItemName: item.menuItemName,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        lineTotal: Number(item.lineTotal || 0),
        notes: item.notes,
        addOns: item.addOns?.map((addon) => ({
          id: addon.id,
          addonName: addon.addonName,
          quantity: Number(addon.quantity || 1),
          unitPrice: Number(addon.unitPrice || 0),
          lineTotal: Number(addon.lineTotal ?? addon.unitPrice ?? 0),
        })),
      }));

      setPaymentSession({
        label: paymentOrder.orderType === 'DINE_IN' ? `Table ${paymentOrder.tableNumber ?? ''}`.trim() : paymentOrder.orderType,
        amount: Number(paymentOrder.totalAmount || 0),
        orderIds: [paymentOrder.id],
        billNo: paymentOrder.billNo ?? `BILL-${paymentOrder.id.slice(0, 8).toUpperCase()}`,
        items: mappedItems,
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to open payment');
    } finally {
      setOpeningPaymentOrderId(null);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-sky-50/40">
      <div className="max-w-[1320px] mx-auto px-3 sm:px-6 py-6 sm:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/" className="p-2 rounded-lg hover:bg-white/70 border border-transparent hover:border-gray-200">
                <ArrowLeft className="w-4 h-4 text-gray-600" />
              </Link>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-indigo-600">Financial History</h1>
            </div>
            <p className="text-[11px] sm:text-xs tracking-[0.2em] uppercase text-indigo-400 mt-2">
              Audit and search across all transaction logs
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full sm:w-auto">
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-[10px] tracking-[0.2em] text-gray-400 uppercase">Lifetime Revenue</div>
              <div className="text-3xl font-black text-emerald-600">{formatCurrency(summary.lifetimeRevenue)}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-[10px] tracking-[0.2em] text-gray-400 uppercase">Filtered Pool</div>
              <div className="text-3xl font-black text-indigo-600">{formatCurrency(summary.filteredPool)}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-[10px] tracking-[0.2em] text-gray-400 uppercase">Entry Count</div>
              <div className="text-3xl font-black text-slate-800">{summary.entryCount}</div>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-gray-200 bg-white/90 shadow-sm p-4 sm:p-5">
          <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1.2fr_0.9fr_0.9fr_0.9fr_auto] gap-3 items-end">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 xl:col-span-2">
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
            </div>

            <label className="text-xs text-gray-500 uppercase tracking-wide">
              Settlement
              <select
                value={settlement}
                onChange={(e) => setSettlement(e.target.value as any)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
              >
                {settlementOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="text-xs text-gray-500 uppercase tracking-wide">
              Order Mode
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as any)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
              >
                {orderModeOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="text-xs text-gray-500 uppercase tracking-wide">
              Method
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
              >
                {methodOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <div className="flex gap-2 xl:justify-end">
              <button
                onClick={exportExcel}
                className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                <Download className="w-4 h-4" /> Export Excel
              </button>
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                <RotateCcw className="w-4 h-4" /> Reset
              </button>
              <button
                onClick={load}
                className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} /> Apply
              </button>
            </div>
          </div>

          <div className="mt-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') load();
              }}
              placeholder="Search by bill number or order id"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
            />
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-gray-200 bg-white/95 shadow-sm overflow-hidden">
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-indigo-50/70 text-indigo-500 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="text-left px-4 py-3">Receipt #</th>
                  <th className="text-left px-4 py-3">Timeline</th>
                  <th className="text-left px-4 py-3">Service Mode</th>
                  <th className="text-left px-4 py-3">Method</th>
                  <th className="text-left px-4 py-3">Settlement</th>
                  <th className="text-left px-4 py-3">Net Value</th>
                  <th className="text-left px-4 py-3">Fulfillment</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-gray-400">
                      No transaction entries found for this filter.
                    </td>
                  </tr>
                )}

                {entries.map((order) => {
                  const billNo = order.billNo ?? `BILL-${order.id.slice(0, 8).toUpperCase()}`;
                  const settlementText = order.settlementStatus || 'UNPAID';
                  const methodText = settlementText === 'UNPAID' ? '' : (order.paymentMethod || 'UNKNOWN');
                  const modeLabel =
                    order.orderType === 'DINE_IN'
                      ? `DINEIN${order.tableNumber ? ` (T-${order.tableNumber})` : ''}`
                      : order.orderType;

                  return (
                    <>
                    <tr key={order.id} className="border-t border-gray-100 hover:bg-indigo-50/20 cursor-pointer" onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}>
                      <td className="px-4 py-3 font-semibold text-slate-900">#{billNo}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-800">{new Date(order.createdAt).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-3 py-1 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold">
                          {modeLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {methodText ? (
                          <span className={clsx('inline-flex px-3 py-1 rounded-xl border text-xs font-semibold', methodBadge[methodText] || methodBadge.UNKNOWN)}>
                            {methodText}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (settlementText === 'UNPAID') {
                              openPaymentForOrder(order);
                            }
                          }}
                          disabled={settlementText !== 'UNPAID' || openingPaymentOrderId === order.id}
                          className={clsx(
                            'inline-flex px-3 py-1 rounded-xl border text-xs font-semibold',
                            settlementBadge[settlementText] || settlementBadge.UNPAID,
                            settlementText === 'UNPAID' ? 'cursor-pointer hover:brightness-95' : 'cursor-default',
                            openingPaymentOrderId === order.id && 'opacity-70',
                          )}
                          title={settlementText === 'UNPAID' ? 'Click to settle this bill' : undefined}
                        >
                          {openingPaymentOrderId === order.id ? 'OPENING...' : settlementText}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">{formatCurrency(Number(order.totalAmount || 0))}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-3 py-1 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold">
                          {order.status === 'COMPLETED' ? 'DELIVERED' : order.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              printReceipt(order);
                            }}
                            className="h-9 w-9 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center"
                            title="Print"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRefund(order);
                            }}
                            disabled={settlementText !== 'PAID'}
                            className="h-9 px-3 rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold"
                            title="Refund"
                          >
                            Refund
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedOrderId === order.id && order.items && order.items.length > 0 && (
                      <tr key={`${order.id}-items`} className="bg-indigo-50/30 border-t border-indigo-100">
                        <td colSpan={8} className="px-8 py-3">
                          <div className="text-xs font-semibold text-indigo-600 mb-2 uppercase tracking-wide">Order Items</div>
                          <div className="space-y-1">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-sm">
                                <span className="text-gray-800 font-medium">{item.menuItemName}</span>
                                <span className="text-gray-500">×{item.quantity}</span>
                                <span className="text-orange-600 font-semibold ml-auto">₹{Number(item.lineTotal || 0).toFixed(2)}</span>
                              </div>
                            ))}
                            {order.items.some((item) => item.addOns && item.addOns.length > 0) && (
                              <div className="mt-2 space-y-1">
                                {order.items.filter((item) => item.addOns && item.addOns.length > 0).map((item, idx) => (
                                  <div key={idx} className="pl-4 flex flex-wrap gap-1">
                                    <span className="text-xs text-gray-500">{item.menuItemName}:</span>
                                    {item.addOns!.map((a) => (
                                      <span key={a.id} className="text-[11px] bg-orange-50 border border-orange-200 text-orange-700 rounded px-1.5 py-0.5">
                                        +{a.addonName} {Number(a.unitPrice) > 0 ? `₹${Number(a.unitPrice).toFixed(2)}` : '(free)'}
                                      </span>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {paymentSession && (
        <PaymentModal
          label={paymentSession.label}
          amount={paymentSession.amount}
          orderIds={paymentSession.orderIds}
          items={paymentSession.items}
          billNo={paymentSession.billNo}
          onClose={() => {
            setPaymentSession(null);
            void load();
          }}
          onComplete={async (orderIds: string[], paymentMethod: PaymentSettleMethod, couponCode?: string) => {
            await Promise.all(orderIds.map((id) => ordersApi.complete(id, {
              paymentMethod,
              couponCode,
            })));
            void load();
          }}
        />
      )}
    </main>
  );
}
