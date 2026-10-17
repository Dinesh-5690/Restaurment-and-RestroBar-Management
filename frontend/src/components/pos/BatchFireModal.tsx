'use client';
import { useState } from 'react';
import { Order, OrderItem } from '@/types';
import { kitchenApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Flame, X } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  order: Order;
  onClose: () => void;
  onFired: () => void;
}

export default function BatchFireModal({ order, onClose, onFired }: Props) {
  const pendingItems = order.items.filter((i) => i.status === 'PENDING');
  const [selected, setSelected] = useState<Set<string>>(
    new Set(pendingItems.map((i) => i.id)),
  );
  const [loading, setLoading] = useState(false);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleFire = async () => {
    if (selected.size === 0) return toast.error('Select at least one item to fire');
    setLoading(true);
    try {
      await kitchenApi.fireItems(order.id, Array.from(selected));
      toast.success(`Fired ${selected.size} item(s) to kitchen!`);
      onFired();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to fire items');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Fire to Kitchen</h2>
            <p className="text-sm text-gray-500">Order #{order.id.slice(0, 8)}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="p-6 space-y-2 max-h-80 overflow-y-auto">
          {pendingItems.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">No pending items</p>
          )}
          {pendingItems.map((item) => (
            <label
              key={item.id}
              className={clsx(
                'flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors',
                selected.has(item.id)
                  ? 'border-orange-400 bg-orange-50'
                  : 'border-gray-100 hover:border-gray-200',
              )}
            >
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => toggle(item.id)}
                className="w-4 h-4 accent-orange-500"
              />
              <div className="flex-1">
                <div className="font-medium text-sm">{item.menuItemName}</div>
                <div className="text-xs text-gray-400">
                  Qty: {item.quantity}
                  {item.kitchenStation && ` · ${item.kitchenStation}`}
                </div>
                {item.addOns && item.addOns.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.addOns.map((addon) => (
                      <span key={addon.id} className="text-[8px] bg-orange-50 text-orange-700 border border-orange-200 rounded px-1 py-0.5">
                        +{addon.addonName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </label>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-6 border-t">
          <button
            onClick={() => setSelected(new Set(pendingItems.map((i) => i.id)))}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Select All
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleFire}
            disabled={loading || selected.size === 0}
            className="flex items-center gap-2 px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            <Flame className="w-4 h-4" />
            Fire {selected.size > 0 ? `${selected.size} Items` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
