'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { ArrowLeft, CreditCard, QrCode, Store, UtensilsCrossed } from 'lucide-react';
import { kioskApi } from '@/lib/api';
import type { MenuItem, MenuSection, SelectedAddon, Table } from '@/types';
import AddonPickerModal from '@/components/pos/AddonPickerModal';

type KioskStep = 'start' | 'type' | 'table' | 'menu' | 'payment' | 'success';
type KioskOrderType = 'DINE_IN' | 'TAKE_AWAY';
type PaymentMethod = 'COUNTER' | 'ONLINE_QR' | 'ONLINE_CARD';

interface CartLine {
  lineId: string;
  item: MenuItem;
  quantity: number;
  selectedAddOns?: SelectedAddon[];
}

export default function KioskPage() {
  const [step, setStep] = useState<KioskStep>('start');
  const [orderType, setOrderType] = useState<KioskOrderType | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [pendingItem, setPendingItem] = useState<MenuItem | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [processing, setProcessing] = useState(false);
  const [lastBillNo, setLastBillNo] = useState<string>('');

  useEffect(() => {
    Promise.all([kioskApi.menu(), kioskApi.tables()])
      .then(([menuRes, tableRes]) => {
        setSections(menuRes.data || []);
        setTables(tableRes.data || []);
      })
      .catch(() => {
        toast.error('Unable to load kiosk data');
      });
  }, []);

  const categories = useMemo(
    () => [{ id: 'all', name: 'All' }, ...sections.map((s) => ({ id: s.category.id, name: s.category.name }))],
    [sections],
  );

  const menuItems = useMemo(() => {
    const all = sections.flatMap((s) => s.items);
    return all.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.categoryId === selectedCategory;
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      return item.isAvailable && matchesCategory && matchesSearch;
    });
  }, [sections, selectedCategory, search]);

  // Show all tables regardless of status
  const allTables = useMemo(() => tables, [tables]);

  const subtotal = useMemo(
    () => cart.reduce((sum, line) => {
      const addonTotal = (line.selectedAddOns || []).reduce((s, a) => s + (a.unitPrice * (a.quantity ?? 1)), 0);
      return sum + (Number(line.item.price) + addonTotal) * line.quantity;
    }, 0),
    [cart],
  );
  const tax = useMemo(
    () => cart.reduce((sum, line) => {
      const addonTotal = (line.selectedAddOns || []).reduce((s, a) => s + (a.unitPrice * (a.quantity ?? 1)), 0);
      const perUnit = Number(line.item.price) + addonTotal;
      return sum + perUnit * line.quantity * (Number(line.item.taxPercent) / 100);
    }, 0),
    [cart],
  );
  const total = subtotal + tax;

  const addItem = (item: MenuItem) => {
    if (item.availableAddOns && item.availableAddOns.length > 0) {
      setPendingItem(item);
    } else {
      commitAddItem(item, []);
    }
  };

  const commitAddItem = (item: MenuItem, addons: SelectedAddon[]) => {
    setCart((prev) => {
      if (addons.length === 0) {
        const existing = prev.find((line) => line.item.id === item.id && (!line.selectedAddOns || line.selectedAddOns.length === 0));
        if (existing) {
          return prev.map((line) => line.lineId === existing.lineId ? { ...line, quantity: line.quantity + 1 } : line);
        }
      }
      const lineId = `${item.id}-${Date.now()}`;
      return [...prev, { lineId, item, quantity: 1, selectedAddOns: addons }];
    });
  };

  const decItem = (lineId: string) => {
    setCart((prev) =>
      prev
        .map((line) =>
          line.lineId === lineId ? { ...line, quantity: Math.max(0, line.quantity - 1) } : line,
        )
        .filter((line) => line.quantity > 0),
    );
  };

  const checkout = async () => {
    if (!orderType || !paymentMethod || cart.length === 0) return;
    if (orderType === 'DINE_IN' && !selectedTable) {
      toast.error('Please choose a table');
      return;
    }

    setProcessing(true);
    try {
      const res = await kioskApi.checkout({
        orderType,
        tableId: orderType === 'DINE_IN' ? selectedTable?.id : undefined,
        paymentMethod,
        items: cart.map((line) => ({
          menuItemId: line.item.id,
          quantity: line.quantity,
          selectedAddOns: line.selectedAddOns,
        })),
      });

      const billNo = res.data?.billNo || 'KIOSK-BILL';
      setLastBillNo(billNo);

      if (paymentMethod === 'COUNTER') {
        const printHtml = `
          <html><head><title>${billNo}</title></head>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="margin-bottom: 8px;">Restaurant Kiosk Bill</h2>
            <p><strong>Bill:</strong> ${billNo}</p>
            <p><strong>Type:</strong> ${orderType === 'DINE_IN' ? 'Dine In' : 'Take Away'}</p>
            ${selectedTable ? `<p><strong>Table:</strong> ${selectedTable.tableNumber}</p>` : ''}
            <hr />
            ${cart
              .map(
                (line) =>
                  `<div style="display:flex;justify-content:space-between;margin:6px 0;"><span>${line.item.name} x ${line.quantity}</span><span>₹${(Number(line.item.price) * line.quantity).toFixed(2)}</span></div>`,
              )
              .join('')}
            <hr />
            <p><strong>Total:</strong> ₹${total.toFixed(2)}</p>
            <p style="margin-top: 16px;">Paid at Counter</p>
          </body></html>
        `;
        const win = window.open('', '_blank', 'width=420,height=720');
        if (win) {
          win.document.write(printHtml);
          win.document.close();
          win.focus();
          win.print();
        }
      }

      setStep('success');
      setCart([]);
      setPaymentMethod(null);
      setSelectedTable(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Checkout failed');
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    setStep('start');
    setOrderType(null);
    setSelectedTable(null);
    setCart([]);
    setPaymentMethod(null);
    setSearch('');
    setSelectedCategory('all');
  };

  return (
    <>
    <main className="kiosk-shell bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      <div className="kiosk-panel rounded-3xl border border-orange-100 bg-white/90 shadow-xl backdrop-blur-sm overflow-hidden flex flex-col">
        <header className="px-5 py-4 border-b border-orange-100 flex items-center justify-between bg-white/80">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900">Self Order Kiosk</h1>
            <p className="text-xs text-gray-500">Touch friendly mode for kiosk and monitor screens</p>
          </div>
          <button onClick={reset} className="text-xs font-semibold px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200">
            Reset
          </button>
        </header>

        {step === 'start' && (
          <section className="flex-1 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#fed7aa_0%,transparent_40%),radial-gradient(circle_at_80%_25%,#fdba74_0%,transparent_35%),radial-gradient(circle_at_40%_80%,#fb923c_0%,transparent_40%)]" />
            <div className="absolute inset-0 opacity-20 text-[8rem] md:text-[10rem] flex items-center justify-around pointer-events-none select-none">
              <span>🍔</span><span>🍕</span><span>🍜</span><span>🥗</span>
            </div>
            <div className="relative h-full flex flex-col items-center justify-center text-center px-6">
              <h2 className="text-4xl md:text-6xl font-extrabold text-gray-900">Tap To Start</h2>
              <p className="mt-3 text-gray-600 text-lg">Order fast, pay quickly, and send directly to kitchen</p>
              <button
                onClick={() => setStep('type')}
                className="mt-8 px-8 py-4 rounded-2xl bg-orange-500 text-white text-xl font-bold hover:bg-orange-600"
              >
                Start Ordering
              </button>
            </div>
          </section>
        )}

        {step === 'type' && (
          <section className="flex-1 p-6 md:p-8 flex items-center justify-center">
            <div className="w-full max-w-4xl kiosk-grid">
              <button
                onClick={() => {
                  setOrderType('DINE_IN');
                  setStep('table');
                }}
                className="rounded-3xl border border-orange-200 bg-orange-50 hover:bg-orange-100 p-8 text-left"
              >
                <UtensilsCrossed className="w-10 h-10 text-orange-600 mb-4" />
                <h3 className="text-3xl font-bold text-gray-900">Dine In</h3>
                <p className="text-gray-600 mt-2">Choose table and place your dine-in order</p>
              </button>
              <button
                onClick={() => {
                  setOrderType('TAKE_AWAY');
                  setStep('menu');
                }}
                className="rounded-3xl border border-teal-200 bg-teal-50 hover:bg-teal-100 p-8 text-left"
              >
                <Store className="w-10 h-10 text-teal-600 mb-4" />
                <h3 className="text-3xl font-bold text-gray-900">Take Away</h3>
                <p className="text-gray-600 mt-2">Skip table selection and order for pickup</p>
              </button>
            </div>
          </section>
        )}

        {step === 'table' && (
          <section className="flex-1 p-6 md:p-8 overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Choose Your Table</h2>
            <div className="kiosk-grid">
              {allTables.map((table) => (
                <button
                  key={table.id}
                  onClick={() => {
                    setSelectedTable(table);
                    setStep('menu');
                  }}
                  className={clsx(
                    'rounded-2xl border p-5 text-left transition-all',
                    table.status === 'FREE'
                      ? 'border-gray-200 bg-white hover:border-orange-400 hover:bg-orange-50'
                      : table.status === 'OCCUPIED'
                        ? 'border-red-200 bg-red-50 hover:border-red-400'
                        : 'border-yellow-200 bg-yellow-50 hover:border-yellow-400'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xl font-bold text-gray-900">Table {table.tableNumber}</div>
                    <span className={clsx(
                      'px-3 py-1 rounded-full text-xs font-semibold',
                      table.status === 'FREE'
                        ? 'bg-green-100 text-green-700'
                        : table.status === 'OCCUPIED'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                    )}>
                      {table.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">Capacity: {table.capacity}</div>
                </button>
              ))}
            </div>
            {allTables.length === 0 && (
              <p className="text-sm text-gray-500">No tables available.</p>
            )}
          </section>
        )}

        {step === 'menu' && (
          <section className="flex-1 min-h-0 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_360px]">
            {/* Left: Menu Items - Independent Scroll */}
            <div className="min-h-0 overflow-hidden p-5 border-r border-gray-100 flex flex-col">
              {/* Fixed Header */}
              <div className="flex-shrink-0 mb-4">
                <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">Select Items</h2>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search food..."
                    className="w-full md:w-80 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={clsx(
                        'px-4 py-2 rounded-full text-sm font-semibold',
                        selectedCategory === cat.id
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                      )}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable Menu Items */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="kiosk-grid">
                  {menuItems.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                      <div className="font-bold text-gray-900 text-lg">{item.name}</div>
                      <div className="text-xs text-gray-500 min-h-[2rem]">{item.description || 'Freshly prepared'}</div>
                      <div className="mt-2 text-base font-bold text-orange-600">₹{Number(item.price).toFixed(2)}</div>
                      <button
                        onClick={() => addItem(item)}
                        className="mt-3 w-full px-3 py-3 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Cart - Independent Scroll */}
            <aside className="min-h-0 overflow-hidden p-5 bg-gray-50 flex flex-col">
              {/* Fixed Header */}
              <h3 className="flex-shrink-0 text-xl font-bold text-gray-900 mb-3">Your Cart</h3>

              {/* Scrollable Cart Items */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
                {cart.map((line) => (
                  <div key={line.lineId} className="bg-white rounded-lg border border-gray-200 p-2">
                    <div className="font-semibold text-sm leading-tight text-gray-900">{line.item.name}</div>
                    {line.selectedAddOns && line.selectedAddOns.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {line.selectedAddOns.map((a) => (
                          <span key={a.addonId} className="text-[10px] bg-orange-50 text-orange-700 rounded px-1.5 py-0.5">
                            +{a.addonName}{a.unitPrice > 0 ? ` ₹${a.unitPrice.toFixed(2)}` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1 flex items-center gap-1.5">
                      <button onClick={() => decItem(line.lineId)} className="w-7 h-7 rounded-md bg-gray-200 text-sm font-semibold">-</button>
                      <span className="w-7 text-center text-sm font-semibold">{line.quantity}</span>
                      <button onClick={() => commitAddItem(line.item, line.selectedAddOns || [])} className="w-7 h-7 rounded-md bg-gray-200 text-sm font-semibold">+</button>
                      <span className="flex-1 text-center text-[11px] text-gray-500">₹{Number(line.item.price).toFixed(2)} each</span>
                      <span className="ml-auto text-sm font-semibold">₹{((Number(line.item.price) + (line.selectedAddOns || []).reduce((s, a) => s + a.unitPrice, 0)) * line.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
                {cart.length === 0 && <p className="text-sm text-gray-400">No items yet</p>}
              </div>

              {/* Fixed Footer */}
              <div className="flex-shrink-0 mt-4 border-t border-gray-200 pt-4 space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span>₹{tax.toFixed(2)}</span></div>
                <div className="flex justify-between text-base font-bold"><span>Total</span><span>₹{total.toFixed(2)}</span></div>
              </div>
              <button
                onClick={() => setStep('payment')}
                disabled={cart.length === 0}
                className="flex-shrink-0 mt-4 w-full px-4 py-3 rounded-xl bg-green-600 text-white font-bold disabled:opacity-50"
              >
                Place Order & Pay
              </button>
            </aside>
          </section>
        )}

        {step === 'payment' && (
          <section className="flex-1 p-6 md:p-8 overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Choose Payment Method</h2>
            <div className="kiosk-grid">
              <button
                onClick={() => setPaymentMethod('COUNTER')}
                className={clsx(
                  'rounded-2xl border p-5 text-left',
                  paymentMethod === 'COUNTER' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white',
                )}
              >
                <Store className="w-8 h-8 text-orange-600 mb-3" />
                <h3 className="font-bold text-xl text-gray-900">Pay at Counter</h3>
                <p className="text-sm text-gray-600 mt-1">Print bill and pay at cashier counter</p>
              </button>

              <button
                onClick={() => setPaymentMethod('ONLINE_QR')}
                className={clsx(
                  'rounded-2xl border p-5 text-left',
                  paymentMethod === 'ONLINE_QR' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white',
                )}
              >
                <QrCode className="w-8 h-8 text-teal-600 mb-3" />
                <h3 className="font-bold text-xl text-gray-900">Pay Online - Scan QR</h3>
                <p className="text-sm text-gray-600 mt-1">Placeholder integration (HitPay-ready)</p>
              </button>

              <button
                onClick={() => setPaymentMethod('ONLINE_CARD')}
                className={clsx(
                  'rounded-2xl border p-5 text-left',
                  paymentMethod === 'ONLINE_CARD' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white',
                )}
              >
                <CreditCard className="w-8 h-8 text-indigo-600 mb-3" />
                <h3 className="font-bold text-xl text-gray-900">Pay Online - Debit/Credit Card</h3>
                <p className="text-sm text-gray-600 mt-1">Placeholder integration (HitPay-ready)</p>
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm text-gray-600">Order total</div>
              <div className="text-3xl font-bold text-gray-900">₹{total.toFixed(2)}</div>
              {orderType === 'DINE_IN' && selectedTable && (
                <div className="text-sm text-gray-600 mt-1">Table {selectedTable.tableNumber}</div>
              )}
            </div>

            <button
              disabled={!paymentMethod || processing}
              onClick={checkout}
              className="mt-6 w-full md:w-auto px-8 py-4 rounded-2xl bg-green-600 text-white text-lg font-bold disabled:opacity-50"
            >
              {processing ? 'Processing...' : paymentMethod === 'COUNTER' ? 'Confirm Counter Payment' : 'Simulate Online Payment'}
            </button>
          </section>
        )}

        {step === 'success' && (
          <section className="flex-1 p-6 md:p-8 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-4xl mb-4">✓</div>
            <h2 className="text-4xl font-bold text-gray-900">Order Placed</h2>
            <p className="text-gray-600 mt-2">Payment received and order sent to kitchen</p>
            <p className="mt-3 text-lg font-semibold text-gray-800">Bill: {lastBillNo}</p>
            <button onClick={reset} className="mt-8 px-8 py-4 rounded-2xl bg-orange-500 text-white text-lg font-bold">
              Start New Order
            </button>
          </section>
        )}
      </div>
    </main>

    {pendingItem && (
      <AddonPickerModal
        item={pendingItem}
        quantity={1}
        onConfirm={(selectedAddOns) => {
          commitAddItem(pendingItem, selectedAddOns);
          setPendingItem(null);
        }}
        onCancel={() => {
          commitAddItem(pendingItem, []);
          setPendingItem(null);
        }}
      />
    )}
  </>
  );
}
