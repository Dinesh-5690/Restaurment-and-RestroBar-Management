'use client';
import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { getPrintSettings, getPrintSettingsAsync, DEFAULT_PRINT_SETTINGS, PrintSettings, DEFAULT_ELEMENT_ORDER, DEFAULT_ELEMENT_ALIGNMENTS, DEFAULT_ELEMENT_POSITIONS, RECEIPT_HEADER_HEIGHT_PX, ReceiptAlignment } from '@/lib/printSettings';
import { couponsApi } from '@/lib/api';
import { printCommonReceipt } from '@/lib/receiptPrint';

export type PaymentMethod = 'CASH' | 'QR' | 'CARD' | 'SPLIT';

export interface ReceiptAddon {
  id?: string;
  addonName: string;
  quantity?: number;
  unitPrice?: number;
  lineTotal?: number;
}

export interface ReceiptItem {
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes?: string;
  addonSummary?: string;
  addOns?: ReceiptAddon[];
}

export interface MergedBillGroup {
  billLabel: string;
  items: ReceiptItem[];
}

interface Props {
  label: string;
  amount: number;
  orderIds: string[];
  items?: ReceiptItem[];
  billNo?: string;
  mergedBills?: MergedBillGroup[];
  onClose: () => void;
  onComplete: (orderIds: string[], paymentMethod: PaymentMethod, couponCode?: string) => Promise<void>;
}

interface CouponPreview {
  code: string;
  name: string;
  discountAmount: number;
  finalAmount: number;
}

const roundTo05 = (value: number) => {
  return Math.round(value * 20) / 20;
};

const formatCurrency = (value: number) => `₹${value.toFixed(2)}`;

const paymentButtons: Array<{ method: PaymentMethod; label: string }> = [
  { method: 'CASH', label: 'Cash' },
  { method: 'QR', label: 'QR' },
  { method: 'CARD', label: 'Credit / Debit' },
  { method: 'SPLIT', label: 'Split Bill' },
];

const countOptions = [2, 3, 4, 5, 6, 7, 8];

export default function PaymentModal({ label, amount, orderIds, items, billNo, mergedBills, onClose, onComplete }: Props) {
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [splitCount, setSplitCount] = useState<number | null>(null);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [splitDialogCount, setSplitDialogCount] = useState(2);
  const [currentSplit, setCurrentSplit] = useState(1);
  const [inputValue, setInputValue] = useState('');
  const [settling, setSettling] = useState(false);
  const [settled, setSettled] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [printSettings, setPrintSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loaded = await getPrintSettingsAsync({ prefer: 'api' });
        setPrintSettings(loaded);
      } catch (error) {
        console.error('Failed to load printer settings:', error);
        setPrintSettings(getPrintSettings());
      }
    };
    loadSettings();
  }, []);

  const roundedTotal = useMemo(() => roundTo05(amount), [amount]);
  const discountedTotal = useMemo(() => {
    if (!couponPreview) return roundedTotal;
    return roundTo05(couponPreview.finalAmount);
  }, [couponPreview, roundedTotal]);

  const splitAmount = useMemo(() => {
    if (!splitCount) return discountedTotal;
    const base = roundTo05(discountedTotal / splitCount);
    if (currentSplit === splitCount) {
      const rest = discountedTotal - base * (splitCount - 1);
      return roundTo05(rest);
    }
    return base;
  }, [discountedTotal, splitCount, currentSplit]);

  const amountDue = method === 'SPLIT' && splitCount ? splitAmount : discountedTotal;
  const paidValue = Number(inputValue || 0);
  const change = paidValue > amountDue ? roundTo05(paidValue - amountDue) : 0;
  const remaining = paidValue >= amountDue ? 0 : roundTo05(amountDue - paidValue);

  const displayValue = inputValue === '' ? '0.00' : Number(inputValue).toFixed(2);

  const appendKey = (key: string) => {
    if (key === 'C') {
      setInputValue('');
      return;
    }
    if (key === '←') {
      setInputValue((prev) => prev.slice(0, -1));
      return;
    }
    if (key === '.' && inputValue.includes('.')) return;
    if (key === '.' && inputValue === '') {
      setInputValue('0.');
      return;
    }
    if (inputValue === '0' && key !== '.') {
      setInputValue(key);
      return;
    }
    setInputValue((prev) => `${prev}${key}`);
  };

  const handleMethodSelect = (selected: PaymentMethod) => {
    if (selected === 'SPLIT') {
      setSplitDialogCount(splitCount || 2);
      setShowSplitDialog(true);
      return;
    }
    setMethod(selected);
    setSplitCount(null);
    setCurrentSplit(1);
    setInputValue('');
  };

  const startSplit = (count: number) => {
    setMethod('SPLIT');
    setSplitCount(count);
    setCurrentSplit(1);
    setInputValue('');
  };

  const couponAllowed = orderIds.length === 1;

  const applyCoupon = async () => {
    if (!couponAllowed) {
      toast.error('Coupon can only be applied to one bill at a time');
      return;
    }
    if (!couponCode.trim()) {
      toast.error('Enter a coupon code');
      return;
    }

    setApplyingCoupon(true);
    try {
      const res = await couponsApi.validate({
        code: couponCode.trim().toUpperCase(),
        orderAmount: roundedTotal,
      });
      setCouponPreview({
        code: res.data.code,
        name: res.data.name,
        discountAmount: Number(res.data.discountAmount || 0),
        finalAmount: Number(res.data.finalAmount || roundedTotal),
      });
      setCouponCode(res.data.code);
      setInputValue('');
      toast.success(`Coupon applied: ${res.data.code}`);
    } catch (err: any) {
      setCouponPreview(null);
      toast.error(err.response?.data?.message || 'Failed to apply coupon');
    } finally {
      setApplyingCoupon(false);
    }
  };

  const clearCoupon = () => {
    setCouponPreview(null);
    setCouponCode('');
    setInputValue('');
  };

  const handleSaveSplit = () => {
    const count = splitDialogCount;
    if (count < 2 || count > 8) {
      toast.error('Choose between 2 and 8 people');
      return;
    }
    setSplitCount(count);
    setMethod('SPLIT');
    setCurrentSplit(1);
    setInputValue('');
    setShowSplitDialog(false);
  };

  const handlePrint = async (autoClose = false) => {
    let effectivePrintSettings = printSettings;
    try {
      effectivePrintSettings = await getPrintSettingsAsync({ prefer: 'api' });
      setPrintSettings(effectivePrintSettings);
    } catch {
      // Keep currently loaded settings if API fetch fails.
    }

    const mappedItems = receiptItems.map((item) => ({
      menuItemName: item.menuItemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      notes: item.notes,
      addOns: item.addOns?.map((addon) => ({
        addonName: addon.addonName,
        unitPrice: Number(addon.lineTotal ?? addon.unitPrice ?? 0),
      })),
    }));

    const mappedGroups = mergedBills?.map((group) => ({
      billLabel: group.billLabel,
      items: group.items.map((item) => ({
        menuItemName: item.menuItemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        notes: item.notes,
        addOns: item.addOns?.map((addon) => ({
          addonName: addon.addonName,
          unitPrice: Number(addon.lineTotal ?? addon.unitPrice ?? 0),
        })),
      })),
    }));

    const paymentLine = `${paymentMethodLabel.toUpperCase()}${method === 'SPLIT' && splitCount ? ` - ${splitCount}` : ''}`;
    const settlementLine = paidValue >= amountDue && amountDue > 0 ? 'PAID' : 'UNPAID';

    printCommonReceipt({
      billNo: billNo || '-',
      label,
      createdAt: new Date(),
      customerName: undefined,
      paymentMethod: paymentLine,
      settlementStatus: settlementLine,
      subtotal: roundedTotal,
      discountAmount: Number(couponPreview?.discountAmount || 0),
      couponCode: couponPreview?.code,
      netTotal: discountedTotal,
      items: mappedItems,
      groups: mappedGroups,
      printSettings: effectivePrintSettings,
    }, () => {
      if (autoClose) {
        onClose();
      }
    });
  };

  const handleSettle = async () => {
    if (method === 'SPLIT' && !splitCount) {
      toast.error('Choose how many splits');
      return;
    }

    if (paidValue <= 0) {
      toast.error('Enter payment amount');
      return;
    }

    if (paidValue < amountDue) {
      toast.error(`₹${remaining.toFixed(2)} remaining`);
      return;
    }

    if (method === 'SPLIT' && splitCount && currentSplit < splitCount) {
      toast.success(`Share ${currentSplit} settled. ${splitCount - currentSplit} left.`);
      setCurrentSplit(currentSplit + 1);
      setInputValue('');
      return;
    }

    setSettling(true);
    try {
      await onComplete(orderIds, method, couponPreview?.code);
      toast.success('Bill settled');
      // On many Windows touch laptops pointer is coarse, but users still expect desktop print flow.
      const isDesktop = window.matchMedia('(min-width: 769px)').matches;
      if (isDesktop) {
        void handlePrint(true);
      } else {
        setSettled(true);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to settle bill');
    } finally {
      setSettling(false);
    }
  };

  const paymentMethodLabel = method === 'CARD' ? 'Credit / Debit' : method;
  const receiptItems = items ?? (mergedBills ? mergedBills.flatMap((g) => g.items) : []);
  const companyAddressLines = [
    printSettings.addressLine1,
    printSettings.addressLine2,
    [printSettings.city, printSettings.postalCode].filter(Boolean).join(', '),
  ].filter((part) => part && part.trim().length > 0);
  const companyContactLines = [
    printSettings.phone ? `Phone: ${printSettings.phone}` : '',
    printSettings.email,
  ].filter((part) => part && part.trim().length > 0);
  const totalQty = receiptItems.reduce((sum, item) => sum + item.quantity, 0);
  const printedAt = new Date();
  const printedDate = printedAt.toLocaleDateString();
  const printedTime = printedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const renderItemAddons = (item: ReceiptItem) => {
    if (item.addOns && item.addOns.length > 0) {
      return (
        <div className="pl-[34px] mt-0.5 space-y-0.5">
          {item.addOns.map((addon, idx) => {
            const addonTotal = Number(addon.lineTotal ?? ((addon.unitPrice || 0) * (addon.quantity || 1)));
            return (
            <div key={`${item.menuItemName}-addon-${addon.id || idx}`} className="grid grid-cols-[1fr_44px] gap-1 text-[8px] text-gray-700">
              <span>
                + {addon.addonName}
                {addon.quantity && addon.quantity > 1 ? ` x${addon.quantity}` : ''}
              </span>
              <span className="text-right">
                {addonTotal > 0 ? addonTotal.toFixed(2) : 'FREE'}
              </span>
            </div>
            );
          })}
        </div>
      );
    }

    if (item.addonSummary) {
      return <div className="pl-[34px] text-[8px] text-gray-700">+ {item.addonSummary}</div>;
    }

    return null;
  };
  const receiptWidthMm = Number.isFinite(printSettings.receiptWidthMm)
    ? Math.min(120, Math.max(48, printSettings.receiptWidthMm))
    : DEFAULT_PRINT_SETTINGS.receiptWidthMm;
  const previewWidthMm = Math.min(68, receiptWidthMm);
  const headerHeightPx = Math.min(320, Math.max(90, printSettings.headerHeightPx ?? RECEIPT_HEADER_HEIGHT_PX));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start md:items-center justify-center p-2 md:p-4 overflow-y-auto">
      <style jsx global>{`
        .receipt-print-line { border-top: 1px dashed rgba(0, 0, 0, 0.35); margin: 6px 0; }
        .receipt-preview-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .receipt-preview-scroll::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
          }
          body * { visibility: hidden; }
          .receipt-print-area, .receipt-print-area * { visibility: visible; }
          .receipt-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: ${receiptWidthMm}mm;
            max-height: none !important;
            overflow: visible !important;
            padding: 0.35rem;
            background: white;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            margin: 0 !important;
          }
          .receipt-print-area { font-size: 10px; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="w-full max-w-[96vw] lg:max-w-[1020px] max-h-[95vh] overflow-y-auto p-1.5 md:p-2.5">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(540px,620px)_28px_minmax(255px,290px)] gap-1.5 md:gap-2 items-start">
          <div className="rounded-2xl md:rounded-3xl border border-gray-200 bg-white p-1.5 md:p-2">
            <div className="mb-1 md:mb-1.5">
              <div className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-gray-500">Payment counter</div>
              <div className="text-xs md:text-sm font-semibold text-gray-900">{label}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(155px,0.8fr)] gap-1.5 md:gap-2 items-start">
            <div className="space-y-1.5 md:space-y-2">
            <div className="rounded-2xl md:rounded-3xl border border-gray-200 bg-slate-950 text-white p-1.5 md:p-2 text-center">
              <div className="text-xs uppercase text-gray-400 mb-1">Amount due</div>
              <div className="text-xl md:text-2xl font-bold tracking-tight">{formatCurrency(amountDue)}</div>
              {roundedTotal !== amount && (
                <div className="text-xs text-gray-400 mt-1">
                  Rounded from {formatCurrency(amount)}
                </div>
              )}
              {couponPreview && (
                <div className="text-xs text-emerald-300 mt-1">
                  Coupon {couponPreview.code} saved {formatCurrency(couponPreview.discountAmount)}
                </div>
              )}
              {method === 'SPLIT' && splitCount && (
                <div className="mt-2 text-xs text-gray-200">
                  Split {currentSplit} of {splitCount}
                </div>
              )}
            </div>

            <div className="rounded-2xl md:rounded-3xl border border-gray-200 bg-gray-50 p-1.5 md:p-2">
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <div className="text-xs text-gray-500 uppercase">Entered</div>
                  <div className="text-sm md:text-base font-semibold">₹{displayValue}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 uppercase">Change</div>
                  <div className="text-sm md:text-base font-semibold text-green-600">₹{change.toFixed(2)}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1 md:gap-2 text-center">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '←'].map((key) => (
                  <button
                    key={key}
                    onClick={() => appendKey(key)}
                    className="rounded-lg md:rounded-xl border border-gray-200 bg-white py-[7px] md:py-[20px] text-[15px] md:text-xs font-semibold text-gray-900 hover:border-orange-500 hover:text-orange-600"
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-1">
              <button
                onClick={handleSettle}
                disabled={settling || settled}
                className="flex-1 rounded-lg bg-orange-500 px-2 md:px-2.5 py-1.5 md:py-2 text-[11px] md:text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {settled ? 'Bill settled' : method === 'SPLIT' && splitCount && currentSplit < splitCount ? 'Settle share' : 'Settle bill'}
              </button>
              <button
                onClick={() => {
                  setMethod('CASH');
                  setSplitCount(null);
                  setCurrentSplit(1);
                  setInputValue('');
                }}
                    className="rounded-lg border border-gray-200 bg-white px-2 md:px-2.5 py-1.5 md:py-2 text-[11px] md:text-xs font-semibold text-gray-700 hover:bg-gray-100"
              >
                Reset
              </button>
              <button
                onClick={onClose}
                    className="rounded-lg border border-gray-200 bg-white px-2 md:px-2.5 py-1.5 md:py-2 text-[11px] md:text-xs font-semibold text-gray-700 hover:bg-gray-100"
              >
                Close
              </button>
            </div>
            </div>

            <div className="space-y-1.5 md:space-y-2">

            <div className="rounded-2xl md:rounded-3xl border border-gray-200 bg-gray-50 p-1.5 md:p-2">
              <div className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-1">Payment type</div>
              <div className="grid grid-cols-2 md:grid-cols-1 gap-1">
                {paymentButtons.map((button) => (
                  <button
                    key={button.method}
                    onClick={() => handleMethodSelect(button.method)}
                    className={clsx(
                      'rounded-lg px-2 py-1.5 md:py-2 text-center md:text-left text-[11px] md:text-xs font-semibold transition',
                      method === button.method
                        ? 'bg-orange-500 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100',
                    )}
                  >
                    {button.label}
                  </button>
                ))}
              </div>
            </div>

            {method === 'SPLIT' && !splitCount && (
              <div className="rounded-3xl border border-gray-200 bg-gray-50 p-1.5 md:p-2 space-y-1.5">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-1">Split count</div>
                  <div className="grid grid-cols-4 md:grid-cols-3 gap-1">
                    {countOptions.map((count) => (
                      <button
                        key={count}
                        onClick={() => startSplit(count)}
                        className={clsx(
                          'rounded-lg px-2 py-1 text-[11px] md:text-xs font-semibold transition',
                          splitCount === count
                            ? 'bg-orange-500 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100',
                        )}
                      >
                        {count} parts
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            )}

            <div className="rounded-2xl md:rounded-3xl border border-gray-200 bg-gray-50 p-1.5 md:p-2">
              <div className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-1">Coupon</div>
              {!couponAllowed ? (
                <div className="text-xs text-gray-500">Coupons are disabled for merged multi-bill checkout.</div>
              ) : (
                <>
                  <div className="flex gap-1.5">
                    <input
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="Enter code"
                      className="flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold tracking-wide"
                    />
                    <button
                      onClick={applyCoupon}
                      disabled={applyingCoupon}
                      className="rounded-lg bg-emerald-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {applyingCoupon ? 'Applying...' : 'Apply'}
                    </button>
                  </div>
                  {couponPreview ? (
                    <div className="mt-1.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1.5 flex items-center justify-between">
                      <span>{couponPreview.code}: -{formatCurrency(couponPreview.discountAmount)}</span>
                      <button onClick={clearCoupon} className="text-emerald-800 underline">Remove</button>
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] text-gray-500">Apply once before settling payment.</div>
                  )}
                </>
              )}
            </div>

            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-1.5 md:p-2">
              <div className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-1">Summary</div>
              <div className="space-y-1 text-[11px] md:text-xs text-gray-700">
                <div className="flex justify-between"><span>Bill total</span><span>{formatCurrency(roundedTotal)}</span></div>
                {couponPreview && (
                  <div className="flex justify-between"><span>Coupon discount</span><span>-{formatCurrency(couponPreview.discountAmount)}</span></div>
                )}
                <div className="flex justify-between font-semibold"><span>Payable</span><span>{formatCurrency(discountedTotal)}</span></div>
                <div className="flex justify-between"><span>Method</span><span>{paymentMethodLabel}</span></div>
                {method === 'SPLIT' && splitCount && (
                  <div className="flex justify-between">
                    <span>Current share</span>
                    <span>{formatCurrency(splitAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between"><span>Order count</span><span>{orderIds.length}</span></div>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-1.5 md:p-2">
              <div className="flex items-center justify-between gap-1">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Receipt</div>
                  <div className="text-xs font-semibold text-gray-900">Printer-friendly</div>
                </div>
                <button
                  onClick={() => handlePrint(false)}
                  className="rounded-lg bg-black px-2 py-1 text-[11px] md:text-xs font-semibold text-white hover:bg-gray-900"
                >
                  Print
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-1">Thermal printer or browser print.</div>
            </div>
            </div>
            </div>
          </div>

          <div className="hidden lg:block" aria-hidden="true" />

          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-1 md:p-1.5">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-2">Bill preview</div>
            <div
              className="receipt-print-area receipt-preview-scroll max-w-full max-h-[74vh] overflow-y-auto bg-white p-2 font-mono rounded-xl border border-gray-200"
              style={{ width: `${previewWidthMm}mm`, maxWidth: '100%' }}
            >
              <div>
                <div style={{ position: 'relative', height: headerHeightPx }}>
            {(printSettings.elementOrder ?? DEFAULT_ELEMENT_ORDER).map((key) => {
              const pos = (printSettings.elementPositions ?? DEFAULT_ELEMENT_POSITIONS)[key] ?? DEFAULT_ELEMENT_POSITIONS[key];
              const align: ReceiptAlignment = (printSettings.elementAlignments ?? DEFAULT_ELEMENT_ALIGNMENTS)[key] ?? 'center';
              const tc = align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center';
              const xform = align === 'center' ? 'translateX(-50%)' : align === 'right' ? 'translateX(-100%)' : undefined;
              const logoSize = Math.min(120, Math.max(16, printSettings.logoSizePx ?? DEFAULT_PRINT_SETTINGS.logoSizePx));

              let content: JSX.Element | null = null;
              if (key === 'logo') {
                content = printSettings.logoUrl ? (
                  <img src={printSettings.logoUrl} alt="Restaurant logo" style={{ width: logoSize, height: logoSize }} className="object-contain block" />
                ) : null;
              } else if (key === 'name') {
                content = printSettings.name ? (
                  <div className={`text-[13px] font-bold leading-tight whitespace-nowrap ${tc}`}>{printSettings.name}</div>
                ) : null;
              } else if (key === 'address') {
                content = companyAddressLines.length > 0 ? (
                  <div className={tc}>
                    {companyAddressLines.map((line, index) => (
                      <div key={`addr-${index}`} className="text-[8.5px] leading-tight">{line}</div>
                    ))}
                  </div>
                ) : null;
              } else if (key === 'contact') {
                content = companyContactLines.length > 0 ? (
                  <div className={`text-[8.5px] leading-tight ${tc}`}>
                    {companyContactLines.map((line, index) => (
                      <div key={`contact-${index}`}>{line}</div>
                    ))}
                  </div>
                ) : null;
              }
              if (!content) return null;
              return (
                <div
                  key={key}
                  style={{ position: 'absolute', left: `${pos.x}%`, top: `${pos.y}px`, transform: xform }}
                >
                  {content}
                </div>
              );
            })}
                </div>
              </div>

              <div className="receipt-print-line" />

              <div className="text-[9px] space-y-0.5">
                <div className="flex justify-between gap-2 font-semibold">
                  <span>BILL: {billNo || '-'}</span>
                  <span>{label.toUpperCase()}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>DATE: {printedDate}</span>
                  <span>{printedTime}</span>
                </div>
                <div className="font-semibold">CUSTOMER: N/A</div>
                <div className="receipt-print-line" />
              </div>

              <div className="py-1 text-[9px]">
                <div className="grid grid-cols-[26px_1fr_44px_44px] gap-1 border-b border-black/40 pb-1 font-bold">
                  <span>Qty</span>
                  <span>Item Name</span>
                  <span className="text-right">Price</span>
                  <span className="text-right">Amt</span>
                </div>
                {mergedBills && mergedBills.length > 0 ? (
                  mergedBills.map((group, gIdx) => (
                    <div key={gIdx}>
                      <div className="font-bold py-1 mt-1 border-t border-black/30 tracking-wide">{group.billLabel}</div>
                      {group.items.map((item, index) => (
                        <div key={`${group.billLabel}-${item.menuItemName}-${index}`} className="border-b border-dashed border-black/20 py-1">
                          <div className="grid grid-cols-[26px_1fr_44px_44px] gap-1">
                            <span>{item.quantity}x</span>
                            <span className="font-semibold leading-tight">{item.menuItemName}</span>
                            <span className="text-right">{item.unitPrice.toFixed(2)}</span>
                            <span className="text-right font-semibold">{item.lineTotal.toFixed(2)}</span>
                          </div>
                          {renderItemAddons(item)}
                          {item.notes && <div className="pl-[26px] text-[8px] text-gray-700">+ {item.notes}</div>}
                        </div>
                      ))}
                      <div className="flex justify-end text-[8px] text-gray-600 py-0.5">
                        Subtotal: {formatCurrency(group.items.reduce((s, i) => s + i.lineTotal, 0))}
                      </div>
                    </div>
                  ))
                ) : receiptItems.length > 0 ? (
                  receiptItems.map((item, index) => (
                    <div key={`${item.menuItemName}-${index}`} className="border-b border-dashed border-black/20 py-1">
                      <div className="grid grid-cols-[26px_1fr_44px_44px] gap-1">
                        <span>{item.quantity}x</span>
                        <span className="font-semibold leading-tight">{item.menuItemName}</span>
                        <span className="text-right">{item.unitPrice.toFixed(2)}</span>
                        <span className="text-right font-semibold">{item.lineTotal.toFixed(2)}</span>
                      </div>
                      {renderItemAddons(item)}
                      {item.notes && <div className="pl-[26px] text-[8px] text-gray-700">+ {item.notes}</div>}
                    </div>
                  ))
                ) : (
                  <div className="text-[9px] text-gray-700 py-2">No item details available</div>
                )}
              </div>

              <div className="receipt-print-line" />

              <div className="text-[9px]">
                <div className="flex justify-between py-0.5"><span>Tot Qty: {totalQty}</span><span>Subtotal: {formatCurrency(amount)}</span></div>
                {couponPreview && (
                  <div className="flex justify-between py-0.5"><span>Coupon ({couponPreview.code})</span><span>-{formatCurrency(couponPreview.discountAmount)}</span></div>
                )}
                <div className="flex justify-between py-0.5 border-t border-black/20 mt-1 pt-1 font-bold text-[10px]"><span>NET TOTAL</span><span>{formatCurrency(discountedTotal)}</span></div>
                <div className="receipt-print-line" />
                <div className="text-center font-semibold">PAYMENT: {paymentMethodLabel.toUpperCase()}{method === 'SPLIT' && splitCount ? ` - ${splitCount}` : ''}</div>
                <div className="text-center font-semibold">STATUS: {paidValue >= amountDue && amountDue > 0 ? 'PAID' : 'UNPAID'}</div>
                <div className="receipt-print-line" />
                <div className="text-center text-[8px] font-semibold">*** THANK YOU - PLEASE COME AGAIN ***</div>
                <div className="receipt-print-line" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSplitDialog && (
        <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-2 md:p-4">
          <div className="w-full max-w-2xl rounded-2xl md:rounded-3xl bg-white shadow-2xl p-3 md:p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-gray-500">Split bill</div>
                <h2 className="text-lg md:text-xl font-semibold text-gray-900">Split between up to 8 people</h2>
              </div>
              <button onClick={() => setShowSplitDialog(false)} className="p-2 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-2">Choose number of people</div>
                <div className="flex items-center justify-center gap-3 md:gap-4 rounded-2xl md:rounded-3xl border border-gray-200 bg-white p-3 md:p-4">
                  <button
                    onClick={() => setSplitDialogCount((prev) => Math.max(2, prev - 1))}
                    className="h-10 md:h-12 w-10 md:w-12 rounded-full border border-gray-200 bg-white text-base md:text-lg font-bold text-gray-700 hover:bg-gray-100"
                  >
                    −
                  </button>
                    <div className="min-w-[3rem] md:min-w-[4rem] text-center text-2xl md:text-3xl font-semibold text-gray-900">{splitDialogCount}</div>
                  <button
                    onClick={() => setSplitDialogCount((prev) => Math.min(8, prev + 1))}
                      className="h-10 md:h-12 w-10 md:w-12 rounded-full border border-gray-200 bg-white text-base md:text-lg font-bold text-gray-700 hover:bg-gray-100"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex flex-col-reverse md:flex-row gap-2 md:gap-3 justify-end md:justify-end">
                <button
                  onClick={() => setShowSplitDialog(false)}
                  className="rounded-xl md:rounded-2xl border border-gray-200 bg-white px-4 md:px-6 py-2 md:py-3 text-xs md:text-sm font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSplit}
                    className="rounded-xl md:rounded-2xl bg-orange-500 px-4 md:px-6 py-2 md:py-3 text-xs md:text-sm font-semibold text-white hover:bg-orange-600"
                >
                  Save split
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
