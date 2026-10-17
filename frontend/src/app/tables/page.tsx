'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { tablesApi, ordersApi } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import PaymentModal from '@/components/pos/PaymentModal';
import type { MergedBillGroup } from '@/components/pos/PaymentModal';
import { getPrintSettings, getPrintSettingsAsync } from '@/lib/printSettings';
import { buildReceiptPayloadFromOrder, printCommonReceipt } from '@/lib/receiptPrint';
import { usePOSStore } from '@/store/usePOSStore';
import type { Table, Order, OrderItem } from '@/types';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  RefreshCw,
  Users,
  Clock,
  Info,
  X,
  Send,
  GitMerge,
  Plus,
  Printer,
} from 'lucide-react';
import clsx from 'clsx';

const STATUS_COLOR: Record<string, string> = {
  CREATED: 'bg-blue-100 text-blue-700',
  APPROVAL_PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-indigo-100 text-indigo-700',
  COOKING: 'bg-orange-100 text-orange-700',
  READY: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-gray-100 text-gray-500',
  CANCELLED: 'bg-red-100 text-red-600',
};

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableOrdersModal, setTableOrdersModal] = useState<{ table: Table; orders: Order[] } | null>(null);
  const [orderInfoModal, setOrderInfoModal] = useState<{ order: Order; billNo: string } | null>(null);
  const [paymentSession, setPaymentSession] = useState<{ label: string; amount: number; orderIds: string[]; items?: { menuItemName: string; quantity: number; unitPrice: number; lineTotal: number; notes?: string }[]; billNo?: string; mergedBills?: MergedBillGroup[] } | null>(null);

  // Merge bills mode (cross-table)
  const [mergeBillsMode, setMergeBillsMode] = useState(false);
  const [mergeBillsSelected, setMergeBillsSelected] = useState<string[]>([]);
  const [mergeBillPickerTable, setMergeBillPickerTable] = useState<{ table: Table; orders: Order[] } | null>(null);
  const [mergingBills, setMergingBills] = useState(false);

  // Transfer mode
  const [transferMode, setTransferMode] = useState(false);
  const [transferSourceModal, setTransferSourceModal] = useState(false);
  const [transferSourceTable, setTransferSourceTable] = useState<Table | null>(null);
  const [transferDestModal, setTransferDestModal] = useState(false);
  const [transferSourceBill, setTransferSourceBill] = useState<Order | null>(null);
  const [transferring, setTransferring] = useState(false);

  const { setSelectedTable, setSelectedOrderId, setSelectedOrderBillNo, setOrderType } = usePOSStore();
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tablesRes, ordersRes] = await Promise.all([
        tablesApi.list(),
        ordersApi.activeByTable(),
      ]);
      setTables(tablesRes.data);
      setOrders(ordersRes.data);
      return ordersRes.data as Order[];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handleFocus = () => {
      load();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [load]);

  const canDeleteItem = (item: OrderItem) =>
    item.status === 'PENDING' || item.status === 'QUEUED';

  useSocket({
    ORDER_CREATED: () => load(),
    ORDER_FIRED: () => load(),
    ORDER_APPROVED: () => load(),
    ORDER_UPDATED: () => load(),
    ORDER_COMPLETED: () => load(),
    ORDER_CANCELLED: () => load(),
    ITEM_COOKING: () => load(),
    ITEM_READY: () => load(),
    ITEM_SERVED: () => load(),
  } as any, ['pos:all']);

  const ordersByTable: Record<string, Order[]> = {};
  for (const o of orders) {
    if (!o.tableId) continue;
    if (!ordersByTable[o.tableId]) ordersByTable[o.tableId] = [];
    ordersByTable[o.tableId].push(o);
  }

  const getBillNo = (order: Order) => order.billNo ?? `BILL-${order.id.slice(0, 8).toUpperCase()}`;

  const onTableClick = (table: Table, tableOrders: Order[], latestOrder: Order | null) => {
    if (!latestOrder) return;

    if (transferMode) {
      if (!transferSourceBill) {
        setTransferSourceTable(table);
        setTransferSourceModal(true);
      }
      return;
    }

    if (mergeBillsMode) {
      setMergeBillPickerTable({ table, orders: tableOrders });
      return;
    }

    setTableOrdersModal({ table, orders: tableOrders });
  };

  const cancelMergeMode = () => {
    setMergeBillsMode(false);
    setMergeBillsSelected([]);
    setMergeBillPickerTable(null);
  };

  const confirmMerge = async () => {
    if (mergeBillsSelected.length < 2) {
      toast.error('Select at least 2 bills to merge');
      return;
    }

    const destinationOrderId = mergeBillsSelected[mergeBillsSelected.length - 1];
    const sourceOrderIds = mergeBillsSelected.filter((id) => id !== destinationOrderId);
    if (sourceOrderIds.length === 0) {
      toast.error('Choose a different source bill');
      return;
    }

    setMergingBills(true);
    try {
      for (const sourceOrderId of sourceOrderIds) {
        await ordersApi.merge(sourceOrderId, destinationOrderId);
      }

      toast.success('Bills merged successfully');
      cancelMergeMode();
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to merge bills');
    } finally {
      setMergingBills(false);
    }
  };

  const refreshAndSyncModal = async () => {
    const latestOrders = await load();
    if (tableOrdersModal) {
      const updatedOrders = latestOrders.filter((o) => o.tableId === tableOrdersModal.table.id);
      if (updatedOrders.length === 0) {
        setTableOrdersModal(null);
        setOrderInfoModal(null);
        return;
      }
      setTableOrdersModal({ table: tableOrdersModal.table, orders: updatedOrders });
    }

    if (orderInfoModal) {
      const updatedOrder = latestOrders.find((o) => o.id === orderInfoModal.order.id);
      if (updatedOrder) {
        setOrderInfoModal((prev) =>
          prev
            ? {
                ...prev,
                order: {
                  ...updatedOrder,
                  items: updatedOrder.items ?? prev.order.items,
                },
              }
            : prev,
        );
      }
    }
  };

  const deleteOrderItem = async (itemId: string) => {
    if (!confirm('Delete this item?')) return;
    try {
      await ordersApi.deleteItem(itemId);
      toast.success('Item deleted');
      await refreshAndSyncModal();
      if (orderInfoModal) {
        setOrderInfoModal((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            order: {
              ...prev.order,
              items: prev.order.items.filter((item) => item.id !== itemId),
            },
          };
        });
      }
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
      // Fall back to the already-loaded order.
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

  const addItemsToTable = (orderId: string) => {
    if (!tableOrdersModal) return;
    setOrderType('DINE_IN');
    setSelectedTable(tableOrdersModal.table);
    setSelectedOrderId(orderId);
    setTableOrdersModal(null);
    setOrderInfoModal(null);
    router.push('/pos?returnTo=tables');
  };

  const createNewOrderForTable = (table: Table) => {
    setOrderType('DINE_IN');
    setSelectedTable(table);
    setSelectedOrderId(null);
    setSelectedOrderBillNo(null);
    setTableOrdersModal(null);
    setOrderInfoModal(null);
    router.push('/pos?returnTo=tables');
  };

  const transferBill = async (billToTransfer: Order, destTable: Table) => {
    setTransferring(true);
    try {
      await ordersApi.transfer(billToTransfer.id, destTable.id);
      toast.success(`Bill transferred to T${destTable.tableNumber}`);
      setTransferMode(false);
      setTransferSourceModal(false);
      setTransferDestModal(false);
      setTransferSourceTable(null);
      setTransferSourceBill(null);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-4 sticky top-0 z-10">
        <Link href="/" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-bold text-lg text-gray-900">Tables</h1>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
            title="Refresh"
          >
            <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          </button>
          {!transferMode && !mergeBillsMode ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setTableOrdersModal(null);
                  setOrderInfoModal(null);
                  setMergeBillsMode(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors"
              >
                <GitMerge className="w-4 h-4" />
                Merge Bills
              </button>
              <button
                onClick={() => {
                  setTableOrdersModal(null);
                  setOrderInfoModal(null);
                  setTransferMode(true);
                  setTransferSourceModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Send className="w-4 h-4" />
                Transfer Bill
              </button>
            </div>
          ) : mergeBillsMode ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-purple-700 font-medium">
                {mergeBillsSelected.length} bill{mergeBillsSelected.length !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={cancelMergeMode}
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-700 font-medium">Transfer in progress</span>
              <button
                onClick={() => {
                  setTransferMode(false);
                  setTransferSourceTable(null);
                  setTransferSourceBill(null);
                  setTransferSourceModal(false);
                  setTransferDestModal(false);
                }}
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
              >
                <X className="w-4 h-4" /> Cancel Transfer
              </button>
            </div>
          )}
        </div>
      </header>

      {mergeBillsMode && (
        <div className="bg-purple-50 border-b border-purple-100 px-6 py-2 text-center text-sm text-purple-700">
          Click any occupied table to pick bills. Select from multiple tables, then confirm merge.
        </div>
      )}

      {transferMode && (
        <div className="bg-blue-50 border-b border-blue-100 px-6 py-2 text-center text-sm text-blue-700">
          Click on a table to select a bill for transfer. Then choose the destination table.
        </div>
      )}

      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tables.map((table) => {
          const tableOrders = ordersByTable[table.id] || [];
          const isOccupied = tableOrders.length > 0;
          const latestOrder = isOccupied ? tableOrders[tableOrders.length - 1] : null;
          const tableTotal = tableOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

          return (
            <div
              key={table.id}
              onClick={() => onTableClick(table, tableOrders, latestOrder)}
              className={clsx(
                'rounded-2xl border-2 p-4 transition-all select-none border-gray-200',
                isOccupied && !mergeBillsMode ? 'bg-white shadow-sm cursor-pointer hover:border-indigo-400' : '',
                isOccupied && mergeBillsMode ? 'bg-white shadow-sm cursor-pointer hover:border-purple-400' : '',
                !isOccupied ? 'bg-gray-50 border-dashed' : '',
                mergeBillsMode && isOccupied && tableOrders.some((o) => mergeBillsSelected.includes(o.id))
                  ? 'border-purple-500 ring-2 ring-purple-200'
                  : '',
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-gray-900">T{table.tableNumber}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                    <Users className="w-3 h-3" />
                    {table.capacity} pax · {table.location}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      createNewOrderForTable(table);
                    }}
                    disabled={transferMode || mergeBillsMode}
                    className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-[11px] font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Create a fresh bill on this table"
                  >
                    <Plus className="w-3 h-3" /> Add Order
                  </button>

                  {isOccupied ? (
                    <span className={clsx('text-xs px-2 py-1 rounded-lg font-medium', STATUS_COLOR[latestOrder!.status])}>
                      {latestOrder!.status.replace('_', ' ')}
                    </span>
                  ) : (
                    <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg font-medium">
                      FREE
                    </span>
                  )}
                </div>
              </div>

              {tableOrders.length > 1 && (
                <div className="mb-2 text-xs bg-blue-50 text-blue-700 px-2 py-1.5 rounded-lg font-medium">
                  {tableOrders.length} active orders on this table
                </div>
              )}

              {isOccupied ? (
                <>
                  <div className="border-t pt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      {new Date(latestOrder!.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <span className="text-sm font-bold text-gray-900">₹{tableTotal.toFixed(2)}</span>
                  </div>

                  <div className="mt-2 text-xs text-blue-600 font-medium">Tap to view all orders</div>
                </>
              ) : (
                <div className="text-center py-4 text-sm text-gray-300">No order</div>
              )}
            </div>
          );
        })}

        {tables.length === 0 && !loading && (
          <div className="col-span-4 text-center py-20 text-gray-400">
            No tables configured. Add tables from{' '}
            <Link href="/admin/tables" className="text-orange-500 underline">Admin → Tables</Link>.
          </div>
        )}
      </div>

      {tableOrdersModal && (
        <div className="fixed inset-0 bg-black/45 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Table {tableOrdersModal.table.tableNumber}</h3>
                <p className="text-xs text-gray-500">
                  {tableOrdersModal.orders.length} order(s) · Total ₹{tableOrdersModal.orders.reduce((s, o) => s + Number(o.totalAmount), 0).toFixed(2)}
                </p>
              </div>
              <button onClick={() => setTableOrdersModal(null)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto max-h-[70vh]">
              {tableOrdersModal.orders.length === 0 && (
                <div className="text-sm text-gray-400">No active orders on this table.</div>
              )}

              {tableOrdersModal.orders.map((order) => {
                const allItems = order.items;
                const allServed = allItems.every((i) => i.status === 'SERVED');
                const orderTotal = Number(order.totalAmount);

                return (
                  <div key={order.id} className="rounded-xl border border-gray-200 p-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-[165px]">
                        <div className="font-semibold text-gray-900">{getBillNo(order)}</div>
                        <div className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleString()}</div>
                      </div>

                      <div className="text-sm text-gray-600">Items <span className="font-semibold text-gray-900 ml-1">{allItems.length}</span></div>

                      <span className={clsx('text-xs px-2 py-1 rounded-lg font-medium', STATUS_COLOR[order.status])}>
                        {order.status.replace('_', ' ')}
                      </span>

                      <div className="ml-auto text-base font-bold text-gray-900">₹{orderTotal.toFixed(2)}</div>

                      <button
                        onClick={() => printOrder(order)}
                        className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                        title="Print bill"
                      >
                        <Printer className="w-4 h-4 text-gray-700" />
                      </button>

                      <button
                        onClick={() => setOrderInfoModal({ order, billNo: getBillNo(order) })}
                        className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                        title="Order details"
                      >
                        <Info className="w-4 h-4 text-blue-600" />
                      </button>

                      <button
                        onClick={() => addItemsToTable(order.id)}
                        className="px-3 py-2 rounded-lg border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-50"
                      >
                        Add item
                      </button>

                      {allServed && (
                        <button
                          onClick={() => {
                            const currentBillNo = getBillNo(order);
                            const grouped = [...allItems].sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()).reduce<Record<string, {
                              menuItemName: string;
                              quantity: number;
                              unitPrice: number;
                              lineTotal: number;
                              notes?: string;
                              addonSummary?: string;
                              addOns?: any;
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
                              label: `Table ${tableOrdersModal.table.tableNumber}`,
                              amount: orderTotal,
                              orderIds: [order.id],
                              billNo: getBillNo(order),
                              items: groupedEntries.length > 1 ? undefined : groupedEntries[0]?.[1] || [],
                              mergedBills: groupedEntries.length > 1 ? mergedBillGroups : undefined,
                            });
                          }}
                          className="px-3 py-2 bg-green-500 text-white rounded-lg text-xs font-semibold hover:bg-green-600"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Cross-table merge: bill picker modal */}
      {mergeBillsMode && mergeBillPickerTable && (
        <div className="fixed inset-0 bg-black/45 z-[60] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Table {mergeBillPickerTable.table.tableNumber} — Pick Bills</h3>
                <p className="text-xs text-gray-500">Tap a bill to toggle selection for merge</p>
              </div>
              <button onClick={() => setMergeBillPickerTable(null)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-2 overflow-y-auto max-h-[60vh]">
              {mergeBillPickerTable.orders.map((order) => {
                const isSelected = mergeBillsSelected.includes(order.id);
                return (
                  <div
                    key={order.id}
                    onClick={() =>
                      setMergeBillsSelected((prev) =>
                        isSelected ? prev.filter((id) => id !== order.id) : [...prev, order.id],
                      )
                    }
                    className={clsx(
                      'rounded-xl border p-4 cursor-pointer transition-all flex items-center justify-between gap-3',
                      isSelected
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/40',
                    )}
                  >
                    <div>
                      <div className="font-semibold text-gray-900">{getBillNo(order)}</div>
                      <div className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleString()}</div>
                      <div className="text-xs text-gray-600 mt-0.5">Items: {order.items.length}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-bold text-gray-900">₹{Number(order.totalAmount).toFixed(2)}</div>
                      <div className={clsx(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                        isSelected ? 'border-purple-600 bg-purple-600' : 'border-gray-300',
                      )}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-3 border-t bg-gray-50 text-xs text-gray-500 text-center">
              {mergeBillsSelected.length} bill{mergeBillsSelected.length !== 1 ? 's' : ''} selected across all tables · Close to continue picking from other tables
            </div>
          </div>
        </div>
      )}

      {/* Floating confirm merge bar */}
      {mergeBillsMode && mergeBillsSelected.length >= 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-4 bg-purple-700 text-white px-6 py-3 rounded-2xl shadow-xl">
          <span className="text-sm font-semibold">
            {mergeBillsSelected.length} bills selected ·{' '}
            ₹{orders.filter((o) => mergeBillsSelected.includes(o.id)).reduce((s, o) => s + Number(o.totalAmount), 0).toFixed(2)} ·
            Dest: {(() => {
              const destinationOrderId = mergeBillsSelected[mergeBillsSelected.length - 1];
              const destinationOrder = orders.find((o) => o.id === destinationOrderId);
              const table = destinationOrder ? tables.find((t) => t.id === destinationOrder.tableId) : null;
              return destinationOrder ? `T${table?.tableNumber ?? '?'} · ${getBillNo(destinationOrder)}` : '-';
            })()}
          </span>
          <button
            onClick={confirmMerge}
            disabled={mergingBills}
            className="bg-white text-purple-700 font-bold text-sm px-4 py-1.5 rounded-xl hover:bg-purple-50 disabled:opacity-60"
          >
            {mergingBills ? 'Merging...' : 'Merge Bills'}
          </button>
        </div>
      )}

      {orderInfoModal && (
        <div className="fixed inset-0 bg-black/45 z-[60] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[80vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between">
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
                  onClick={() => addItemsToTable(orderInfoModal.order.id)}
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
              {orderInfoModal.order.items.map((item) => (
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

      {paymentSession && (
        <PaymentModal
          label={paymentSession.label}
          amount={paymentSession.amount}
          orderIds={paymentSession.orderIds}
          items={paymentSession.items}
          billNo={paymentSession.billNo}
          mergedBills={paymentSession.mergedBills}
          onClose={() => setPaymentSession(null)}
          onComplete={async (orderIds, paymentMethod, couponCode) => {
            try {
              await Promise.all(orderIds.map((id) => ordersApi.complete(id, {
                paymentMethod,
                couponCode,
              })));
              toast.success('Bill completed');
              await refreshAndSyncModal();
            } catch (err: any) {
              toast.error(err.response?.data?.message || 'Failed to complete bill');
            } finally {
              setPaymentSession(null);
            }
          }}
        />
      )}

      {transferSourceModal && transferSourceTable && (
        <div className="fixed inset-0 bg-black/45 z-[60] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Select Bill to Transfer</h3>
                <p className="text-xs text-gray-500">Table {transferSourceTable.tableNumber}</p>
              </div>
              <button onClick={() => { setTransferSourceModal(false); setTransferSourceTable(null); }} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-2 overflow-y-auto max-h-[60vh]">
              {(ordersByTable[transferSourceTable.id] || []).map((order) => (
                <div
                  key={order.id}
                  onClick={() => {
                    setTransferSourceBill(order);
                    setTransferSourceModal(false);
                    setTransferDestModal(true);
                  }}
                  className="rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">{getBillNo(order)}</div>
                      <div className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleString()}</div>
                      <div className="text-xs text-gray-600 mt-1">Items: {order.items.length}</div>
                    </div>
                    <div className="text-right">
                      <div className={clsx('text-xs px-2 py-1 rounded-lg font-medium', STATUS_COLOR[order.status])}>
                        {order.status.replace('_', ' ')}
                      </div>
                      <div className="text-sm font-bold text-gray-900 mt-2">₹{Number(order.totalAmount).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {transferDestModal && transferSourceBill && (
        <div className="fixed inset-0 bg-black/45 z-[60] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Transfer to Table</h3>
                <p className="text-xs text-gray-500">₹{Number(transferSourceBill.totalAmount).toFixed(2)}</p>
              </div>
              <button onClick={() => { setTransferDestModal(false); setTransferSourceBill(null); }} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-2 overflow-y-auto max-h-[60vh]">
              {tables
                .filter((t) => t.id !== transferSourceBill.tableId)
                .map((table) => (
                  <div
                    key={table.id}
                    onClick={() => !transferring && transferBill(transferSourceBill, table)}
                    className={clsx(
                      'rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all',
                      transferring && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">Table {table.tableNumber}</div>
                        <div className="text-xs text-gray-500">{table.capacity} pax · {table.location}</div>
                      </div>
                      {transferring ? (
                        <div className="text-xs text-gray-600">Transferring...</div>
                      ) : (
                        <Send className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
