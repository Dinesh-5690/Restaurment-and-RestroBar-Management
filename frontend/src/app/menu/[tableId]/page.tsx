'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { MenuSection, Table, CartItem } from '@/types';
import { qrApi, ordersApi } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import toast from 'react-hot-toast';
import { ShoppingCart, Plus, Minus, ChefHat, Clock, CheckCircle } from 'lucide-react';
import clsx from 'clsx';

type Step = 'menu' | 'review' | 'tracking';

export default function QRMenuPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const [table, setTable] = useState<Table | null>(null);
  const [menu, setMenu] = useState<MenuSection[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState<Step>('menu');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    qrApi.getMenu(tableId).then((r) => {
      setTable(r.data.table);
      setMenu(r.data.menu);
      setLoading(false);
    }).catch(() => {
      toast.error('Invalid QR code');
      setLoading(false);
    });
  }, [tableId]);

  // Track order status
  useSocket({
    ORDER_APPROVED: (data) => {
      if (data.id === orderId) setOrderStatus('Approved — being prepared!');
    },
    ORDER_FIRED: (data) => {
      if (data.id === orderId) setOrderStatus('Cooking in progress...');
    },
    ITEM_READY: (data) => {
      if (data.orderId === orderId) setOrderStatus('Your items are ready!');
    },
    ORDER_REJECTED: (data) => {
      if (data.id === orderId) setOrderStatus(`Rejected: ${data.rejectionReason}`);
    },
  }, orderId ? [`order:${orderId}`] : []);

  const addItem = (item: any) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) return prev.map((c) => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItemId: item.id, menuItemName: item.name, unitPrice: item.price, quantity: 1, categoryName: item.category?.name }];
    });
  };

  const removeItem = (menuItemId: string) => {
    setCart((prev) => prev.reduce((acc: CartItem[], c) => {
      if (c.menuItemId !== menuItemId) return [...acc, c];
      if (c.quantity > 1) return [...acc, { ...c, quantity: c.quantity - 1 }];
      return acc;
    }, []));
  };

  const getQty = (id: string) => cart.find((c) => c.menuItemId === id)?.quantity || 0;

  const subtotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);

  const placeOrder = async () => {
    if (!table || cart.length === 0) return;
    setPlacing(true);
    try {
      const r = await ordersApi.create({
        orderType: 'QR',
        tableId: table.id,
        items: cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity })),
      });
      setOrderId(r.data.id);
      setOrderStatus('Waiting for approval...');
      setStep('tracking');
      toast.success('Order placed!');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  const allItems = menu.flatMap((s) => s.items).filter((i) => i.isAvailable);
  const filtered = selectedCategory === 'all' ? allItems : allItems.filter((i) => i.categoryId === selectedCategory);
  const totalItems = cart.reduce((s, c) => s + c.quantity, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ChefHat className="w-12 h-12 text-orange-400 mx-auto mb-3 animate-pulse" />
          <p className="text-gray-500">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-red-500">Invalid QR code.</div>
      </div>
    );
  }

  if (step === 'tracking') {
    const statusIcon = orderStatus.includes('ready') ? CheckCircle : Clock;
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-6">
        <div className="card p-8 w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-orange-100 mb-5">
            <ChefHat className="w-10 h-10 text-orange-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Order Placed!</h2>
          <p className="text-gray-500 text-sm mb-6">Table {table.tableNumber}</p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="font-medium text-amber-800">{orderStatus || 'Waiting for approval...'}</p>
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            {cart.map((c) => (
              <div key={c.menuItemId} className="flex justify-between">
                <span>{c.menuItemName} × {c.quantity}</span>
                <span>₹{(c.unitPrice * c.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-bold text-gray-900">
              <span>Total</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
          </div>
          <button
            onClick={() => { setStep('menu'); setCart([]); setOrderId(null); }}
            className="mt-6 w-full bg-orange-500 text-white py-2.5 rounded-xl font-semibold"
          >
            Order More
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4">
        <div className="flex items-center gap-2 mb-1">
          <ChefHat className="w-5 h-5 text-orange-500" />
          <h1 className="font-bold text-gray-900">Menu</h1>
        </div>
        <p className="text-sm text-gray-500">Table {table.tableNumber} · {table.location || 'Dine In'}</p>
      </div>

      {/* Category Tabs */}
      <div className="bg-white border-b px-4 py-2 flex gap-2 overflow-x-auto z-10">
        <button
          onClick={() => setSelectedCategory('all')}
          className={clsx('shrink-0 px-3 py-1.5 rounded-full text-xs font-medium',
            selectedCategory === 'all' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600')}
        >All</button>
        {menu.map((s) => (
          <button
            key={s.category.id}
            onClick={() => setSelectedCategory(s.category.id)}
            className={clsx('shrink-0 px-3 py-1.5 rounded-full text-xs font-medium',
              selectedCategory === s.category.id ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600')}
          >
            {s.category.name}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {filtered.map((item) => {
          const qty = getQty(item.id);
          return (
            <div key={item.id} className="card p-4 flex items-center gap-3">
              <div className="flex-1">
                <div className="font-medium text-gray-900">{item.name}</div>
                {item.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-bold text-orange-600">₹{Number(item.price).toFixed(2)}</span>
                  <span className="text-xs text-gray-400 flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />{item.prepTimeEstimate}m
                  </span>
                </div>
              </div>
              {qty === 0 ? (
                <button
                  onClick={() => addItem(item)}
                  className="flex items-center gap-1.5 bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => removeItem(item.id)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-6 text-center font-bold">{qty}</span>
                  <button onClick={() => addItem(item)} className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Cart Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
          <button
            onClick={() => setStep('review')}
            className="w-full flex items-center justify-between bg-orange-500 text-white px-5 py-3.5 rounded-2xl font-semibold"
          >
            <span className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              {totalItems} item{totalItems > 1 ? 's' : ''}
            </span>
            <span>₹{subtotal.toFixed(2)} · View Cart →</span>
          </button>
        </div>
      )}

      {/* Review Step */}
      {step === 'review' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 max-h-[80vh] flex flex-col">
            <h2 className="font-bold text-lg mb-4">Your Order</h2>
            <div className="flex-1 overflow-y-auto space-y-3 mb-6">
              {cart.map((c) => (
                <div key={c.menuItemId} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{c.menuItemName}</div>
                    <div className="text-xs text-gray-400">₹{c.unitPrice} each</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => removeItem(c.menuItemId)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center font-bold text-sm">{c.quantity}</span>
                    <button onClick={() => addItem({ id: c.menuItemId, name: c.menuItemName, price: c.unitPrice, category: null })}
                      className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="w-20 text-right font-semibold text-sm">₹{(c.unitPrice * c.quantity).toFixed(2)}</div>
                </div>
              ))}
            </div>
            <div className="border-t pt-3 flex justify-between font-bold">
              <span>Total</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep('menu')} className="flex-1 border border-gray-200 py-3 rounded-xl text-sm">Back</button>
              <button
                onClick={placeOrder}
                disabled={placing}
                className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-60"
              >
                {placing ? 'Placing...' : 'Place Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
