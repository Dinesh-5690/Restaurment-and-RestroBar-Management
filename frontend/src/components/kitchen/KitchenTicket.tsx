'use client';
import { useEffect, useState } from 'react';
import { KitchenBatch } from '@/types';
import { kitchenApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Flame, CheckCircle, Clock, Printer } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  batch: KitchenBatch;
  onUpdate: () => void;
  stationFilter?: string;
}

const pad = (value: number) => String(value).padStart(2, '0');

const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
};

export default function KitchenTicket({ batch, onUpdate, stationFilter }: Props) {
  const [now, setNow] = useState(Date.now());
  const [bulkUpdating, setBulkUpdating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const visibleItems = (stationFilter
    ? batch.batchItems.filter(
        (i) => i.kitchenStation?.toUpperCase() === stationFilter.toUpperCase(),
      )
    : batch.batchItems).filter((i) => i.orderItemStatus !== 'SERVED');

  const referenceTime = batch.firedAt || batch.createdAt;
  const elapsed = referenceTime ? formatDuration(now - new Date(referenceTime).getTime()) : '00:00';
  const stateLabel = batch.firedAt ? 'In kitchen' : 'Waiting';

  const actionableItems = batch.batchItems.filter((i) => i.orderItemStatus !== 'SERVED');
  const hasQueued = actionableItems.some((i) => (i.orderItemStatus || 'QUEUED') === 'QUEUED');
  const hasCooking = actionableItems.some((i) => i.orderItemStatus === 'COOKING');
  const hasReady = actionableItems.some((i) => i.orderItemStatus === 'READY');

  const bulkLabel = hasQueued ? 'Cook' : hasCooking ? 'Ready' : hasReady ? 'Served' : 'Done';

  const bulkButtonClass =
    bulkLabel === 'Cook'
      ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
      : bulkLabel === 'Ready'
        ? 'bg-green-100 hover:bg-green-200 text-green-700'
        : bulkLabel === 'Served'
          ? 'bg-blue-100 hover:bg-blue-200 text-blue-700'
          : 'bg-gray-100 text-gray-500';

  const handlePrint = () => {
    document.body.classList.add('printing-kitchen-ticket');
    document.body.setAttribute('data-print-batch-id', batch.id);
    window.print();
  };

  useEffect(() => {
    const cleanupPrintFlags = () => {
      document.body.classList.remove('printing-kitchen-ticket');
      document.body.removeAttribute('data-print-batch-id');
    };

    window.addEventListener('afterprint', cleanupPrintFlags);
    return () => {
      window.removeEventListener('afterprint', cleanupPrintFlags);
      cleanupPrintFlags();
    };
  }, []);

  const handleBulkAdvance = async () => {
    if (bulkLabel === 'Done' || bulkUpdating) return;

    const targetItems = actionableItems.filter((item) => {
      const status = item.orderItemStatus || 'QUEUED';
      if (bulkLabel === 'Cook') return status === 'QUEUED';
      if (bulkLabel === 'Ready') return status === 'COOKING';
      return status === 'READY';
    });

    if (targetItems.length === 0) return;

    setBulkUpdating(true);
    try {
      if (bulkLabel === 'Cook') {
        await Promise.all(targetItems.map((item) => kitchenApi.markCooking(item.orderItemId)));
      } else if (bulkLabel === 'Ready') {
        await Promise.all(targetItems.map((item) => kitchenApi.markReady(item.orderItemId)));
      } else {
        await Promise.all(targetItems.map((item) => kitchenApi.markServed(item.orderItemId)));
      }

      toast.success(`Marked ${targetItems.length} item${targetItems.length > 1 ? 's' : ''} as ${bulkLabel.toUpperCase()}`);
      onUpdate();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error');
    } finally {
      setBulkUpdating(false);
    }
  };

  if (visibleItems.length === 0) return null;

  return (
    <>
      <style>{`
        .kitchen-receipt-line { border-top: 1px dashed rgba(0, 0, 0, 0.35); margin: 6px 0; }

        @media print {
          @page {
            margin: 0;
            size: 58mm auto;
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }

          body.printing-kitchen-ticket * {
            visibility: hidden !important;
          }

          body.printing-kitchen-ticket[data-print-batch-id='${batch.id}'] .kitchen-ticket-print-only[data-batch-id='${batch.id}'],
          body.printing-kitchen-ticket[data-print-batch-id='${batch.id}'] .kitchen-ticket-print-only[data-batch-id='${batch.id}'] * {
            visibility: visible !important;
          }

          body.printing-kitchen-ticket[data-print-batch-id='${batch.id}'] .kitchen-ticket-print-only[data-batch-id='${batch.id}'] {
            display: block !important;
            position: absolute;
            left: 5px;
            top: 5px;
            width: 58mm;
            margin: 0;
            padding: 0;
            background: #fff;
            z-index: 999999;
            font-size: 10px;
          }

          body.printing-kitchen-ticket .kitchen-ticket-print {
            display: none !important;
          }
        }

        .kitchen-ticket-print-only { display: none; }
      `}</style>
      
      <div className={clsx(
        'card p-3 border-l-4 kitchen-ticket-print',
        batch.status === 'FIRED' ? 'border-l-orange-400' : 'border-l-green-400',
      )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="font-semibold text-sm text-gray-900">
            {batch.orderBillNo ? `Bill ${batch.orderBillNo}` : `Order #${batch.orderId.slice(0, 6)}`} · Batch {batch.batchNumber}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <div className="text-[11px] text-gray-600 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {stateLabel}
            </div>
            <span className="inline-flex items-center rounded-full bg-orange-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">
              {elapsed}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={clsx(
            'badge text-[11px] py-1 px-2',
            batch.status === 'FIRED' ? 'badge-orange' : 'badge-green',
          )}>
            {batch.status}
          </span>
          <div className="flex gap-1">
            <button
              onClick={handlePrint}
              className="mt-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1"
              title="Print kitchen ticket"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleBulkAdvance}
              disabled={bulkLabel === 'Done' || bulkUpdating}
              className={clsx(
                'mt-1 px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed',
                bulkButtonClass,
              )}
              title={`Mark all as ${bulkLabel}`}
            >
              {bulkUpdating ? (
                '...'
              ) : bulkLabel === 'Cook' ? (
                <Flame className="w-3.5 h-3.5" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5" />
              )}
              {bulkUpdating ? '' : bulkLabel}
            </button>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-1.5">
        {visibleItems.map((item) => {
          const status = item.orderItemStatus || 'QUEUED';

          const handleAdvance = async () => {
            try {
              if (status === 'QUEUED') {
                await kitchenApi.markCooking(item.orderItemId);
                toast.success('Moved to COOKING');
              } else if (status === 'COOKING') {
                await kitchenApi.markReady(item.orderItemId);
                toast.success('Moved to READY');
              } else if (status === 'READY') {
                await kitchenApi.markServed(item.orderItemId);
                toast.success('Moved to SERVED');
              }
              onUpdate();
            } catch (e: any) {
              toast.error(e.response?.data?.message || 'Error');
            }
          };

          const label =
            status === 'QUEUED'
              ? 'Cook'
              : status === 'COOKING'
                ? 'Ready'
                : status === 'READY'
                  ? 'Served'
                  : 'Done';

          const btnClass =
            status === 'QUEUED'
              ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
              : status === 'COOKING'
                ? 'bg-green-100 hover:bg-green-200 text-green-700'
                : 'bg-blue-100 hover:bg-blue-200 text-blue-700';

          return (
            <div
              key={item.id}
              className="flex items-center justify-between p-2 rounded-lg border bg-white"
            >
              <div>
                <div className="font-medium text-sm text-gray-900">{item.menuItemName}</div>
                <div className="text-[11px] text-gray-400">
                  Qty: {item.quantity}
                  {item.notes && ` · ${item.notes}`}
                </div>
                {item.addOns && item.addOns.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {item.addOns.map((addon) => (
                      <span key={addon.id} className="text-[9px] bg-orange-50 text-orange-700 border border-orange-200 rounded px-1.5 py-0.5">
                        +{addon.addonName} {Number(addon.unitPrice) > 0 ? `₹${Number(addon.unitPrice).toFixed(2)}` : '(free)'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-medium text-gray-500">{status}</span>
                <button
                  onClick={handleAdvance}
                  className={clsx('px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1', btnClass)}
                  title={`Mark ${label}`}
                >
                  {status === 'QUEUED' ? <Flame className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  {label}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>

      {/* Print Template - Bill Preview Style (Kitchen Fields Only) */}
      <div className="kitchen-ticket-print-only text-[12px] text-black" data-batch-id={batch.id} style={{ fontFamily: 'monospace', lineHeight: '1.4' }}>
        <div className="mb-1.5">
          <div className="text-[14px] font-bold leading-tight">
            {batch.orderBillNo ? `Bill ${batch.orderBillNo}` : `Order #${batch.orderId.slice(0, 6)}`}
          </div>
          <div className="text-[12px] leading-tight">
            {new Date(batch.firedAt || batch.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-[12px] leading-tight">
            Table No: {batch.tableNumber != null ? batch.tableNumber : 'N/A'}
          </div>
        </div>

        <div className="kitchen-receipt-line" />

        <div className="space-y-1">
          {visibleItems.map((item) => (
            <div key={item.id} className="space-y-0.5">
              <div className="grid grid-cols-[1fr_42px] gap-1 text-[12px]">
                <span className="font-semibold">{item.menuItemName}</span>
                <span className="text-right text-[18px] font-extrabold leading-none">x{item.quantity}</span>
              </div>
              {item.addOns && item.addOns.length > 0 && (
                <div className="pl-[10px] space-y-0.5">
                  {item.addOns.map((addon, idx) => (
                    <div key={idx} className="text-[10px] leading-tight">
                      + {addon.addonName}
                      {addon.quantity && addon.quantity > 1 ? ` x${addon.quantity}` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="kitchen-receipt-line" />
      </div>
    </>
  );
}
