'use client';
import { useState } from 'react';
import { Order } from '@/types';
import { approvalApi, kitchenApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { XCircle, Flame, Clock, User, Phone, Hash } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  order: Order;
  onAction: () => void;
  compact?: boolean;
}

const itemStatusStyles: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  QUEUED: 'bg-blue-100 text-blue-700',
  COOKING: 'bg-orange-100 text-orange-700',
  READY: 'bg-green-100 text-green-700',
  SERVED: 'bg-emerald-100 text-emerald-700',
};

export default function ApprovalCard({ order, onAction, compact = false }: Props) {
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState<string | null>(null);

  const handleReject = async () => {
    if (!rejectReason.trim()) return toast.error('Provide a rejection reason');
    setLoading('reject');
    try {
      await approvalApi.reject(order.id, rejectReason);
      toast.success('Order rejected');
      setRejectModal(false);
      onAction();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error');
    } finally {
      setLoading(null);
    }
  };

  const handleApproveAndFire = async () => {
    setLoading('approvefire');
    try {
      await approvalApi.approve(order.id);
      const pendingItemIds = order.items
        .filter((item) => item.status === 'PENDING')
        .map((item) => item.id);

      if (pendingItemIds.length > 0) {
        await kitchenApi.fireItems(order.id, pendingItemIds);
      }
      toast.success('Approved & fired to kitchen!');
      onAction();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error');
    } finally {
      setLoading(null);
    }
  };

  const elapsed = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);

  if (compact) {
    return (
      <>
        <div className={clsx('card border-l-4 flex flex-col', elapsed > 5 ? 'border-l-red-400' : 'border-l-amber-400')}>
          {/* Compact top row */}
          <div className="flex items-center gap-1.5 px-3 pt-3 pb-1 flex-wrap">
            {order.tableNumber ? (
              <span className="badge badge-blue font-bold">T{order.tableNumber}</span>
            ) : (
              <span className="text-xs font-semibold text-gray-700">QR</span>
            )}
            {order.billNo && (
              <span className="flex items-center gap-0.5 text-[10px] font-mono text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
                <Hash className="w-2.5 h-2.5" />{order.billNo}
              </span>
            )}
            {elapsed > 5 && (
              <span className="badge badge-red text-[10px]">⚠ {elapsed}m</span>
            )}
            <span className="ml-auto font-bold text-orange-600 text-sm">₹{Number(order.totalAmount).toFixed(2)}</span>
          </div>

          {/* Time + item count */}
          <div className="flex items-center gap-1 text-[10px] text-gray-400 px-3 pb-1">
            <Clock className="w-2.5 h-2.5" />
            {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            &nbsp;·&nbsp;{order.items.length} item{order.items.length !== 1 ? 's' : ''}
          </div>

          {/* Items — always visible */}
          <div className="px-3 pb-1 space-y-0.5">
            {order.items.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-1.5 items-center text-xs text-gray-600 py-0.5 border-b border-gray-50 last:border-0">
                <div className="truncate">
                  <div className="truncate pr-2">{item.menuItemName}</div>
                  {item.addOns && item.addOns.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {item.addOns.map((addon) => (
                        <span key={addon.id} className="text-[8px] bg-orange-50 text-orange-700 border border-orange-200 rounded px-1 py-0.5 inline-block">
                          +{addon.addonName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className={clsx('rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase', itemStatusStyles[item.status] || 'bg-gray-100 text-gray-600')}>
                  {item.status}
                </span>
                <span className="shrink-0 text-gray-500">×{item.quantity}</span>
                <span className="shrink-0 font-medium text-gray-700">₹{Number(item.lineTotal).toFixed(0)}</span>
              </div>
            ))}
            {order.notes && (
              <div className="text-[10px] text-amber-700 bg-amber-50 rounded px-2 py-1 mt-1">
                {order.notes}
              </div>
            )}
          </div>

          {/* Bill summary */}
          <div className="mx-3 mt-1 mb-2 pt-1 border-t border-gray-100 flex justify-between text-[10px] text-gray-500">
            <span>Subtotal</span>
            <span>₹{Number(order.subtotal).toFixed(2)}</span>
          </div>
          <div className="mx-3 mb-1 flex justify-between text-[10px] text-gray-400">
            <span>Tax</span>
            <span>₹{Number(order.taxAmount).toFixed(2)}</span>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-1.5 px-3 pb-3 pt-1.5 mt-auto">
            <button
              onClick={handleApproveAndFire}
              disabled={!!loading}
              className="flex items-center justify-center gap-1 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-lg text-xs font-semibold"
            >
              <Flame className="w-3 h-3" />
              {loading === 'approvefire' ? '...' : 'Fire'}
            </button>
            <button
              onClick={() => setRejectModal(true)}
              disabled={!!loading}
              className="flex items-center justify-center gap-1 py-1.5 border border-red-300 bg-red-50 hover:bg-red-100 disabled:opacity-60 text-red-600 rounded-lg text-xs font-semibold"
            >
              <XCircle className="w-3 h-3" />
              Reject
            </button>
          </div>
        </div>

        {/* Reject Modal */}
        {rejectModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
              <h3 className="font-bold text-gray-900 mb-3">Reject Order #{order.id.slice(0, 8)}</h3>
              <textarea
                className="w-full border border-gray-200 rounded-lg p-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                rows={3}
                placeholder="Reason for rejection…"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setRejectModal(false)}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={loading === 'reject'}
                  className="flex-1 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white rounded-lg text-sm font-semibold"
                >
                  {loading === 'reject' ? '...' : 'Confirm Reject'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className={clsx('card p-5 border-l-4', elapsed > 5 ? 'border-l-red-400' : 'border-l-amber-400')}>
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900">
                {order.orderType === 'QR' ? 'QR Order' : 'Online Order'}
              </span>
              {order.tableNumber && (
                <span className="badge badge-blue">Table {order.tableNumber}</span>
              )}
              {elapsed > 5 && (
                <span className="badge badge-red">⚠ {elapsed}m waiting</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {order.billNo && (
                <span className="flex items-center gap-0.5 text-xs font-mono font-semibold text-gray-600 bg-gray-100 rounded px-1.5 py-0.5">
                  <Hash className="w-3 h-3" />{order.billNo}
                </span>
              )}
              <span className="text-xs text-gray-400">ID: {order.id.slice(0, 8)}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-orange-600">₹{Number(order.totalAmount).toFixed(2)}</div>
            <div className="text-xs text-gray-400 flex items-center gap-1 justify-end">
              <Clock className="w-3 h-3" />
              {new Date(order.createdAt).toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Customer */}
        {(order.customerName || order.customerPhone) && (
          <div className="flex gap-3 text-xs text-gray-500 mb-2">
            {order.customerName && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" /> {order.customerName}
              </span>
            )}
            {order.customerPhone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" /> {order.customerPhone}
              </span>
            )}
          </div>
        )}

        {/* Items — always visible */}
        <div className="mb-2">
          <div className="text-xs font-medium text-gray-500 mb-1">{order.items.length} item(s)</div>
          <div className="space-y-0.5">
            {order.items.map((item) => (
              <div key={item.id} className="py-1 border-b border-gray-50">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center text-xs text-gray-600">
                  <span className="truncate">{item.menuItemName}</span>
                  <span className={clsx('rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-center', itemStatusStyles[item.status] || 'bg-gray-100 text-gray-600')}>
                    {item.status}
                  </span>
                  <span className="text-gray-400 text-right">×{item.quantity} @ ₹{Number(item.unitPrice).toFixed(2)}</span>
                  <span className="font-semibold text-gray-800 text-right">₹{Number(item.lineTotal).toFixed(2)}</span>
                </div>
                {item.addOns && item.addOns.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.addOns.map((addon) => (
                      <span key={addon.id} className="text-[8px] bg-orange-50 text-orange-700 border border-orange-200 rounded px-1.5 py-0.5">
                        +{addon.addonName} {Number(addon.unitPrice) > 0 ? `₹${Number(addon.unitPrice).toFixed(2)}` : '(free)'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Bill summary */}
          <div className="mt-2 space-y-0.5 border-t border-gray-100 pt-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Subtotal</span><span>₹{Number(order.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Tax</span><span>₹{Number(order.taxAmount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs font-bold text-gray-900">
              <span>Total</span><span>₹{Number(order.totalAmount).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {order.notes && (
          <div className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-3">
            Note: {order.notes}
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleApproveAndFire}
            disabled={!!loading}
            className="flex items-center justify-center gap-1.5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-lg text-xs font-semibold"
          >
            <Flame className="w-3.5 h-3.5" />
            {loading === 'approvefire' ? '...' : 'Approve & Fire'}
          </button>
          <button
            onClick={() => setRejectModal(true)}
            disabled={!!loading}
            className="flex items-center justify-center gap-1.5 py-2 border border-red-300 bg-red-50 hover:bg-red-100 disabled:opacity-60 text-red-600 rounded-lg text-xs font-semibold"
          >
            <XCircle className="w-3.5 h-3.5" />
            Reject
          </button>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-900 mb-3">Reject Order</h3>
            <textarea
              className="w-full border border-gray-200 rounded-lg p-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              rows={3}
              placeholder="Reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setRejectModal(false)}
                className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!!loading}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2 text-sm font-semibold"
              >
                {loading === 'reject' ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
