'use client';
import { Suspense, useState, useEffect, useCallback } from 'react';
import { CartItem, MenuItem, Order, OrderItem, Table } from '@/types';
import { ordersApi, kitchenApi, tablesApi } from '@/lib/api';
import { getPrintSettings, getPrintSettingsAsync } from '@/lib/printSettings';
import { buildReceiptPayloadFromOrder, printCommonReceipt } from '@/lib/receiptPrint';
import { usePOSStore } from '@/store/usePOSStore';
import { useSocket } from '@/hooks/useSocket';
import MenuPanel from '@/components/pos/MenuPanel';
import OrderPanel from '@/components/pos/OrderPanel';
import BatchFireModal from '@/components/pos/BatchFireModal';
import PaymentModal from '@/components/pos/PaymentModal';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Flame, RefreshCw, Clock, Info, X, GitMerge, Send, Printer } from 'lucide-react';
import clsx from 'clsx';

const statusBadge: Record<string, string> = {
  CREATED: 'badge-gray',
  APPROVAL_PENDING: 'badge-yellow',
  APPROVED: 'badge-blue',
  COOKING: 'badge-orange',
  READY: 'badge-green',
  COMPLETED: 'badge-gray',
  CANCELLED: 'badge-red',
};

function POSPageContent() {
  const { selectedTable, selectedOrderId, selectedOrderBillNo, cart, orderType, setSelectedTable, setSelectedOrderId, setSelectedOrderBillNo, setOrderType, addToCart,
    removeFromCart, updateQuantity, clearCart, cartSubtotal } = usePOSStore();

  const [tab, setTab] = useState<'new' | 'active'>('new');
  const [mobileTab, setMobileTab] = useState<'menu' | 'order'>('menu');
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [placing, setPlacing] = useState(false);
  const [fireOrder, setFireOrder] = useState<Order | null>(null);
  const [paymentSession, setPaymentSession] = useState<{ label: string; amount: number; orderIds: string[]; items?: { menuItemName: string; quantity: number; unitPrice: number; lineTotal: number; notes?: string }[]; billNo?: string; mergedBills?: { billLabel: string; items: { menuItemName: string; quantity: number; unitPrice: number; lineTotal: number; notes?: string }[] }[] } | null>(null);
  const [orderInfoModal, setOrderInfoModal] = useState<{ order: Order; billNo: string } | null>(null);
  const [readyForPaymentModal, setReadyForPaymentModal] = useState<{ order: Order; billNo: string } | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Merge mode
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSelected, setMergeSelected] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);

  // Transfer mode
  const [transferMode, setTransferMode] = useState(false);
  const [transferSource, setTransferSource] = useState<Order | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [showTransferTablePicker, setShowTransferTablePicker] = useState(false);
  const [allTables, setAllTables] = useState<Table[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnToTables = searchParams.get('returnTo') === 'tables';

  const fetchActiveOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const r = await ordersApi.active();
      setActiveOrders(r.data);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => { fetchActiveOrders(); }, [fetchActiveOrders]);

  // Always use DINE_IN order type (Online and QR removed)
  useEffect(() => {
    setOrderType('DINE_IN');
  }, [setOrderType]);

  const getBillNo = (order: Order) => order.billNo ?? `BILL-${order.id.slice(0, 8).toUpperCase()}`;

  const canDeleteItem = (item: OrderItem) =>
    item.status === 'PENDING' || item.status === 'QUEUED';

  const deleteOrderItem = async (itemId: string) => {
    if (!confirm('Delete this item?')) return;
    try {
      const response = await ordersApi.deleteItem(itemId);
      const updatedOrder = response.data as Order;
      toast.success('Item deleted');
      await fetchActiveOrders();
      if (updatedOrder.status === 'CANCELLED') {
        setOrderInfoModal(null);
        return;
      }
      setOrderInfoModal({
        order: updatedOrder,
        billNo: getBillNo(updatedOrder),
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete item');
    }
  };

  const printOrder = async (order: Order) => {
    let printOrderData: Order = order;
    try {
      const detail = await ordersApi.get(order.id);
      if (detail?.data) {
        printOrderData = detail.data;
      }
    } catch {
      // Fall back to already-loaded order.
    }

    let printSettings = getPrintSettings();
    try {
      printSettings = await getPrintSettingsAsync({ prefer: 'api' });
    } catch {
      // Keep local settings fallback.
    }

    const payload = buildReceiptPayloadFromOrder(printOrderData, {
      printSettings,
    });
    printCommonReceipt(payload);
  };

  const playSound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  };

  const checkAndShowReadyForPayment = (order: Order) => {
    if (order.orderType !== 'TAKE_AWAY') return;
    const allServed = order.items.every((item) => item.status === 'SERVED');
    if (allServed) {
      playSound();
      setReadyForPaymentModal({ order, billNo: getBillNo(order) });
      setTab('active');
    }
  };

  const collectPayment = async (orderId: string) => {
    try {
      await ordersApi.complete(orderId);
      toast.success('Payment collected and order completed!');
      setReadyForPaymentModal(null);
      await fetchActiveOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to complete order');
    }
  };

  const renderServedAction = (order: Order) => {
    if (!order.items.every((i: OrderItem) => i.status === 'SERVED')) {
      return null;
    }

    if (order.orderType === 'TAKE_AWAY') {
      return (
        <button
          onClick={() => collectPayment(order.id)}
          className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600"
        >
          Collect
        </button>
      );
    }

    return (
      <button
        onClick={() => {
          const currentBillNo = getBillNo(order);
          const grouped = [...order.items].sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()).reduce<Record<string, {
            menuItemName: string;
            quantity: number;
            unitPrice: number;
            lineTotal: number;
            notes?: string;
            addonSummary?: string;
            addOns?: OrderItem['addOns'];
          }[]>>((acc, item) => {
            const key = item.sourceBillNo || currentBillNo;
            if (!acc[key]) acc[key] = [];
            acc[key].push({
              menuItemName: item.menuItemName,
              quantity: item.quantity,
              unitPrice: Number(item.unitPrice),
              lineTotal: Number(item.lineTotal),
              notes: item.notes,
              addonSummary: item.addonSummary,
              addOns: item.addOns,
            });
            return acc;
          }, {});

          const groupedEntries = Object.entries(grouped);
          const mergedBillGroups = groupedEntries.map(([bill, billItems], idx) => ({
            billLabel: `Bill ${idx + 1} - ${bill}`,
            items: billItems,
          }));

          setPaymentSession({
            label: order.orderType === 'DINE_IN' ? `Table ${order.tableNumber}` : order.orderType,
            amount: Number(order.totalAmount),
            orderIds: [order.id],
            billNo: getBillNo(order),
            items: groupedEntries.length > 1 ? undefined : groupedEntries[0]?.[1] || [],
            mergedBills: groupedEntries.length > 1 ? mergedBillGroups : undefined,
          });
        }}
        className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600"
      >
        Complete
      </button>
    );
  };

  const addItemsToExistingOrder = (order: Order) => {
    if (order.orderType !== 'DINE_IN') {
      toast.error('Add item is available only for dine-in bills');
      return;
    }
    setOrderType('DINE_IN');
    if (order.orderType === 'DINE_IN' && order.tableId) {
      setSelectedTable({
        id: order.tableId,
        tableNumber: order.tableNumber ?? 0,
        qrCodeId: '',
        qrCodeUrl: '',
        qrCodeImage: '',
        status: 'OCCUPIED',
        capacity: 0,
        location: '',
      });
    }
    setSelectedOrderId(order.id);
    setSelectedOrderBillNo(order.billNo ?? getBillNo(order));
    setTab('new');
    toast.success('Adding items to selected bill');
  };

  const handleMergeToggle = (orderId: string) => {
    setMergeSelected((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId],
    );
  };

  const handleMergeConfirm = async () => {
    if (mergeSelected.length !== 2) {
      toast.error('Select exactly 2 bills to merge');
      return;
    }
    setMerging(true);
    try {
      await ordersApi.merge(mergeSelected[0], mergeSelected[1]);
      toast.success('Bills merged successfully');
      setMergeMode(false);
      setMergeSelected([]);
      fetchActiveOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Merge failed');
    } finally {
      setMerging(false);
    }
  };

  const handleTransferSelect = async (order: Order) => {
    if (!order.tableId) {
      toast.error('Only dine-in orders can be transferred');
      return;
    }
    setTransferSource(order);
    try {
      const res = await tablesApi.list();
      setAllTables(res.data);
    } catch {
      toast.error('Failed to load tables');
    }
    setShowTransferTablePicker(true);
  };

  const handleTransferConfirm = async (destTableId: string, destTableNumber: number) => {
    if (!transferSource) return;
    setTransferring(true);
    try {
      await ordersApi.transfer(transferSource.id, destTableId);
      toast.success(`Bill transferred to Table ${destTableNumber}`);
      setTransferMode(false);
      setTransferSource(null);
      setShowTransferTablePicker(false);
      fetchActiveOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  // Real-time sync
  useSocket({
    ORDER_CREATED: (data: any) => {
      setActiveOrders((prev) => [data, ...prev.filter((o) => o.id !== data.id)]);
    },
    ORDER_APPROVED: (data: any) => {
      setActiveOrders((prev) => prev.map((o) => (o.id === data.id ? data : o)));
      toast.success('Order approved!');
    },
    ORDER_FIRED: (data: any) => {
      setActiveOrders((prev) => prev.map((o) => (o.id === data.id ? data : o)));
    },
    ITEM_COOKING: () => {
      fetchActiveOrders();
    },
    ITEM_READY: (data: any) => {
      fetchActiveOrders();
      toast.success(`Item ready!`);
    },
    ITEM_SERVED: () => {
      fetchActiveOrders().then(() => {
        setTimeout(() => {
          setActiveOrders((prev) => {
            prev.forEach((order) => checkAndShowReadyForPayment(order));
            return prev;
          });
        }, 100);
      });
    },
    ORDER_UPDATED: () => {
      fetchActiveOrders();
    },
    ORDER_COMPLETED: (data: any) => {
      setActiveOrders((prev) => prev.filter((o) => o.id !== data.id));
    },
  }, ['pos:all']);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    if (!selectedOrderId && orderType === 'DINE_IN' && !selectedTable) {
      return toast.error('Please select a table');
    }
    setPlacing(true);
    try {
      if (selectedOrderId) {
        const res = await ordersApi.addItems(selectedOrderId, {
          items: cart.map((c: CartItem) => ({ menuItemId: c.menuItemId, quantity: c.quantity, notes: c.notes, selectedAddOns: c.selectedAddOns })),
        });
        const updatedOrder: Order = res.data.order;
        const itemIds: string[] = res.data.addedItemIds;

        if (itemIds.length > 0) {
          await kitchenApi.fireItems(updatedOrder.id, itemIds);
          toast.success('Items added to bill and fired to kitchen!');
        } else {
          toast.success('Items added to bill!');
        }
      } else {
        const res = await ordersApi.create({
          orderType,
          tableId: selectedTable?.id,
          items: cart.map((c: CartItem) => ({ menuItemId: c.menuItemId, quantity: c.quantity, notes: c.notes, selectedAddOns: c.selectedAddOns })),
        });
        const createdOrder: Order = res.data;
        const itemIds = createdOrder.items.map((i: OrderItem) => i.id);

        if (orderType === 'DINE_IN' && itemIds.length > 0) {
          await kitchenApi.fireItems(createdOrder.id, itemIds);
          toast.success('Order placed & fired to kitchen!');
        } else {
          toast.success(
            orderType === 'DINE_IN'
              ? 'Order placed!'
              : 'Order placed to approval hub!'
          );
        }
      }

      clearCart();
      setSelectedOrderId(null);

      if (returnToTables) {
        router.push('/tables');
        return;
      }

      setTab('active');
      fetchActiveOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-4">
        <Link href="/" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-bold text-lg text-gray-900">POS</h1>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setTab('new')}
            className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium', tab === 'new' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600')}
          >
            New Order
          </button>
          <button
            onClick={() => { setTab('active'); fetchActiveOrders(); }}
            className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium', tab === 'active' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600')}
          >
            Active <span className="ml-1 badge badge-gray">{activeOrders.length}</span>
          </button>
        </div>
      </header>

      {selectedOrderId && (
        <div className="bg-blue-600 text-white px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="space-y-1">
            <div className="text-sm font-semibold">Editing bill</div>
            <div className="text-xs text-blue-100">
              {selectedOrderBillNo ?? `BILL-${selectedOrderId.slice(0, 8).toUpperCase()}`}
              {selectedTable && orderType === 'DINE_IN' ? ` · Table ${selectedTable.tableNumber}` : ''}
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedOrderId(null);
              setSelectedOrderBillNo(null);
            }}
            className="ml-auto inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
          >
            Cancel edit
          </button>
        </div>
      )}

      {tab === 'new' ? (
        <>
          {/* Desktop: 2-column layout */}
          <div className="hidden md:flex flex-1 overflow-hidden min-h-0">
            {/* Left: Menu */}
            <div className="flex-1 flex flex-col p-4 overflow-hidden">
              <div className="card p-4 flex-1 overflow-hidden min-h-0 flex flex-col">
                <MenuPanel onAddItem={addToCart} />
              </div>
            </div>

            {/* Right: Order Panel */}
            <div className="w-96 border-l border-gray-100 bg-white p-4 flex flex-col overflow-hidden">
              <OrderPanel
                cart={cart}
                onUpdateQty={updateQuantity}
                onRemove={removeFromCart}
                onClear={clearCart}
                subtotal={cartSubtotal()}
                onPlaceOrder={placeOrder}
                loading={placing}
                orderType={orderType}
                selectedTable={selectedTable}
                onSelectTable={setSelectedTable}
                selectedOrderId={selectedOrderId}
                selectedOrderBillNo={selectedOrderBillNo}
              />
            </div>
          </div>

          {/* Mobile: Tabbed interface */}
          <div className="md:hidden flex flex-col flex-1 overflow-hidden">
            <div className="border-b border-gray-200 bg-white px-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setMobileTab('menu')}
                  className={clsx('px-4 py-3 text-sm font-medium border-b-2 transition', mobileTab === 'menu' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-600')}
                >
                  Menu
                </button>
                <button
                  onClick={() => setMobileTab('order')}
                  className={clsx('px-4 py-3 text-sm font-medium border-b-2 transition relative', mobileTab === 'order' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-600')}
                >
                  Order
                  {cart.length > 0 && (
                    <span className="absolute top-1 right-0 inline-flex items-center justify-center w-5 h-5 bg-orange-500 text-white text-xs font-bold rounded-full">
                      {cart.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
            
            {mobileTab === 'menu' ? (
              <div className="flex-1 flex flex-col p-4 overflow-hidden">
                <div className="card p-4 flex-1 overflow-hidden min-h-0 flex flex-col">
                  <MenuPanel onAddItem={addToCart} />
                </div>
              </div>
            ) : (
              <div className="flex-1 bg-white p-4 flex flex-col overflow-hidden">
                <OrderPanel
                  cart={cart}
                  onUpdateQty={updateQuantity}
                  onRemove={removeFromCart}
                  onClear={clearCart}
                  subtotal={cartSubtotal()}
                  onPlaceOrder={placeOrder}
                  loading={placing}
                  orderType={orderType}
                  selectedTable={selectedTable}
                  onSelectTable={setSelectedTable}
                  selectedOrderId={selectedOrderId}
                  selectedOrderBillNo={selectedOrderBillNo}
                />
              </div>
            )}
          </div>
        </>
      ) : (
        /* Active Orders Tab */
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Active Orders</h2>
            <div className="flex items-center gap-2">
              {!mergeMode && !transferMode && (
                <>
                  <button
                    onClick={() => { setMergeMode(true); setMergeSelected([]); }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700"
                  >
                    <GitMerge className="w-3.5 h-3.5" /> Merge Bills
                  </button>
                  <button
                    onClick={() => { setTransferMode(true); setTransferSource(null); }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                  >
                    <Send className="w-3.5 h-3.5" /> Transfer Bill
                  </button>
                </>
              )}
              {mergeMode && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-purple-700 font-medium">{mergeSelected.length}/2 selected</span>
                  <button
                    onClick={handleMergeConfirm}
                    disabled={mergeSelected.length !== 2 || merging}
                    className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50"
                  >
                    {merging ? 'Merging…' : 'Confirm Merge'}
                  </button>
                  <button
                    onClick={() => { setMergeMode(false); setMergeSelected([]); }}
                    className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
                  >
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                </div>
              )}
              {transferMode && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-700 font-medium">
                    {transferSource ? `Transferring ${getBillNo(transferSource)} → pick destination` : 'Pick source bill'}
                  </span>
                  <button
                    onClick={() => { setTransferMode(false); setTransferSource(null); }}
                    className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
                  >
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                </div>
              )}
              <button
                onClick={fetchActiveOrders}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
              >
                <RefreshCw className={clsx('w-4 h-4', loadingOrders && 'animate-spin')} />
              </button>
            </div>
          </div>
          {mergeMode && (
            <div className="mb-3 bg-purple-50 border border-purple-100 rounded-xl px-4 py-2 text-xs text-purple-700">
              Select exactly 2 dine-in bills to merge into one.
            </div>
          )}
          {transferMode && !transferSource && (
            <div className="mb-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2 text-xs text-blue-700">
              Click a dine-in bill to select it for transfer.
            </div>
          )}
          {transferMode && transferSource && (
            <div className="mb-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2 text-xs text-blue-700">
              Picking destination table for <strong>{getBillNo(transferSource)}</strong>…
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {activeOrders.map((order) => {
              const isMergeSelected = mergeSelected.includes(order.id);
              const isTransferSource = transferSource?.id === order.id;
              const isDineIn = order.orderType === 'DINE_IN';
              return (
              <div
                key={order.id}
                onClick={() => {
                  if (mergeMode && isDineIn) { handleMergeToggle(order.id); return; }
                  if (transferMode && isDineIn && !transferSource) { handleTransferSelect(order); return; }
                }}
                className={clsx(
                  'card p-3 flex flex-col h-full',
                  (mergeMode && isDineIn) && 'cursor-pointer hover:ring-2 hover:ring-purple-300',
                  (transferMode && !transferSource && isDineIn) && 'cursor-pointer hover:ring-2 hover:ring-blue-300',
                  isMergeSelected && 'ring-2 ring-purple-500 bg-purple-50',
                  isTransferSource && 'ring-2 ring-blue-500 bg-blue-50',
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-sm text-gray-900">
                      {getBillNo(order)}
                    </div>
                    <div className="text-[10px] text-gray-600 mt-1">
                      {order.orderType === 'DINE_IN' ? `Table ${order.tableNumber}` : order.orderType}
                    </div>
                    <div className="text-[10px] text-gray-500 flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <span className={`badge text-[10px] py-1 px-2 ${statusBadge[order.status]}`}>
                    {order.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto space-y-1 mb-3 text-[10px] text-gray-600">
                  {order.items.map((item) => (
                    <div key={item.id}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1 truncate">{item.menuItemName} × {item.quantity}</div>
                        <div className="flex items-center gap-2 shrink-0">
                        <span className={clsx(
                          'badge text-[10px] py-0.5 px-2',
                          item.status === 'READY' && 'badge-green',
                          item.status === 'COOKING' && 'badge-orange',
                          item.status === 'PENDING' && 'badge-gray',
                          item.status === 'QUEUED' && 'badge-blue',
                          item.status === 'SERVED' && 'badge-gray',
                        )}>
                          {item.status}
                        </span>
                          <span className="font-semibold text-gray-700">₹{Number(item.lineTotal).toFixed(2)}</span>
                        </div>
                      </div>
                      {item.addOns && item.addOns.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {item.addOns.map((addon) => (
                            <span key={addon.id} className="text-[8px] bg-orange-50 text-orange-700 border border-orange-200 rounded px-1 py-0.5">
                              +{addon.addonName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="border-t pt-3 text-[11px]">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <div className="font-semibold text-gray-900">
                      ₹{Number(order.totalAmount).toFixed(2)}
                    </div>
                    {!mergeMode && !transferMode && (
                    <>
                    <button
                      onClick={(e) => { e.stopPropagation(); printOrder(order); }}
                      className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                      title="Print bill"
                    >
                      <Printer className="w-4 h-4 text-gray-700" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setOrderInfoModal({ order, billNo: getBillNo(order) }); }}
                      className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                      title="Order details"
                    >
                      <Info className="w-4 h-4 text-blue-600" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); addItemsToExistingOrder(order); }}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[11px] font-medium hover:bg-blue-700"
                      title="Add items to this bill"
                    >
                      Add item
                    </button>
                    <div className="flex-1" />
                    {['APPROVED', 'CREATED'].includes(order.status) &&
                      order.items.some((i: OrderItem) => i.status === 'PENDING') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setFireOrder(order); }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600"
                        >
                          <Flame className="w-3 h-3" /> Fire
                        </button>
                      )}
                    {renderServedAction(order)}
                    </>
                    )}
                    {mergeMode && isMergeSelected && (
                      <span className="text-xs text-purple-600 font-semibold">✓ Selected</span>
                    )}
                    {transferMode && isTransferSource && (
                      <span className="text-xs text-blue-600 font-semibold">↑ Source</span>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
            {activeOrders.length === 0 && !loadingOrders && (
              <div className="col-span-3 text-center text-gray-400 py-16">No active orders</div>
            )}
          </div>
        </div>
      )}

      {/* Fire Modal */}
      {fireOrder && (
        <BatchFireModal
          order={fireOrder}
          onClose={() => setFireOrder(null)}
          onFired={fetchActiveOrders}
        />
      )}

      {orderInfoModal && (
        <div className="fixed inset-0 bg-black/45 z-[60] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[80vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-gray-900">{orderInfoModal.billNo}</h3>
                <p className="text-xs text-gray-500">Order items and amounts</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => printOrder(orderInfoModal.order)}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                  title="Print bill"
                >
                  <Printer className="w-4 h-4 text-gray-700" />
                </button>
                <button
                  onClick={() => {
                    addItemsToExistingOrder(orderInfoModal.order);
                    setOrderInfoModal(null);
                  }}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                >
                  Add item
                </button>
                <button onClick={() => setOrderInfoModal(null)} className="p-2 rounded-lg hover:bg-gray-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-2 overflow-y-auto flex-1 min-h-0">
              {orderInfoModal.order.items.map((item: OrderItem) => (
                <div key={item.id} className="border-b border-gray-100 pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{item.menuItemName}</div>
                      <div className="text-xs text-gray-500">Qty: {item.quantity} · Unit: ₹{Number(item.unitPrice).toFixed(2)}</div>
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
                    <div className="flex items-center gap-2">
                      {canDeleteItem(item) && (
                        <button
                          onClick={() => deleteOrderItem(item.id)}
                          className="text-red-600 text-xs font-semibold hover:text-red-800"
                        >
                          Delete
                        </button>
                      )}
                      <div className="text-sm font-semibold text-gray-900">₹{Number(item.lineTotal).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t flex items-center justify-between bg-gray-50">
              <span className="font-semibold text-gray-700">Total</span>
              <span className="font-bold text-gray-900">₹{Number(orderInfoModal.order.totalAmount).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {readyForPaymentModal && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="px-6 py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-4xl mx-auto mb-4">
                🎉
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Ready!</h2>
              <p className="text-gray-600 mb-4">All items are prepared and ready for pickup</p>

              <div className="bg-orange-50 rounded-xl p-4 mb-6 border-2 border-orange-300">
                <p className="text-xs text-gray-600 mb-1">Bill Number</p>
                <p className="text-3xl font-bold text-orange-600">{readyForPaymentModal.billNo}</p>
                <p className="text-sm text-gray-700 font-semibold mt-3">Amount: ₹{Number(readyForPaymentModal.order.totalAmount).toFixed(2)}</p>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => collectPayment(readyForPaymentModal.order.id)}
                  className="w-full px-6 py-3 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 mb-2"
                >
                  ✓ Payment Collected
                </button>
                <button
                  onClick={() => setReadyForPaymentModal(null)}
                  className="w-full px-6 py-2 bg-gray-200 text-gray-800 rounded-xl font-medium hover:bg-gray-300"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTransferTablePicker && transferSource && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Transfer Bill</div>
                <h3 className="font-bold text-gray-900">Choose destination table</h3>
                <p className="text-xs text-gray-500 mt-0.5">Transferring: <strong>{getBillNo(transferSource)}</strong></p>
              </div>
              <button
                onClick={() => { setShowTransferTablePicker(false); setTransferSource(null); setTransferMode(false); }}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-4 gap-2 max-h-[60vh] overflow-y-auto">
              {allTables
                .filter((t) => t.id !== transferSource.tableId)
                .sort((a, b) => a.tableNumber - b.tableNumber)
                .map((table) => (
                  <button
                    key={table.id}
                    onClick={() => handleTransferConfirm(table.id, table.tableNumber)}
                    disabled={transferring}
                    className={clsx(
                      'rounded-xl border-2 p-3 text-center text-sm font-semibold transition',
                      table.status === 'OCCUPIED'
                        ? 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-blue-400 hover:bg-blue-50',
                      'disabled:opacity-50',
                    )}
                  >
                    <div className="text-base font-bold">T{table.tableNumber}</div>
                    <div className="text-[10px] mt-0.5 text-gray-500">{table.status === 'OCCUPIED' ? 'Occupied' : 'Free'}</div>
                  </button>
                ))}
            </div>
            {transferring && (
              <div className="px-5 py-3 border-t text-center text-sm text-blue-600 font-medium">Transferring…</div>
            )}
          </div>
        </div>
      )}

      {paymentSession && (
        <PaymentModal
          label={paymentSession.label}
          amount={paymentSession.amount}
          orderIds={paymentSession.orderIds}
          items={paymentSession.items}
          billNo={paymentSession.billNo}
          onClose={() => setPaymentSession(null)}
          onComplete={async (orderIds: string[], paymentMethod, couponCode?: string) => {
            await Promise.all(orderIds.map((id: string) => ordersApi.complete(id, {
              paymentMethod,
              couponCode,
            })));
            fetchActiveOrders();
          }}
        />
      )}
    </div>
  );
}

export default function POSPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading POS...</div>}>
      <POSPageContent />
    </Suspense>
  );
}
