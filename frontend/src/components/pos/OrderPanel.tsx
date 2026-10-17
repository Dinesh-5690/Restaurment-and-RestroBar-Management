'use client';
import { CartItem, Table } from '@/types';
import { Minus, Plus, Trash2 } from 'lucide-react';
import TableSelector from './TableSelector';

interface Props {
  cart: CartItem[];
  onUpdateQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  subtotal: number;
  onPlaceOrder: () => void;
  loading: boolean;
  orderType: string;
  selectedTable?: Table | null;
  selectedOrderId?: string | null;
  selectedOrderBillNo?: string | null;
  onSelectTable?: (table: Table) => void;
}

export default function OrderPanel({
  cart,
  onUpdateQty,
  onRemove,
  onClear,
  subtotal,
  onPlaceOrder,
  loading,
  orderType,
  selectedTable,
  selectedOrderId,
  selectedOrderBillNo,
  onSelectTable,
}: Props) {
  const billLabel = selectedOrderBillNo ?? (selectedOrderId ? `BILL-${selectedOrderId.slice(0, 8).toUpperCase()}` : null);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-lg text-gray-900">Current Order</h2>
          {cart.length > 0 && (
            <span className="badge badge-orange">{cart.length} items</span>
          )}
        </div>
        {cart.length > 0 && (
          <button
            onClick={onClear}
            className="text-sm text-red-600 font-semibold rounded-full border border-red-100 bg-red-50 px-3 py-1 hover:bg-red-100"
          >
            Clear
          </button>
        )}
      </div>

      {billLabel && (
        <div className="mb-3 text-sm text-gray-600 bg-gray-100 rounded-2xl px-3 py-2">
          Adding items to bill <span className="font-semibold">{billLabel}</span>
        </div>
      )}

      {orderType === 'DINE_IN' && onSelectTable && (
        <div className="mb-3">
          <TableSelector selected={selectedTable} onSelect={onSelectTable} />
          {!selectedTable && (
            <p className="mt-1 text-xs text-red-500">Please select a table before placing a Dine In order.</p>
          )}
        </div>
      )}

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
        {cart.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-10">
            <div className="text-4xl mb-1">🛒</div>
            Add items from the menu
          </div>
        )}
        {cart.map((item) => (
          <div key={item.cartLineId || item.menuItemId} className="border border-gray-200 rounded-2xl p-1 flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-sm text-gray-900 truncate">{item.menuItemName}</div>
                <div className="text-sm font-semibold text-orange-600">
                  ₹{(item.unitPrice * item.quantity).toFixed(2)}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onUpdateQty(item.cartLineId || item.menuItemId, item.quantity - 1)}
                  className="w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-5 text-center font-semibold text-sm">{item.quantity}</span>
                <button
                  onClick={() => onUpdateQty(item.cartLineId || item.menuItemId, item.quantity + 1)}
                  className="w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onRemove(item.cartLineId || item.menuItemId)}
                  className="w-5 h-5 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center ml-1"
                >
                  <Trash2 className="w-3 h-3 text-red-500" />
                </button>
              </div>
            </div>
            {item.selectedAddOns && item.selectedAddOns.length > 0 && (
              <div className="pl-1 pb-0.5">
                {item.selectedAddOns.map((a) => (
                  <span key={a.addonId} className="inline-block text-[10px] text-orange-700 bg-orange-50 rounded px-1.5 py-0.5 mr-1">
                    +{a.addonName}{a.unitPrice > 0 ? ` ₹${a.unitPrice.toFixed(2)}` : ' (free)'}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      {cart.length > 0 && (
        <div className="border-t border-gray-100 pt-3 mt-3 space-y-1">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-sm text-gray-900">
            <span>Total</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          {orderType !== 'DINE_IN' && (
            <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-2 py-1">
              This order will go to the Approval Hub first
            </p>
          )}
          <button
            onClick={onPlaceOrder}
            disabled={loading || cart.length === 0 || (orderType === 'DINE_IN' && !selectedTable)}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-2 rounded-xl text-sm transition-colors"
          >
            {loading ? 'Placing...' : 'Place Order'}
          </button>
        </div>
      )}
    </div>
  );
}
