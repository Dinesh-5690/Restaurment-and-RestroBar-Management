'use client';

import { useEffect, useState } from 'react';
import { Order, OrderItem, OrderItemApprovalHistory } from '@/types';
import { approvalApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Check, Clock, History, Minus, Phone, Plus, User, XCircle } from 'lucide-react';
import clsx from 'clsx';

interface Props { order: Order; onAction: () => void; compact?: boolean }

const itemStatusStyles: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800', QUEUED: 'bg-blue-100 text-blue-700',
  COOKING: 'bg-orange-100 text-orange-700', READY: 'bg-green-100 text-green-700',
  SERVED: 'bg-emerald-100 text-emerald-700', REJECTED: 'bg-red-100 text-red-700',
  REMOVED: 'bg-gray-100 text-gray-600',
};
const getErrorMessage = (error: any) => error.response?.data?.message || 'Please try again.';

export default function ApprovalCard({ order, onAction, compact = false }: Props) {
  const [displayOrder, setDisplayOrder] = useState(order);
  const [loadingItem, setLoadingItem] = useState<string | null>(null);
  const [orderActionLoading, setOrderActionLoading] = useState<'FIRE' | 'REJECT' | null>(null);
  const [wholeRejectOpen, setWholeRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<OrderItemApprovalHistory[]>([]);

  useEffect(() => setDisplayOrder(order), [order]);
  const elapsed = Math.floor((Date.now() - new Date(displayOrder.createdAt).getTime()) / 60000);
  const isPending = (item: OrderItem) => displayOrder.status === 'APPROVAL_PENDING' && item.status === 'PENDING' && (item.approvalStatus ?? 'PENDING') === 'PENDING';
  const isBeverage = (item: OrderItem) => !!item.beverageId || item.routingDestination === 'BILLING';

  const saveQuantity = async (item: OrderItem, quantity: number) => {
    setLoadingItem(item.id);
    try {
      const response = await approvalApi.editItem(displayOrder.id, item.id, {
        menuItemName: item.menuItemName, quantity,
        category: isBeverage(item) ? 'BEVERAGE' : 'FOOD',
        unitPrice: Number(item.unitPrice), notes: item.notes ?? '',
        bottleOrderFlag: item.beverageId ? !!item.bottleOrderFlag : undefined,
        bottleSizeMl: item.beverageId && item.bottleOrderFlag ? Number(item.bottleSizeMl) : undefined,
        servingSize: item.beverageId ? item.bottleOrderFlag ? 'BOTTLE' : item.servingSize || '30ML' : undefined,
      });
      setDisplayOrder(response.data);
      toast.success('Quantity updated');
      onAction();
    } catch (error: any) { toast.error(getErrorMessage(error)); }
    finally { setLoadingItem(null); }
  };

  const changeQuantity = async (item: OrderItem, delta: -1 | 1) => {
    if (!isPending(item) || loadingItem || orderActionLoading) return;
    if (delta === -1 && item.quantity === 1) {
      if (!window.confirm(`Remove ${item.menuItemName} from this order?`)) return;
      setLoadingItem(item.id);
      try {
        const response = await approvalApi.removeItem(displayOrder.id, item.id, 'Quantity decreased to zero');
        setDisplayOrder(response.data);
        toast.success('Item removed from this order');
        onAction();
      } catch (error: any) { toast.error(getErrorMessage(error)); }
      finally { setLoadingItem(null); }
      return;
    }
    await saveQuantity(item, item.quantity + delta);
  };

  const toggleHistory = async () => {
    if (!historyOpen && history.length === 0) {
      setHistoryLoading(true);
      try { const response = await approvalApi.itemHistory(displayOrder.id); setHistory(response.data); }
      catch (error: any) { toast.error(getErrorMessage(error)); return; }
      finally { setHistoryLoading(false); }
    }
    setHistoryOpen((open) => !open);
  };

  const fireOrder = async () => {
    setOrderActionLoading('FIRE');
    try {
      await approvalApi.approve(displayOrder.id);
      toast.success('Pending items approved; food sent to Kitchen and beverages sent to billing');
      onAction();
    } catch (error: any) { toast.error(getErrorMessage(error)); }
    finally { setOrderActionLoading(null); }
  };

  const rejectOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reason.trim()) return toast.error('Enter an order rejection reason');
    setOrderActionLoading('REJECT');
    try {
      await approvalApi.reject(displayOrder.id, reason.trim());
      toast.success('Pending items in the order were rejected');
      setWholeRejectOpen(false); setReason(''); onAction();
    } catch (error: any) { toast.error(getErrorMessage(error)); }
    finally { setOrderActionLoading(null); }
  };

  return <>
    <article className={clsx('card border-l-4 p-4', compact ? 'text-sm' : 'p-5', elapsed > 5 ? 'border-l-red-400' : 'border-l-amber-400')}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-gray-900">{displayOrder.orderType === 'QR' ? 'QR Order' : displayOrder.orderType === 'ONLINE' ? 'Online Order' : 'Dine-In Order'}</span>
            {displayOrder.tableNumber != null && <span className="badge badge-blue">Table {displayOrder.tableNumber}</span>}
            {elapsed > 5 && <span className="badge badge-red">{elapsed}m waiting</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <span>Order #{displayOrder.id.slice(0, 8)}</span>{displayOrder.billNo && <span>Bill {displayOrder.billNo}</span>}
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(displayOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-bold text-amber-700">₹{Number(displayOrder.totalAmount).toFixed(2)}</div>
          <button type="button" onClick={toggleHistory} disabled={historyLoading} className="mt-1 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-amber-800 disabled:opacity-50"><History className="h-3.5 w-3.5" />{historyLoading ? 'Loading…' : historyOpen ? 'Hide history' : 'History'}</button>
        </div>
      </div>
      {(displayOrder.customerName || displayOrder.customerPhone) && <div className="mb-3 flex flex-wrap gap-3 text-xs text-gray-500">
        {displayOrder.customerName && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{displayOrder.customerName}</span>}
        {displayOrder.customerPhone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{displayOrder.customerPhone}</span>}
      </div>}

      <div className="space-y-2">{displayOrder.items.map((item) => {
        const pending = isPending(item); const beverage = isBeverage(item); const busy = loadingItem === item.id;
        return <section key={item.id} className="rounded-xl border border-gray-100 bg-white/70 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-800">{item.menuItemName}</span>
                <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', beverage ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700')}>{beverage ? 'Beverage' : 'Food'}</span>
                <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', itemStatusStyles[item.status] || 'bg-gray-100 text-gray-600')}>{item.approvalStatus && item.approvalStatus !== 'PENDING' ? item.approvalStatus : item.status}</span>
              </div>
              <div className="mt-1 text-xs text-gray-500">₹{Number(item.unitPrice).toFixed(2)} each · Line total ₹{Number(item.lineTotal).toFixed(2)}{item.bottleOrderFlag && item.bottleSizeMl ? ` · ${item.bottleSizeMl}ml` : ''}</div>
              {item.notes && <div className="mt-1 text-xs text-amber-800">Instruction: {item.notes}</div>}
              {item.rejectionReason && <div className="mt-1 text-xs text-red-600">Reason: {item.rejectionReason}</div>}
              {item.addOns?.length ? <div className="mt-1 text-xs text-gray-500">{item.addOns.map((addon) => `+ ${addon.addonName}`).join(', ')}</div> : null}
            </div>
            <div className="flex items-center gap-2" aria-label={`Quantity controls for ${item.menuItemName}`}>
              <button type="button" onClick={() => changeQuantity(item, -1)} disabled={!pending || busy || !!loadingItem || !!orderActionLoading} aria-label={`Decrease ${item.menuItemName} quantity`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"><Minus className="h-4 w-4" /></button>
              <span className="min-w-5 text-center text-sm font-semibold text-gray-800">{item.quantity}</span>
              <button type="button" onClick={() => changeQuantity(item, 1)} disabled={!pending || busy || !!loadingItem || !!orderActionLoading} aria-label={`Increase ${item.menuItemName} quantity`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" /></button>
            </div>
          </div>
        </section>;
      })}</div>

      {displayOrder.items.some(isPending) && <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3">
        <button type="button" onClick={() => { setReason(''); setWholeRejectOpen(true); }} disabled={!!orderActionLoading} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"><XCircle className="h-3.5 w-3.5" /> Reject Order</button>
        <button type="button" onClick={fireOrder} disabled={!!orderActionLoading || !!loadingItem} className="inline-flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-50"><Check className="h-3.5 w-3.5" />{orderActionLoading === 'FIRE' ? 'Firing…' : 'Fire Order'}</button>
      </div>}
      {displayOrder.notes && <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Order note: {displayOrder.notes}</div>}
      <div className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-500">
        <div className="flex justify-between"><span>Subtotal</span><span>₹{Number(displayOrder.subtotal).toFixed(2)}</span></div>
        <div className="mt-1 flex justify-between"><span>Tax</span><span>₹{Number(displayOrder.taxAmount).toFixed(2)}</span></div>
      </div>
      {historyOpen && <div className="mt-4 border-t border-gray-100 pt-3">
        <h3 className="mb-2 text-sm font-semibold text-gray-800">Item history</h3>
        {history.length === 0 ? <p className="text-xs text-gray-500">No recorded item changes.</p> : <div className="space-y-2">{history.map((entry) => <details key={entry.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"><summary className="cursor-pointer text-xs font-medium text-gray-700">{entry.action} · item {entry.orderItemId.slice(0, 8)} · {new Date(entry.createdAt).toLocaleString()} · user {entry.actorUserId.slice(0, 8)}{entry.reason ? ` · ${entry.reason}` : ''}</summary><div className="mt-2 grid gap-2 sm:grid-cols-2"><pre className="overflow-auto rounded bg-white p-2 text-[10px] text-gray-600">{entry.beforeSnapshot}</pre>{entry.afterSnapshot && <pre className="overflow-auto rounded bg-white p-2 text-[10px] text-gray-600">{entry.afterSnapshot}</pre>}</div></details>)}</div>}
      </div>}
    </article>

    {wholeRejectOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"><form onSubmit={rejectOrder} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
      <h2 className="mb-1 text-lg font-bold text-gray-900">Reject pending order items?</h2><p className="mb-4 text-sm text-gray-600">This rejects only items still awaiting approval. Previously approved or fired items remain unchanged.</p>
      <label className="block"><span className="mb-1 block text-xs font-semibold text-gray-600">Rejection reason (required)</span><textarea required minLength={1} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" /></label>
      <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setWholeRejectOpen(false)} className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button><button type="submit" disabled={!!orderActionLoading} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{orderActionLoading === 'REJECT' ? 'Rejecting…' : 'Reject Pending Items'}</button></div>
    </form></div>}
  </>;
}
