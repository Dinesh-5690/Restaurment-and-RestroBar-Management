import {
  DEFAULT_ELEMENT_ALIGNMENTS,
  DEFAULT_ELEMENT_ORDER,
  DEFAULT_ELEMENT_POSITIONS,
  DEFAULT_PRINT_SETTINGS,
  PrintSettings,
  RECEIPT_HEADER_HEIGHT_PX,
} from '@/lib/printSettings';
import type { Order } from '@/types';

export interface ReceiptPrintAddon {
  addonName: string;
  unitPrice?: number;
}

export interface ReceiptPrintItem {
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes?: string;
  addOns?: ReceiptPrintAddon[];
}

export interface ReceiptPrintGroup {
  billLabel: string;
  items: ReceiptPrintItem[];
}

export interface ReceiptPrintPayload {
  billNo: string;
  label: string;
  createdAt: Date;
  customerName?: string;
  paymentMethod: string;
  settlementStatus: string;
  subtotal: number;
  discountAmount: number;
  couponCode?: string;
  netTotal: number;
  items: ReceiptPrintItem[];
  groups?: ReceiptPrintGroup[];
  printSettings: PrintSettings;
}

interface BuildReceiptPayloadFromOrderOptions {
  printSettings: PrintSettings;
  label?: string;
  paymentMethod?: string;
  settlementStatus?: string;
  subtotal?: number;
  netTotal?: number;
  createdAt?: Date;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatCurrency = (value: number) => `\u20B9${Number(value || 0).toFixed(2)}`;

export function buildReceiptPayloadFromOrder(order: Order, options: BuildReceiptPayloadFromOrderOptions): ReceiptPrintPayload {
  const billNo = order.billNo ?? `BILL-${order.id.slice(0, 8).toUpperCase()}`;
  const orderedItems = [...(order.items || [])].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : Number.POSITIVE_INFINITY;
    if (aTime !== bTime) return aTime - bTime;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });

  const mappedItems: ReceiptPrintItem[] = orderedItems.map((item) => ({
    menuItemName: item.menuItemName,
    quantity: Number(item.quantity || 0),
    unitPrice: Number(item.unitPrice || 0),
    lineTotal: Number(item.lineTotal || 0),
    notes: item.notes,
    addOns: [...(item.addOns || [])]
      .sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')))
      .map((addon) => ({
      addonName: addon.addonName,
      unitPrice: Number(addon.lineTotal ?? addon.unitPrice ?? 0),
      })),
  }));

  const grossAmount = Number(order.grossAmount ?? Number(order.subtotal || 0) + Number(order.taxAmount || 0));

  return {
    billNo,
    label:
      options.label ??
      (order.orderType === 'DINE_IN' ? `TABLE ${order.tableNumber ?? ''}`.trim() : order.orderType),
    createdAt: options.createdAt ?? new Date(order.createdAt),
    customerName: order.customerName,
    paymentMethod: options.paymentMethod ?? order.paymentMethod ?? 'UNKNOWN',
    settlementStatus: options.settlementStatus ?? order.settlementStatus ?? 'UNPAID',
    subtotal: Number(options.subtotal ?? grossAmount),
    discountAmount: Number(order.discountAmount || 0),
    couponCode: order.couponCode || undefined,
    netTotal: Number(options.netTotal ?? order.totalAmount ?? 0),
    items: mappedItems,
    printSettings: options.printSettings,
  };
}

export function buildReceiptHtml(payload: ReceiptPrintPayload): string {
  const settings = {
    ...DEFAULT_PRINT_SETTINGS,
    ...payload.printSettings,
    elementOrder: payload.printSettings.elementOrder ?? DEFAULT_ELEMENT_ORDER,
    elementAlignments: {
      ...DEFAULT_ELEMENT_ALIGNMENTS,
      ...(payload.printSettings.elementAlignments ?? {}),
    },
    elementPositions: {
      ...DEFAULT_ELEMENT_POSITIONS,
      ...(payload.printSettings.elementPositions ?? {}),
    },
  };

  const receiptWidthMm = Number.isFinite(settings.receiptWidthMm)
    ? Math.min(120, Math.max(48, settings.receiptWidthMm))
    : DEFAULT_PRINT_SETTINGS.receiptWidthMm;
  const previewWidthMm = Math.min(68, receiptWidthMm);
  const logoSize = Math.min(120, Math.max(16, settings.logoSizePx ?? DEFAULT_PRINT_SETTINGS.logoSizePx));
  const headerHeightPx = Math.min(320, Math.max(90, settings.headerHeightPx ?? RECEIPT_HEADER_HEIGHT_PX));

  const companyAddressLines = [
    settings.addressLine1,
    settings.addressLine2,
    [settings.city, settings.postalCode].filter(Boolean).join(', '),
  ].filter((line) => line && line.trim().length > 0);

  const companyContactLines = [
    settings.phone ? `Phone: ${settings.phone}` : '',
    settings.email,
  ].filter((line) => line && line.trim().length > 0);

  const headerElementsHtml = (settings.elementOrder ?? DEFAULT_ELEMENT_ORDER)
    .map((key) => {
      const pos = settings.elementPositions[key] ?? DEFAULT_ELEMENT_POSITIONS[key];
      const align = settings.elementAlignments[key] ?? 'center';
      const textAlign = align === 'left' ? 'left' : align === 'right' ? 'right' : 'center';
      const transform = align === 'center' ? 'translateX(-50%)' : align === 'right' ? 'translateX(-100%)' : 'none';

      let content = '';
      if (key === 'logo') {
        content = settings.logoUrl
          ? `<img src="${escapeHtml(settings.logoUrl)}" alt="Restaurant logo" style="width:${logoSize}px;height:${logoSize}px;object-fit:contain;display:block;" />`
          : '';
      } else if (key === 'name') {
        content = settings.name ? `<div class="header-name">${escapeHtml(settings.name)}</div>` : '';
      } else if (key === 'address') {
        content = companyAddressLines.length > 0
          ? `<div class="header-meta">${companyAddressLines.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}</div>`
          : '';
      } else if (key === 'contact') {
        content = companyContactLines.length > 0
          ? `<div class="header-meta">${companyContactLines.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}</div>`
          : '';
      }

      if (!content) return '';
      return `<div class="header-el" style="left:${pos.x}%;top:${pos.y}px;transform:${transform};text-align:${textAlign};">${content}</div>`;
    })
    .join('');

  const itemRowHtml = (item: ReceiptPrintItem) => {
    const addOns = item.addOns && item.addOns.length > 0
      ? `<div class="addons">${item.addOns
          .map(
            (addon) =>
              `<div class="addon-line"><span>+ ${escapeHtml(addon.addonName)}</span><span class="right">${Number(addon.unitPrice || 0) > 0 ? formatCurrency(Number(addon.unitPrice || 0)) : 'FREE'}</span></div>`,
          )
          .join('')}</div>`
      : '';

    const note = item.notes
      ? `<div class="addon-line"><span>+ ${escapeHtml(item.notes)}</span><span></span></div>`
      : '';

    return `
      <div class="item-row">
        <div class="item-main">
          <span>${item.quantity}x</span>
          <span>${escapeHtml(item.menuItemName)}</span>
          <span class="right">${Number(item.unitPrice || 0).toFixed(2)}</span>
          <span class="right amount">${Number(item.lineTotal || 0).toFixed(2)}</span>
        </div>
        ${addOns}${note ? `<div class="addons">${note}</div>` : ''}
      </div>
    `;
  };

  const itemsHtml = payload.groups && payload.groups.length > 0
    ? payload.groups
        .map((group) => {
          const groupSubtotal = group.items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
          return `
            <div class="group-label">${escapeHtml(group.billLabel)}</div>
            ${group.items.map(itemRowHtml).join('')}
            <div class="group-subtotal">Subtotal: ${formatCurrency(groupSubtotal)}</div>
          `;
        })
        .join('')
    : payload.items.map(itemRowHtml).join('');

  const totalQty = payload.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const couponLine = payload.discountAmount > 0
    ? `<div class="line"><span>Coupon${payload.couponCode ? ` (${escapeHtml(payload.couponCode)})` : ''}</span><span>-${formatCurrency(payload.discountAmount)}</span></div>`
    : '';

  const customerText = payload.customerName?.trim() ? payload.customerName.trim() : 'N/A';

  return `
    <html>
      <head>
        <title>${escapeHtml(payload.billNo)}</title>
        <style>
          .receipt-print-line { border-top: 1px dashed rgba(0, 0, 0, 0.35); margin: 6px 0; }
          body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; margin: 0; padding: 0.5rem; color: #111827; }
          .receipt {
            width: ${previewWidthMm}mm;
            max-width: 100%;
            max-height: 74vh;
            overflow-y: auto;
            background: white;
            padding: 0.5rem;
            border: 1px solid #e5e7eb;
            border-radius: 0.75rem;
            margin: 0;
            font-size: 10px;
          }
          .center { text-align: center; }
          .header-area { position: relative; height: ${headerHeightPx}px; }
          .header-el { position: absolute; }
          .header-name { font-size: 13px; font-weight: 700; line-height: 1.1; white-space: nowrap; }
          .header-meta { font-size: 8.5px; line-height: 1.2; }
          .line { display: flex; justify-content: space-between; font-size: 9px; margin: 0; }
          .line-strong { font-weight: 700; }
          .table-head { display: grid; grid-template-columns: 26px 1fr 44px 44px; gap: 4px; border-bottom: 1px solid rgba(0, 0, 0, 0.4); font-weight: 700; font-size: 9px; padding-bottom: 4px; }
          .item-row { border-bottom: 1px dashed rgba(0, 0, 0, 0.2); padding: 4px 0; }
          .item-main { display: grid; grid-template-columns: 26px 1fr 44px 44px; gap: 4px; font-size: 9px; }
          .group-label { font-size: 9px; font-weight: 700; padding: 4px 0; margin-top: 4px; border-top: 1px solid rgba(0, 0, 0, 0.3); }
          .group-subtotal { font-size: 8px; color: #4b5563; text-align: right; padding-top: 2px; }
          .right { text-align: right; }
          .amount { font-weight: 700; }
          .addons { margin-top: 2px; margin-left: 26px; font-size: 8px; color: #374151; }
          .addon-line { display: grid; grid-template-columns: 1fr 44px; gap: 4px; }
          .net { font-weight: 700; font-size: 10px; border-top: 1px solid rgba(0, 0, 0, 0.2); margin-top: 4px; padding-top: 4px; }
          @media print {
            @page {
              margin: 0;
              size: auto;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
            }
            .receipt {
              position: absolute;
              left: 0;
              top: 0;
              max-height: none !important;
              overflow: visible !important;
              padding: 0.35rem;
              background: white;
              border: 0;
              border-radius: 0;
              width: ${previewWidthMm}mm;
              margin: 0;
              box-shadow: none !important;
              font-size: 10px;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header-area">${headerElementsHtml}</div>
          <div class="receipt-print-line"></div>
          <div class="line line-strong"><span>BILL: ${escapeHtml(payload.billNo)}</span><span>${escapeHtml(payload.label.toUpperCase())}</span></div>
          <div class="line"><span>DATE: ${payload.createdAt.toLocaleDateString()}</span><span>${payload.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
          <div class="line line-strong"><span>CUSTOMER: ${escapeHtml(customerText)}</span><span></span></div>
          <div class="receipt-print-line"></div>
          <div class="table-head">
            <span>Qty</span><span>Item Name</span><span class="right">Price</span><span class="right">Amt</span>
          </div>
          ${itemsHtml || '<div class="center" style="font-size:9px;color:#6b7280;padding:8px 0;">No item details available</div>'}
          <div class="receipt-print-line"></div>
          <div class="line"><span>Tot Qty: ${totalQty}</span><span>Subtotal: ${formatCurrency(payload.subtotal)}</span></div>
          ${couponLine}
          <div class="line net"><span>NET TOTAL</span><span>${formatCurrency(payload.netTotal)}</span></div>
          <div class="receipt-print-line"></div>
          <div class="center" style="font-size:10px; font-weight:600;">PAYMENT: ${escapeHtml(payload.paymentMethod)}</div>
          <div class="center" style="font-size:10px; font-weight:600;">STATUS: ${escapeHtml(payload.settlementStatus)}</div>
          <div class="receipt-print-line"></div>
          <div class="center" style="font-size:9px; font-weight:600;">*** THANK YOU - PLEASE COME AGAIN ***</div>
          <div class="receipt-print-line"></div>
        </div>
      </body>
    </html>
  `;
}

export function printReceiptHtml(html: string, onAfterPrint?: () => void) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const frameDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!frameDoc) {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
    onAfterPrint?.();
    return;
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  const cleanUp = () => {
    setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
      onAfterPrint?.();
    }, 500);
  };

  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    cleanUp();
  };
}

export function printCommonReceipt(payload: ReceiptPrintPayload, onAfterPrint?: () => void) {
  const html = buildReceiptHtml(payload);
  printReceiptHtml(html, onAfterPrint);
}
