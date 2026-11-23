'use client';
import { Suspense, useState, useEffect, useCallback } from 'react';
import { CartItem, MenuItem, Order, OrderItem, Table } from '@/types';
import { ordersApi, kitchenApi, tablesApi } from '@/lib/api';
import { getPrintSettings, getPrintSettingsAsync } from '@/lib/printSettings';
import { buildReceiptPayloadFromOrder, printCommonReceipt } from '@/lib/receiptPrint';
import { usePOSStore } from '@/store/usePOSStore';
import { useAuthStore } from '@/store/useAuthStore';
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
  REJECTED: 'badge-red',
  REMOVED: 'badge-gray',
};

const MAX_MERGE_BILLS = 5;

function POSPageContent() {
  const user = useAuthStore((state) => state.user);
  const canViewActiveOrders =
    user?.role === 'ADMIN' ||
    ((user?.role === 'CASHIER' || user?.role === 'WAITER') &&
      user.accessRights?.includes('POS') === true);
  const { selectedTable, selectedOrderId, selectedOrderBillNo, cart, orderType, setSelectedTable, setSelectedOrderId, setSelectedOrderBillNo, setOrderType, addToCart,
    removeFromCart, updateQuantity, clearCart, cartSubtotal, addBeverageToCart } = usePOSStore();

  const [tab, setTab] = useState<'new' | 'active'>('new');
  const [mobileTab, setMobileTab] = useState<'menu' | 'order'>('menu');
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [placing, setPlacing] = useState(false);
  const [fireOrder, setFireOrder] = useState<Order | null>(null);
  const [paymentSession, setPaymentSession] = useState<{ label: string; amount: number; orderIds: string[]; items?: { menuItemName: string; quantity: number; unitPrice: number; lineTotal: number; isBeverage?: boolean; bottleSizeMl?: number; notes?: string }[]; billNo?: string; mergedBills?: { billLabel: string; items: { menuItemName: string; quantity: number; unitPrice: number; lineTotal: number; isBeverage?: boolean; bottleSizeMl?: number; notes?: string }[] }[] } | null>(null);
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

  const isBillingItem = (item: OrderItem) => !!item.beverageId || item.routingDestination === 'BILLING';
  const isBillableItem = (item: OrderItem) =>
    !['REJECTED', 'REMOVED'].includes(item.status) &&
    !['REJECTED', 'REMOVED'].includes(item.approvalStatus ?? 'PENDING');
  const hasPassedApproval = (order: Order) =>
    order.status !== 'APPROVAL_PENDING' &&
    !['COMPLETED', 'CANCELLED'].includes(order.status);
  const displayItemStatus = (order: Order, item: OrderItem) =>
    isBillingItem(item) && item.status === 'PENDING' && hasPassedApproval(order)
      ? 'READY'
      : item.status;
  const isWaitingForApproval = (order: Order, item: OrderItem) =>
    order.status === 'APPROVAL_PENDING' &&
    item.status === 'PENDING' &&
    (item.approvalStatus ?? 'PENDING') === 'PENDING';
  const normalizeActiveOrder = (order: Order): Order => ({
    ...order,
    items: order.items.map((item) => ({ ...item, status: displayItemStatus(order, item) })),
  });
  const isReadyForSettlement = (order: Order) =>
    order.items.filter(isBillableItem).length > 0 &&
    order.items.filter(isBillableItem).every((item) =>
      isBillingItem(item)
        ? ['READY', 'SERVED'].includes(displayItemStatus(order, item))
        : item.status === 'SERVED',
    );

  const fetchActiveOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const r = await ordersApi.active();
      setActiveOrders(r.data.map(normalizeActiveOrder));
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    if (canViewActiveOrders) fetchActiveOrders();
  }, [fetchActiveOrders, canViewActiveOrders]);

  // Always use DINE_IN order type (Online and QR removed)
  useEffect(() => {
    setOrderType('DINE_IN');
  }, [setOrderType]);

  const getBillNo = (order: Order) => order.billNo ?? `BILL-${order.id.slice(0, 8).toUpperCase()}`;
  const selectedMergeOrders = mergeSelected
    .map((id) => activeOrders.find((order) => order.id === id))
    .filter((order): order is Order => Boolean(order));
  const isQrMergeSelection = selectedMergeOrders.length > 0 &&
    selectedMergeOrders.every((order) => order.orderType === 'QR');

  const canDeleteItem = (order: Order, item: OrderItem) =>
    order.status === 'CREATED' && item.status === 'PENDING';

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
    if (isReadyForSettlement(order)) {
      playSound();
      setReadyForPaymentModal({ order, billNo: getBillNo(order) });
      setTab(canViewActiveOrders ? 'active' : 'new');
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
    if (!isReadyForSettlement(order)) {
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
          const grouped = order.items.filter(isBillableItem).sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()).reduce<Record<string, {
            menuItemName: string;
            quantity: number;
            unitPrice: number;
            lineTotal: number;
            isBeverage?: boolean;
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
              isBeverage: !!item.beverageId,
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
    if (mergeSelected.includes(orderId)) {
      setMergeSelected((prev) => prev.filter((id) => id !== orderId));
      return;
    }
    const order = activeOrders.find((entry) => entry.id === orderId);
    if (!order || !['DINE_IN', 'QR'].includes(order.orderType)) {
      toast.error('Only dine-in and QR bills can be combined');
      return;
    }
    const firstSelected = activeOrders.find((entry) => entry.id === mergeSelected[0]);
    if (firstSelected && firstSelected.orderType !== order.orderType) {
      toast.error('Select bills of the same type');
      return;
    }
    if (
      order.orderType === 'QR' &&
      firstSelected &&
      (order.tableId !== firstSelected.tableId ||
        !order.sessionId ||
        order.sessionId !== firstSelected.sessionId)
    ) {
      toast.error('QR bills can only be combined within the same active table session');
      return;
    }
    if (mergeSelected.length >= MAX_MERGE_BILLS) {
      toast.error(`You can merge up to ${MAX_MERGE_BILLS} bills at a time`);
      return;
    }
    setMergeSelected((prev) => [...prev, orderId]);
  };

  const handleMergeConfirm = async () => {
    if (mergeSelected.length < 2 || mergeSelected.length > MAX_MERGE_BILLS) {
      toast.error(`Select 2 to ${MAX_MERGE_BILLS} bills to merge`);
      return;
    }
    if (selectedMergeOrders.length !== mergeSelected.length) {
      toast.error('Some selected bills are no longer active. Refresh the orders and try again.');
      await fetchActiveOrders();
      return;
    }

    if (isQrMergeSelection) {
      const firstOrder = selectedMergeOrders[0];
      if (
        selectedMergeOrders.some((order) =>
          order.tableId !== firstOrder.tableId ||
          !order.sessionId ||
          order.sessionId !== firstOrder.sessionId ||
          order.settlementStatus === 'PAID' ||
          !isReadyForSettlement(order) ||
          order.items.length === 0,
        )
      ) {
        toast.error('Select unpaid QR bills from the same table session that are ready for settlement');
        return;
      }

      setPaymentSession({
        label: `Table ${firstOrder.tableNumber ?? ''}`,
        amount: selectedMergeOrders.reduce((total, order) => total + Number(order.totalAmount), 0),
        orderIds: selectedMergeOrders.map((order) => order.id),
        billNo: `Combined ${selectedMergeOrders.length} QR bills`,
        mergedBills: selectedMergeOrders.map((order) => ({
          billLabel: getBillNo(order),
          items: order.items.filter(isBillableItem).map((item) => ({
            menuItemName: item.menuItemName,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            lineTotal: Number(item.lineTotal),
            isBeverage: !!item.beverageId,
            bottleSizeMl: item.bottleSizeMl,
            notes: item.notes,
          })),
        })),
      });
      setMergeMode(false);
      setMergeSelected([]);
      return;
    }

    if (selectedMergeOrders.some((order) => order.orderType !== 'DINE_IN')) {
      toast.error('Select dine-in bills to merge');
      return;
    }
    setMerging(true);
    let mergedCount = 0;
    try {
      try {
        const destinationOrderId = mergeSelected[mergeSelected.length - 1];
        for (const sourceOrderId of mergeSelected.slice(0, -1)) {
          await ordersApi.merge(sourceOrderId, destinationOrderId);
          mergedCount += 1;
        }
      } catch (err: any) {
        setMergeMode(false);
        setMergeSelected([]);
        fetchActiveOrders().catch(() => toast.error('Active bills could not be refreshed.'));
        if (mergedCount > 0) {
          toast.error('The merge did not finish. Review the refreshed active bills before retrying.');
          return;
        }
        toast.error(err.response?.data?.message || 'Merge failed');
        return;
      }

      toast.success('Bills merged successfully');
      setMergeMode(false);
      setMergeSelected([]);
      fetchActiveOrders().catch(() => toast.error('Bills merged, but active orders could not be refreshed.'));
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
      const approvedOrder = normalizeActiveOrder(data as Order);
      setActiveOrders((prev) => prev.map((o) => (o.id === data.id ? approvedOrder : o)));
      toast.success('Order approved!');
    },
    ORDER_FIRED: (data: any) => {
      const firedOrder = normalizeActiveOrder(data as Order);
      setActiveOrders((prev) => prev.map((o) => (o.id === data.id ? firedOrder : o)));
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
          items: cart.map((c: CartItem) => c.beverageId ? { beverageId: c.beverageId, servingSize: c.servingSize, bottleOrderFlag: c.bottleOrderFlag, quantity: c.quantity, notes: c.notes } : { menuItemId: c.menuItemId, quantity: c.quantity, notes: c.notes, selectedAddOns: c.selectedAddOns }),
        });
        const updatedOrder: Order = res.data.order;
        const itemIds: string[] = res.data.addedItemIds;

        const kitchenItemIds = updatedOrder.items.filter((i: OrderItem) => i.routingDestination === 'KITCHEN' && itemIds.includes(i.id)).map((i: OrderItem) => i.id);
        if (kitchenItemIds.length > 0) {
          await kitchenApi.fireItems(updatedOrder.id, kitchenItemIds);
          toast.success('Items added to bill and routed!');
        } else {
          toast.success('Items added to bill!');
        }
      } else {
        const res = await ordersApi.create({
          orderType,
          tableId: selectedTable?.id,
          items: cart.map((c: CartItem) => c.beverageId ? { beverageId: c.beverageId, servingSize: c.servingSize, bottleOrderFlag: c.bottleOrderFlag, quantity: c.quantity, notes: c.notes } : { menuItemId: c.menuItemId, quantity: c.quantity, notes: c.notes, selectedAddOns: c.selectedAddOns }),
        });
        const createdOrder: Order = res.data;
        const itemIds = createdOrder.items.map((i: OrderItem) => i.id);

        const kitchenItemIds = createdOrder.items.filter((i: OrderItem) => i.routingDestination === 'KITCHEN').map((i: OrderItem) => i.id);
        if (orderType === 'DINE_IN' && kitchenItemIds.length > 0 && createdOrder.status !== 'APPROVAL_PENDING') {
          await kitchenApi.fireItems(createdOrder.id, kitchenItemIds);
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

      setTab(canViewActiveOrders ? 'active' : 'new');
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
            {canViewActiveOrders && (
            <button
              onClick={() => { setTab('active'); fetchActiveOrders(); }}
              className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium', tab === 'active' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600')}
            >
              Active Bills <span className="ml-1 badge badge-gray">{activeOrders.length}</span>
            </button>
          )}
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
                  <span className="text-xs text-purple-700 font-medium">{mergeSelected.length}/{MAX_MERGE_BILLS} selected</span>
                  <button
                    onClick={handleMergeConfirm}
                    disabled={mergeSelected.length < 2 || mergeSelected.length > MAX_MERGE_BILLS || merging}
                    className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50"
                  >
                    {merging ? 'Merging…' : isQrMergeSelection ? 'Combine & Pay' : 'Confirm Merge'}
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
                title="Refresh active bills"
              >
                <RefreshCw className={clsx('w-4 h-4', loadingOrders && 'animate-spin')} />
              </button>
              {user?.role === 'ADMIN' && (
                <Link href="/history" className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                  Payment History
                </Link>
              )}
            </div>
          </div>
          {mergeMode && (
            <div className="mb-3 bg-purple-50 border border-purple-100 rounded-xl px-4 py-2 text-xs text-purple-700">
              {isQrMergeSelection
                ? `QR bills combine at checkout; original order records are preserved.`
                : `Select 2 to ${MAX_MERGE_BILLS} bills of the same type. The last dine-in bill selected is the destination.`}
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
              const isMergeable = isDineIn || order.orderType === 'QR';
              return (
              <div
                key={order.id}
                onClick={() => {
                  if (mergeMode && isMergeable) { handleMergeToggle(order.id); return; }
                  if (transferMode && isDineIn && !transferSource) { handleTransferSelect(order); return; }
                }}
                className={clsx(
                  'card p-3 flex flex-col h-full',
                  (mergeMode && isMergeable) && 'cursor-pointer hover:ring-2 hover:ring-purple-300',
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
                    {order.status === 'APPROVAL_PENDING' && user?.accessRights?.includes('APPROVAL') && (
                      <Link
                        href="/approval"
                        onClick={(event) => event.stopPropagation()}
                        className="inline-block mt-1 text-[10px] font-semibold text-orange-700 hover:underline"
                      >
                        Review in Approval Hub
                      </Link>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`badge text-[10px] py-1 px-2 ${statusBadge[order.status]}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                    <span className={clsx('badge text-[9px] py-0.5 px-2', order.settlementStatus === 'PAID' ? 'badge-green' : 'badge-orange')}>
                      {order.settlementStatus ?? 'UNPAID'}
                    </span>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto space-y-1 mb-3 text-[10px] text-gray-600">
                  {order.items.map((item) => {
                    const itemStatus = displayItemStatus(order, item);
                    const waitingForApproval = isWaitingForApproval(order, item);
                    return (
                    <div key={item.id}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1 truncate">{item.menuItemName} × {item.quantity}</div>
                        <div className="flex items-center gap-2 shrink-0">
                        <span className={clsx(
                          'badge text-[10px] py-0.5 px-2',
                          waitingForApproval && 'badge-yellow',
                          itemStatus === 'READY' && 'badge-green',
                          itemStatus === 'COOKING' && 'badge-orange',
                          itemStatus === 'PENDING' && 'badge-gray',
                          itemStatus === 'QUEUED' && 'badge-blue',
                          itemStatus === 'SERVED' && 'badge-gray',
                        )} title={item.status === 'SERVED' && order.status === 'APPROVAL_PENDING' ? 'Already served from an earlier order; it will not be sent to the kitchen again.' : undefined}>
                          {waitingForApproval ? 'AWAITING APPROVAL' : itemStatus}
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
                    );
                  })}
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
                      order.items.some((i: OrderItem) =>
                        i.status === 'PENDING' &&
                        !i.beverageId &&
                        i.routingDestination !== 'BILLING'
                      ) && (
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
                <p className="text-xs text-gray-500">
                  {orderInfoModal.order.orderType === 'DINE_IN' ? `Table ${orderInfoModal.order.tableNumber ?? '—'} · ` : ''}
                  Order {orderInfoModal.order.id.slice(0, 8)} · {orderInfoModal.order.status.replace('_', ' ')} · {orderInfoModal.order.settlementStatus ?? 'UNPAID'}
                </p>
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
                      {(item.beverageId || item.routingDestination === 'BILLING') && (item.bottleSizeMl || item.servingSize) && (
                        <div className="text-xs text-purple-700">
                          Size: {item.bottleSizeMl ? `${item.bottleSizeMl} ml bottle` : item.servingSize}
                        </div>
                      )}
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
                      {canDeleteItem(orderInfoModal.order, item) && (
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

            <div className="px-5 py-4 border-t bg-gray-50 text-sm">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{Number(orderInfoModal.order.subtotal).toFixed(2)}</span></div>
              <div className="mt-1 flex justify-between text-gray-600"><span>Tax</span><span>₹{Number(orderInfoModal.order.taxAmount).toFixed(2)}</span></div>
              <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 font-bold text-gray-900"><span>Total Amount</span><span>₹{Number(orderInfoModal.order.totalAmount).toFixed(2)}</span></div>
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
          mergedBills={paymentSession.mergedBills}
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
