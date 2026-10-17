'use client';
import { useState, useEffect, useCallback } from 'react';
import { Order } from '@/types';
import { approvalApi } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import ApprovalCard from '@/components/approval/ApprovalCard';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, CheckCircle, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export default function ApprovalPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const r = await approvalApi.pending();
      setOrders(r.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  // Real-time: new orders trigger a notification
  useSocket(
    {
      ORDER_CREATED: (data: Order) => {
        if (data.status === 'APPROVAL_PENDING') {
          setOrders((prev) => [data, ...prev.filter((o) => o.id !== data.id)]);
          toast('New order awaiting approval!', { icon: '🔔' });
        }
      },
      ORDER_UPDATED: (data: Order) => {
        if (data.status === 'APPROVAL_PENDING') {
          setOrders((prev) => [data, ...prev.filter((o) => o.id !== data.id)]);
        } else {
          setOrders((prev) => prev.filter((o) => o.id !== data.id));
        }
      },
      ORDER_APPROVED: (data: Order) => {
        setOrders((prev) => prev.filter((o) => o.id !== data.id));
      },
      ORDER_CANCELLED: (data: Order) => {
        setOrders((prev) => prev.filter((o) => o.id !== data.id));
      },
    },
    ['approval:hub'],
  );

  const qrOrders = orders.filter((o) => o.orderType === 'QR');
  const onlineOrders = orders.filter((o) => o.orderType === 'ONLINE');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-4">
        <Link href="/" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <CheckCircle className="w-5 h-5 text-green-500" />
        <h1 className="font-bold text-lg text-gray-900">Approval Hub</h1>

        {orders.length > 0 && (
          <span className="flex items-center gap-1 badge badge-yellow">
            <Bell className="w-3 h-3" />
            {orders.length} pending
          </span>
        )}

        <div className="ml-auto">
          <button
            onClick={fetchPending}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </header>

      <main className="p-6">
        {orders.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <CheckCircle className="w-16 h-16 mb-4 text-green-300" />
            <p className="text-xl font-medium text-gray-600">All clear!</p>
            <p className="text-sm">No orders awaiting approval</p>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* QR Orders — compact 2-col grid */}
          {qrOrders.length > 0 && (
            <section>
              <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                QR Orders
                <span className="badge badge-orange">{qrOrders.length}</span>
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {qrOrders.map((order) => (
                  <ApprovalCard key={order.id} order={order} onAction={fetchPending} compact />
                ))}
              </div>
            </section>
          )}

          {/* Online Orders */}
          {onlineOrders.length > 0 && (
            <section>
              <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                Online Orders
                <span className="badge badge-blue">{onlineOrders.length}</span>
              </h2>
              <div className="space-y-4">
                {onlineOrders.map((order) => (
                  <ApprovalCard key={order.id} order={order} onAction={fetchPending} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
