'use client';
import { useState, useEffect, useRef } from 'react';
import { MenuSection, Table, CartItem } from '@/types';
import { qrApi, ordersApi } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import toast from 'react-hot-toast';
import { ShoppingCart, Plus, Minus, ChefHat, Clock, CheckCircle } from 'lucide-react';
import clsx from 'clsx';

type Step = 'menu' | 'review' | 'tracking';
type QRBeverageCategory = { id: string; name: string };
type QRBeverageProduct = {
  id: string;
  categoryId: string;
  brand: string;
  productName?: string;
  bottleSize: number;
  bottlePrice: number;
  price30ml: number;
  price60ml: number;
  price90ml: number;
};
type QRMenuKind = 'FOOD' | 'BEVERAGES';
type QRSessionItem = {
  id: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  status: string;
  beverageId?: string;
  routingDestination?: string;
  bottleSizeMl?: number;
  servingSize?: string;
  bottleOrderFlag?: boolean;
};
type QRSessionOrder = {
  id: string;
  sessionId: string;
  billNo?: string;
  status: string;
  settlementStatus?: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  createdAt: string;
  items: QRSessionItem[];
};
type QRSessionHistory = {
  sessionId: string;
  orders: QRSessionOrder[];
};

const orderStatusLabel = (status: string) => ({
  CREATED: 'Pending',
  APPROVAL_PENDING: 'Pending Approval',
  APPROVED: 'Approved',
  COOKING: 'Preparing',
  READY: 'Ready',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
}[status] ?? status);

const itemStatusLabel = (order: QRSessionOrder, item: QRSessionItem) => {
  if (order.status === 'CANCELLED') return 'Cancelled';
  if (order.status === 'REJECTED') return 'Rejected';
  if (item.status === 'PENDING') {
    if (order.status === 'APPROVAL_PENDING') return 'Pending Approval';
    if (order.status === 'CREATED') return 'Pending';
    return item.beverageId || item.routingDestination === 'BILLING' ? 'Ready' : 'Approved';
  }
  return ({
    PENDING: 'Pending Approval',
    QUEUED: 'Approved',
    COOKING: 'Preparing',
    READY: 'Ready',
    SERVED: 'Served',
  }[item.status] ?? item.status);
};

export default function QROrderPage({ qrCodeId }: { qrCodeId: string }) {
  const [table, setTable] = useState<Table | null>(null);
  const [menu, setMenu] = useState<MenuSection[]>([]);
  const [beverageCategories, setBeverageCategories] = useState<QRBeverageCategory[]>([]);
  const [beverages, setBeverages] = useState<QRBeverageProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState<Step>('menu');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [orders, setOrders] = useState<QRSessionOrder[]>([]);
  const [previousOrderIds, setPreviousOrderIds] = useState<string[]>([]);
  const [newOrderIds, setNewOrderIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [menuKind, setMenuKind] = useState<QRMenuKind>('BEVERAGES');
  const placingRef = useRef(false);
  const pendingSubmission = useRef<{ signature: string; id: string } | null>(null);

  useEffect(() => {
    qrApi.getMenu(qrCodeId).then((r) => {
      setTable(r.data.table);
      setMenu(r.data.menu);
      setBeverageCategories(r.data.beverageCategories ?? []);
      setBeverages(r.data.beverages ?? []);
      setLoading(false);
    }).catch(() => {
      toast.error('Invalid QR code');
      setLoading(false);
    });
    qrApi.session(qrCodeId).then((r) => {
      if (!r.data) return;
      setSessionId(r.data.sessionId);
      setOrders(r.data.orders);
      const currentOrderIds = r.data.orders.map((order: QRSessionOrder) => order.id);
      const storageKey = `qr-order-labels:${r.data.sessionId}`;
      const savedPreviousIds = window.sessionStorage.getItem(`${storageKey}:previous`);
      const savedNewIds = window.sessionStorage.getItem(`${storageKey}:new`);
      if (savedPreviousIds !== null && savedNewIds !== null) {
        const previousIds = savedPreviousIds.split(',');
        const newIds = savedNewIds.split(',');
        setPreviousOrderIds(currentOrderIds.filter((id: string) => previousIds.includes(id)));
        setNewOrderIds(currentOrderIds.filter((id: string) => newIds.includes(id)));
      } else {
        setPreviousOrderIds(currentOrderIds);
        setNewOrderIds([]);
      }
      setStep('tracking');
    }).catch(() => {
      toast.error('Could not load previous table orders');
    }).finally(() => {
      setSessionLoading(false);
    });
  }, [qrCodeId]);

  useEffect(() => {
    if (!sessionId) return;
    const storageKey = `qr-order-labels:${sessionId}`;
    window.sessionStorage.setItem(`${storageKey}:previous`, previousOrderIds.join(','));
    window.sessionStorage.setItem(`${storageKey}:new`, newOrderIds.join(','));
  }, [sessionId, previousOrderIds, newOrderIds]);

  const receiveOrderUpdate = (order: QRSessionOrder) => {
    if (!order?.id) return;
    setOrders((previous) => {
      const index = previous.findIndex((entry) => entry.id === order.id);
      if (index < 0) {
        if (order.sessionId !== sessionId) return previous;
        return [...previous, order].sort(
          (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
        );
      }
      const updated = [...previous];
      updated[index] = {
        ...updated[index],
        ...order,
        sessionId: order.sessionId ?? updated[index].sessionId,
        items: Array.isArray(order.items) ? order.items : updated[index].items,
      };
      return updated;
    });
    if (!previousOrderIds.includes(order.id)) {
      setNewOrderIds((previous) => previous.includes(order.id) ? previous : [...previous, order.id]);
    }
  };

  const receiveItemUpdate = (item: QRSessionItem & { orderId: string; sessionId?: string }) => {
    if (!item?.id || !item.orderId || (item.sessionId && item.sessionId !== sessionId)) return;
    setOrders((previous) => previous.map((order) => order.id !== item.orderId
      ? order
      : { ...order, items: order.items.map((entry) => entry.id === item.id ? { ...entry, status: item.status } : entry) }));
  };

  useSocket({
    ORDER_CREATED: receiveOrderUpdate,
    ORDER_APPROVED: receiveOrderUpdate,
    ORDER_FIRED: receiveOrderUpdate,
    ORDER_UPDATED: receiveOrderUpdate,
    ORDER_COMPLETED: receiveOrderUpdate,
    ORDER_CANCELLED: receiveOrderUpdate,
    ORDER_REJECTED: receiveOrderUpdate,
    ITEM_COOKING: receiveItemUpdate,
    ITEM_READY: receiveItemUpdate,
    ITEM_SERVED: receiveItemUpdate,
  }, sessionId ? [`session:${sessionId}`] : []);

  const addItem = (item: any) => {
    setCart((prev) => {
      const lineId = `food:${item.id}`;
      const existing = prev.find((c) => c.cartLineId === lineId);
      if (existing) return prev.map((c) => c.cartLineId === lineId ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { cartLineId: lineId, menuItemId: item.id, menuItemName: item.name, unitPrice: Number(item.price), quantity: 1, categoryName: item.category?.name }];
    });
  };

  const addBeverage = (product: QRBeverageProduct, servingSize: string, bottleOrderFlag = false) => {
    const servingKey = bottleOrderFlag ? 'BOTTLE' : servingSize;
    const lineId = `beverage:${product.id}:${servingKey}`;
    const name = `${product.brand}${product.productName ? ` ${product.productName}` : ''} · ${bottleOrderFlag ? `${product.bottleSize}ml bottle` : servingSize}`;
    const price = bottleOrderFlag ? Number(product.bottlePrice) : Number(product[`price${servingSize.toLowerCase()}` as 'price30ml' | 'price60ml' | 'price90ml']);
    setCart((prev) => {
      const existing = prev.find((c) => c.cartLineId === lineId);
      if (existing) return prev.map((c) => c.cartLineId === lineId ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, {
        cartLineId: lineId,
        menuItemId: product.id,
        beverageId: product.id,
        servingSize: bottleOrderFlag ? 'BOTTLE' : servingSize,
        bottleOrderFlag,
        menuItemName: name,
        unitPrice: price,
        quantity: 1,
        categoryName: beverageCategories.find((category) => category.id === product.categoryId)?.name,
      }];
    });
  };

  const removeItem = (cartLineId: string) => {
    setCart((prev) => prev.reduce((acc: CartItem[], c) => {
      if ((c.cartLineId ?? c.menuItemId) !== cartLineId) return [...acc, c];
      if (c.quantity > 1) return [...acc, { ...c, quantity: c.quantity - 1 }];
      return acc;
    }, []));
  };

  const addCartItem = (lineId: string) => {
    setCart((prev) => prev.map((item) =>
      (item.cartLineId ?? item.menuItemId) === lineId ? { ...item, quantity: item.quantity + 1 } : item,
    ));
  };

  const getQty = (id: string) => cart.find((c) => (c.cartLineId ?? c.menuItemId) === id)?.quantity || 0;

  const subtotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);

  const placeOrder = async () => {
    if (!table || cart.length === 0 || placingRef.current) return;
    placingRef.current = true;
    setPlacing(true);
    try {
      const orderData = {
        orderType: 'QR',
        tableId: table.id,
        sessionId: sessionId ?? undefined,
        items: cart.map((c) => c.beverageId
          ? { beverageId: c.beverageId, servingSize: c.servingSize, bottleOrderFlag: c.bottleOrderFlag, quantity: c.quantity }
          : { menuItemId: c.menuItemId, quantity: c.quantity, selectedAddOns: c.selectedAddOns }),
      };
      const signature = JSON.stringify(orderData);
      if (pendingSubmission.current?.signature !== signature) {
        pendingSubmission.current = { signature, id: crypto.randomUUID() };
      }
      const addingToSession = Boolean(sessionId);
      const r = await ordersApi.create({
        ...orderData,
        clientRequestId: pendingSubmission.current.id,
      });
      const placedOrder = r.data as QRSessionOrder;
      setSessionId(placedOrder.sessionId);
      setOrders((previous) => previous.some((order) => order.id === placedOrder.id)
        ? previous.map((order) => order.id === placedOrder.id ? placedOrder : order)
        : [...previous, placedOrder]);
      if (!previousOrderIds.includes(placedOrder.id)) {
        setNewOrderIds((previous) => previous.includes(placedOrder.id) ? previous : [...previous, placedOrder.id]);
      }
      pendingSubmission.current = null;
      setCart([]);
      setStep('tracking');
      toast.success(addingToSession ? 'New order placed for this table!' : 'Order placed!');
      try {
        const historyResponse = await qrApi.session(qrCodeId);
        const history = historyResponse.data as QRSessionHistory | null;
        if (!history || !Array.isArray(history.orders) || history.sessionId !== placedOrder.sessionId) {
          throw new Error('The active table order history could not be verified.');
        }
        setSessionId(history.sessionId);
        setOrders((current) => {
          const merged = new Map(
            current
              .filter((order) => order.sessionId === history.sessionId)
              .map((order) => [order.id, order]),
          );
          history.orders.forEach((order) => merged.set(order.id, order));
          return Array.from(merged.values()).sort(
            (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
          );
        });
        setNewOrderIds((current) => {
          const orderIds = new Set(current);
          history.orders.forEach((order) => {
            if (!previousOrderIds.includes(order.id)) orderIds.add(order.id);
          });
          return Array.from(orderIds);
        });
      } catch {
        toast.error('Order placed, but the full table order history could not be refreshed. Refresh the page to sync orders.');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to place order');
    } finally {
      placingRef.current = false;
      setPlacing(false);
    }
  };

  const allItems = menu.flatMap((s) => s.items).filter((i) => i.isAvailable);
  const filtered = selectedCategory === 'all' ? allItems : allItems.filter((i) => i.categoryId === selectedCategory);
  const filteredBeverages = selectedCategory === 'all'
    ? beverages
    : beverages.filter((beverage) => beverage.categoryId === selectedCategory);
  const totalItems = cart.reduce((s, c) => s + c.quantity, 0);
  const beginOrderMore = () => {
    setPreviousOrderIds(orders.map((order) => order.id));
    setNewOrderIds([]);
    setCart([]);
    setStep('menu');
  };
  const totalQuantity = orders.reduce((quantity, order) => order.status === 'CANCELLED'
    ? quantity
    : quantity + order.items.reduce((orderQuantity, item) => orderQuantity + item.quantity, 0), 0);
  const pendingBillAmount = orders.reduce((amount, order) =>
    order.settlementStatus === 'UNPAID' && order.status !== 'CANCELLED'
      ? amount + Number(order.totalAmount || 0)
      : amount, 0);
  const combinedOrderAmount = orders.reduce((amount, order) =>
    order.status !== 'CANCELLED' ? amount + Number(order.totalAmount || 0) : amount, 0);
  const paidAmount = orders.reduce((amount, order) =>
    order.settlementStatus === 'PAID' && order.status !== 'CANCELLED'
      ? amount + Number(order.totalAmount || 0)
      : amount, 0);
  const combinedItems = orders
    .filter((order) => order.status !== 'CANCELLED')
    .flatMap((order) => order.items)
    .reduce((summary, item) => {
      const key = `${item.menuItemName}:${item.unitPrice}`;
      const existing = summary.get(key);
      summary.set(key, {
        name: item.menuItemName,
        unitPrice: item.unitPrice,
        quantity: (existing?.quantity ?? 0) + item.quantity,
        total: (existing?.total ?? 0) + Number(item.lineTotal || 0),
      });
      return summary;
    }, new Map<string, { name: string; unitPrice: number; quantity: number; total: number }>());
  if (loading || sessionLoading) {
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
    const activeOrders = orders.filter((order) => order.status !== 'CANCELLED');
    const StatusIcon = activeOrders.length > 0 && activeOrders.every(
      (order) => order.status === 'READY' || order.status === 'COMPLETED',
    ) ? CheckCircle : Clock;
    const orderStatusSummary = Array.from(orders.reduce((statuses, order) => {
      const label = orderStatusLabel(order.status);
      statuses.set(label, (statuses.get(label) ?? 0) + 1);
      return statuses;
    }, new Map<string, number>()).entries())
      .map(([label, count]) => count > 1 ? `${label} (${count})` : label)
      .join(' · ');
    const previousOrders = orders.filter((order) => previousOrderIds.includes(order.id));
    const newlyPlacedOrders = orders.filter((order) => newOrderIds.includes(order.id));
    const previousOrdersTotal = previousOrders.reduce(
      (total, order) => total + (order.status === 'CANCELLED' ? 0 : Number(order.totalAmount || 0)),
      0,
    );
    const newOrdersTotal = newlyPlacedOrders.reduce(
      (total, order) => total + (order.status === 'CANCELLED' ? 0 : Number(order.totalAmount || 0)),
      0,
    );
    const renderOrder = (order: QRSessionOrder) => (
      <article key={order.id} className="rounded-xl border border-gray-200 bg-white p-4 text-left">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-gray-900">Order ID: {order.id}</p>
            {order.billNo && <p className="text-xs text-gray-500">Bill #{order.billNo}</p>}
            <p className="mt-1 text-xs text-gray-500">{new Date(order.createdAt).toLocaleString()}</p>
          </div>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
            {orderStatusLabel(order.status)}
          </span>
        </div>
        <div className="mt-3 divide-y divide-gray-100">
          {order.items.map((item) => (
            <div key={item.id} className="py-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-medium text-gray-800">{item.menuItemName} × {item.quantity}</span>
                <span className="shrink-0 font-semibold text-gray-900">₹{Number(item.lineTotal).toFixed(2)}</span>
              </div>
              <div className="mt-1 flex justify-between text-xs text-gray-500">
                <span>
                  ₹{Number(item.unitPrice).toFixed(2)} each
                  {item.bottleOrderFlag && item.bottleSizeMl ? ` · ${item.bottleSizeMl}ml bottle` : ''}
                  {!item.bottleOrderFlag && item.servingSize ? ` · ${item.servingSize}` : ''}
                </span>
                <span>{itemStatusLabel(order, item)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 text-sm">
          <span className="text-gray-500">
            {order.status === 'CANCELLED'
              ? 'Cancelled'
              : ({
                PAID: 'Paid',
                UNPAID: 'Unpaid',
                CANCELLED: 'Cancelled',
                REFUNDED: 'Refunded',
              } as Record<string, string>)[order.settlementStatus ?? 'UNPAID']}
          </span>
          <span className="font-bold text-gray-900">Order total ₹{Number(order.totalAmount).toFixed(2)}</span>
        </div>
      </article>
    );

    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 p-4">
        <div className="mx-auto w-full max-w-2xl">
          <div className="card p-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 mb-3">
                <ChefHat className="w-8 h-8 text-orange-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Table {table.tableNumber} Orders</h2>
              <p className="text-sm text-gray-500">All orders in this active table session</p>
              <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3">
                <p className="font-semibold text-amber-900 flex items-center justify-center gap-2">
                  <StatusIcon className="w-4 h-4" />
                  Current order statuses: {orderStatusSummary || 'No orders yet'}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-gray-50 p-3 text-center">
                <p className="text-xs text-gray-500">Previous orders</p>
                <p className="text-lg font-bold text-gray-900">{previousOrderIds.length}</p>
                <p className="text-xs text-gray-500">₹{previousOrdersTotal.toFixed(2)}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 text-center">
                <p className="text-xs text-gray-500">New orders</p>
                <p className="text-lg font-bold text-gray-900">{newOrderIds.length}</p>
                <p className="text-xs text-gray-500">₹{newOrdersTotal.toFixed(2)}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 text-center">
                <p className="text-xs text-gray-500">Total quantities</p>
                <p className="text-lg font-bold text-gray-900">{totalQuantity}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 text-center">
                <p className="text-xs text-gray-500">Combined total</p>
                <p className="text-lg font-bold text-gray-900">₹{combinedOrderAmount.toFixed(2)}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 text-center">
                <p className="text-xs text-gray-500">Paid amount</p>
                <p className="text-lg font-bold text-gray-900">₹{paidAmount.toFixed(2)}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 text-center">
                <p className="text-xs text-gray-500">Pending bill</p>
                <p className="text-lg font-bold text-orange-600">₹{pendingBillAmount.toFixed(2)}</p>
              </div>
            </div>

            <section className="mt-6">
              <h3 className="mb-3 font-bold text-gray-900">Previous Orders</h3>
              <div className="space-y-3">
                {previousOrders.length ? previousOrders.map(renderOrder) : (
                  <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">No previous orders in this session.</p>
                )}
              </div>
            </section>

            <section className="mt-6">
              <h3 className="mb-3 font-bold text-gray-900">Newly Placed Orders</h3>
              <div className="space-y-3">
                {newlyPlacedOrders.length ? newlyPlacedOrders.map(renderOrder) : (
                  <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">No new orders placed in this visit.</p>
                )}
              </div>
            </section>

            <section className="mt-6 rounded-xl border border-orange-200 bg-orange-50 p-4">
              <h3 className="font-bold text-gray-900">Combined Item Summary</h3>
              <div className="mt-2 space-y-2 text-sm">
                {Array.from(combinedItems.values()).map((item) => (
                  <div key={`${item.name}:${item.unitPrice}`} className="flex justify-between gap-3 text-gray-700">
                    <span>{item.name} × {item.quantity}</span>
                    <span>₹{item.total.toFixed(2)}</span>
                  </div>
                ))}
                {!combinedItems.size && <p className="text-gray-500">No active items.</p>}
              </div>
              <div className="mt-3 flex justify-between border-t border-orange-200 pt-3 font-bold text-gray-900">
                <span>Unpaid orders only</span>
                <span>₹{pendingBillAmount.toFixed(2)}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">Paid and cancelled orders are excluded from the pending bill.</p>
            </section>

            <button
              onClick={beginOrderMore}
              className="mt-6 w-full bg-orange-500 text-white py-3 rounded-xl font-semibold"
            >
              Order More
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32 flex flex-col overflow-hidden">
      <div className="bg-white border-b px-4 py-4">
        <div className="flex items-center gap-2 mb-1">
          <ChefHat className="w-5 h-5 text-orange-500" />
          <h1 className="font-bold text-gray-900">Menu</h1>
        </div>
        <p className="text-sm text-gray-500">Table {table.tableNumber} · {table.location || 'Dine In'}</p>
        {orders.length > 0 && (
          <button onClick={() => setStep('tracking')} className="mt-3 text-sm font-semibold text-orange-600">
            View table orders ({orders.length})
          </button>
        )}
      </div>

      <div className="bg-white border-b px-4 py-2 flex gap-2">
        {(['BEVERAGES', 'FOOD'] as QRMenuKind[]).map((kind) => (
          <button
            key={kind}
            onClick={() => { setMenuKind(kind); setSelectedCategory('all'); }}
            className={clsx('rounded-lg px-4 py-2 text-sm font-semibold', menuKind === kind ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700')}
          >
            {kind === 'FOOD' ? 'Food' : 'Beverages'}
          </button>
        ))}
      </div>

      {/* Category Tabs */}
      <div className="bg-white border-b px-4 py-2 flex gap-2 overflow-x-auto z-10">
        <button
          onClick={() => setSelectedCategory('all')}
          className={clsx('shrink-0 px-3 py-1.5 rounded-full text-xs font-medium',
            selectedCategory === 'all' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600')}
        >All</button>
        {(menuKind === 'FOOD' ? menu.map((s) => s.category) : beverageCategories).map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={clsx('shrink-0 px-3 py-1.5 rounded-full text-xs font-medium',
              selectedCategory === category.id ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600')}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {menuKind === 'FOOD' && filtered.map((item) => {
          const lineId = `food:${item.id}`;
          const qty = getQty(lineId);
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
                  <button onClick={() => removeItem(lineId)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
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
        {menuKind === 'BEVERAGES' && filteredBeverages.map((product) => {
          const productName = `${product.brand}${product.productName ? ` ${product.productName}` : ''}`;
          const servingOptions = [
            { size: '30ML', price: Number(product.price30ml), bottle: false },
            { size: '60ML', price: Number(product.price60ml), bottle: false },
            { size: '90ML', price: Number(product.price90ml), bottle: false },
            { size: `${product.bottleSize}ml Bottle`, price: Number(product.bottlePrice), bottle: true },
          ].filter((option) => option.price > 0);
          return (
            <div key={product.id} className="card p-4">
              <div className="mb-3">
                <div className="font-semibold text-gray-900">{productName}</div>
                <p className="text-xs text-gray-500">Choose a serving size</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {servingOptions.map((option) => {
                  const servingSize = option.bottle ? 'BOTTLE' : option.size;
                  const lineId = `beverage:${product.id}:${servingSize}`;
                  const quantity = getQty(lineId);
                  return (
                    <div key={servingSize} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-gray-700">{option.size}</div>
                        <div className="text-sm font-bold text-orange-600">₹{option.price.toFixed(2)}</div>
                        {quantity > 0 && <div className="text-[10px] text-gray-500">{quantity} in cart</div>}
                      </div>
                      <button
                        type="button"
                        onClick={() => addBeverage(product, servingSize, option.bottle)}
                        aria-label={`Add ${productName} ${option.size} to order`}
                        className="shrink-0 flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
                      >
                        <Plus className="h-4 w-4" /> Add
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {menuKind === 'BEVERAGES' && filteredBeverages.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-500">No beverages are available right now.</p>
        )}
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
                <div key={c.cartLineId ?? c.menuItemId} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{c.menuItemName}</div>
                    <div className="text-xs text-gray-400">₹{c.unitPrice} each</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => removeItem(c.cartLineId ?? c.menuItemId)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center font-bold text-sm">{c.quantity}</span>
                    <button onClick={() => addCartItem(c.cartLineId ?? c.menuItemId)}
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
