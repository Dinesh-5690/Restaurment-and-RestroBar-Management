'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { AlignCenter, AlignLeft, AlignRight, ArrowLeft, GripVertical, Image, Settings } from 'lucide-react';
import { getPrintSettings, savePrintSettings, getPrintSettingsAsync, PrintSettings, DEFAULT_PRINT_SETTINGS, DEFAULT_ELEMENT_ORDER, DEFAULT_ELEMENT_ALIGNMENTS, DEFAULT_ELEMENT_POSITIONS, RECEIPT_HEADER_HEIGHT_PX, ReceiptElementKey, ReceiptAlignment } from '@/lib/printSettings';

const ELEMENT_LABELS: Record<ReceiptElementKey, string> = {
  logo: 'Logo',
  name: 'Restaurant Name',
  address: 'Address',
  contact: 'Phone & Email',
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loaded = await getPrintSettingsAsync();
        setSettings(loaded);
      } catch (error) {
        console.error('Failed to load printer settings:', error);
        setSettings(getPrintSettings());
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const updateField = (key: keyof PrintSettings, value: string | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateAlignment = (element: ReceiptElementKey, align: ReceiptAlignment) => {
    setSettings((prev) => ({
      ...prev,
      elementAlignments: {
        ...(prev.elementAlignments ?? DEFAULT_ELEMENT_ALIGNMENTS),
        [element]: align,
      },
    }));
  };

  const receiptWidthMm = Number.isFinite(settings.receiptWidthMm)
    ? Math.min(120, Math.max(48, settings.receiptWidthMm))
    : DEFAULT_PRINT_SETTINGS.receiptWidthMm;

  const elementOrder: ReceiptElementKey[] = settings.elementOrder?.length === 4
    ? settings.elementOrder
    : DEFAULT_ELEMENT_ORDER;

  const logoSizePx = Math.min(120, Math.max(16, settings.logoSizePx ?? DEFAULT_PRINT_SETTINGS.logoSizePx));
  const headerHeightPx = Math.min(320, Math.max(90, settings.headerHeightPx ?? RECEIPT_HEADER_HEIGHT_PX));

  const getAlign = (key: ReceiptElementKey): ReceiptAlignment =>
    (settings.elementAlignments ?? DEFAULT_ELEMENT_ALIGNMENTS)[key] ?? 'center';

  const textAlignClass = (align: ReceiptAlignment) =>
    align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center';

  const previewAddressLines = [
    settings.addressLine1,
    settings.addressLine2,
    [settings.city, settings.postalCode].filter(Boolean).join(', '),
  ].filter((part) => part && part.trim().length > 0);
  const previewContactLines = [
    settings.phone ? `Phone: ${settings.phone}` : '',
    settings.email,
  ].filter((part) => part && part.trim().length > 0);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingEl, setDraggingEl] = useState<ReceiptElementKey | null>(null);
  const draggingElRef = useRef<ReceiptElementKey | null>(null);
  const dragStartMouse = useRef({ x: 0, y: 0 });
  const dragStartPos = useRef({ x: 0, y: 0 });

  const handleElMouseDown = (e: React.MouseEvent, key: ReceiptElementKey) => {
    e.preventDefault();
    const pos = (settings.elementPositions ?? DEFAULT_ELEMENT_POSITIONS)[key] ?? DEFAULT_ELEMENT_POSITIONS[key];
    dragStartMouse.current = { x: e.clientX, y: e.clientY };
    dragStartPos.current = { x: pos.x, y: pos.y };
    draggingElRef.current = key;
    setDraggingEl(key);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const key = draggingElRef.current;
      if (!key) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dx = ((e.clientX - dragStartMouse.current.x) / rect.width) * 100;
      const dy = e.clientY - dragStartMouse.current.y;
      const newX = Math.max(0, Math.min(97, dragStartPos.current.x + dx));
      const newY = Math.max(0, Math.min(Math.max(0, rect.height - 12), dragStartPos.current.y + dy));
      setSettings((prev) => ({
        ...prev,
        elementPositions: {
          ...(prev.elementPositions ?? DEFAULT_ELEMENT_POSITIONS),
          [key]: { x: newX, y: newY },
        },
      }));
    };
    const onUp = () => { draggingElRef.current = null; setDraggingEl(null); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await savePrintSettings(settings);
      toast.success('Print settings saved');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        toast.error('Failed to read image file');
        return;
      }
      updateField('logoUrl', reader.result);
      toast.success('Logo uploaded. Save settings to apply.');
    };
    reader.onerror = () => toast.error('Failed to upload logo');
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to Admin
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Print Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Enter the details that appear on printed receipts.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-semibold text-gray-900">Restaurant information</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-gray-700">
                <span>Restaurant name</span>
                <input
                  value={settings.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-orange-500"
                  placeholder="Enter restaurant name"
                />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                <span>Upload logo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500"
                />
                <p className="text-xs text-gray-500">Choose image file from your device</p>
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                <span>Logo URL (optional)</span>
                <input
                  value={settings.logoUrl}
                  onChange={(e) => updateField('logoUrl', e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-orange-500"
                  placeholder="https://example.com/logo.png"
                />
              </label>
            </div>

            <div className="grid gap-4">
              <label className="space-y-2 text-sm text-gray-700">
                <span>Address line 1</span>
                <input
                  value={settings.addressLine1}
                  onChange={(e) => updateField('addressLine1', e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-orange-500"
                  placeholder="123 Main Street"
                />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                <span>Address line 2</span>
                <input
                  value={settings.addressLine2}
                  onChange={(e) => updateField('addressLine2', e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-orange-500"
                  placeholder="Suite, landmark, or district"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-gray-700">
                <span>City</span>
                <input
                  value={settings.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-orange-500"
                  placeholder="City"
                />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                <span>Postal code</span>
                <input
                  value={settings.postalCode}
                  onChange={(e) => updateField('postalCode', e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-orange-500"
                  placeholder="Postal code"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-gray-700">
                <span>Phone</span>
                <input
                  value={settings.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-orange-500"
                  placeholder="Phone number"
                />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                <span>Email</span>
                <input
                  value={settings.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-orange-500"
                  placeholder="Email address"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-gray-700">
                <span>Receipt width (mm)</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateField('receiptWidthMm', Math.max(48, receiptWidthMm - 2))}
                    className="h-11 w-11 rounded-xl border border-gray-200 bg-white text-lg font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={48}
                    max={120}
                    value={receiptWidthMm}
                    onChange={(e) => updateField('receiptWidthMm', Math.min(120, Math.max(48, Number(e.target.value) || 48)))}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-orange-500"
                    placeholder="e.g. 80"
                  />
                  <button
                    type="button"
                    onClick={() => updateField('receiptWidthMm', Math.min(120, receiptWidthMm + 2))}
                    className="h-11 w-11 rounded-xl border border-gray-200 bg-white text-lg font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    +
                  </button>
                </div>
                <p className="text-xs text-gray-500">Range: 48mm to 120mm</p>
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                <span>Quick width slider</span>
                <input
                  type="range"
                  min={48}
                  max={120}
                  value={receiptWidthMm}
                  onChange={(e) => updateField('receiptWidthMm', Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
                <p className="text-xs text-gray-500">Current: {receiptWidthMm}mm</p>
              </label>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="inline-flex items-center justify-center rounded-2xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Print Settings'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Image className="w-5 h-5 text-orange-500" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Receipt designer</h2>
                  <p className="text-sm text-gray-500">Drag elements freely inside the preview.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span>Header height</span>
                  <button
                    type="button"
                    onClick={() => updateField('headerHeightPx', Math.max(90, headerHeightPx - 10))}
                    className="w-6 h-6 rounded border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-100"
                  >
                    -
                  </button>
                  <span className="w-12 text-center text-gray-700">{headerHeightPx}px</span>
                  <button
                    type="button"
                    onClick={() => updateField('headerHeightPx', Math.min(320, headerHeightPx + 10))}
                    className="w-6 h-6 rounded border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-100"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setSettings((prev) => ({ ...prev, elementPositions: DEFAULT_ELEMENT_POSITIONS }))}
                  className="text-xs text-gray-400 hover:text-orange-500 transition"
                >
                  Reset positions
                </button>
              </div>
            </div>

            {/* Free-drag canvas */}
            <div
              ref={canvasRef}
              className="relative border border-dashed border-gray-300 rounded-xl bg-white mx-auto overflow-hidden font-mono"
              style={{ width: `${receiptWidthMm}mm`, maxWidth: '100%', height: headerHeightPx }}
            >
              {elementOrder.map((key, idx) => {
                const pos = (settings.elementPositions ?? DEFAULT_ELEMENT_POSITIONS)[key] ?? DEFAULT_ELEMENT_POSITIONS[key];
                const align = getAlign(key);
                const isDragging = draggingEl === key;
                const xform = align === 'center' ? 'translateX(-50%)' : align === 'right' ? 'translateX(-100%)' : undefined;

                let content: JSX.Element | null = null;
                if (key === 'logo') {
                  content = settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="Logo" style={{ width: logoSizePx, height: logoSizePx }} className="object-contain block" />
                  ) : (
                    <div style={{ width: logoSizePx, height: logoSizePx }} className="bg-gray-200 rounded flex items-center justify-center">
                      <span className="text-[8px] text-gray-400">Logo</span>
                    </div>
                  );
                } else if (key === 'name') {
                  content = (
                    <div className={`text-[11px] font-bold leading-tight whitespace-nowrap ${textAlignClass(align)}`}>
                      {settings.name || <span className="text-gray-300 italic text-[10px] font-normal">Restaurant Name</span>}
                    </div>
                  );
                } else if (key === 'address') {
                  content = previewAddressLines.length > 0 ? (
                    <div className={textAlignClass(align)}>
                      {previewAddressLines.map((line, i) => (
                        <div key={i} className="text-[9px] text-gray-600 leading-tight whitespace-nowrap">{line}</div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[9px] text-gray-300 italic whitespace-nowrap">Address lines</div>
                  );
                } else if (key === 'contact') {
                  content = (
                    <div className={`text-[9px] text-gray-600 ${textAlignClass(align)}`}>
                      {previewContactLines.length > 0 ? (
                        previewContactLines.map((line, i) => (
                          <div key={i} className="leading-tight whitespace-nowrap">{line}</div>
                        ))
                      ) : (
                        <span className="text-gray-300 italic whitespace-nowrap">Phone / Email</span>
                      )}
                    </div>
                  );
                }

                return (
                  <div
                    key={key}
                    style={{
                      position: 'absolute',
                      left: `${pos.x}%`,
                      top: `${pos.y}px`,
                      transform: xform,
                      zIndex: isDragging ? 20 : idx + 1,
                      cursor: 'move',
                    }}
                    onMouseDown={(e) => handleElMouseDown(e, key)}
                    className={`group select-none rounded px-1 py-0.5 transition ${
                      isDragging
                        ? 'ring-2 ring-orange-400 bg-orange-50'
                        : 'hover:ring-1 hover:ring-orange-300 hover:bg-orange-50/60'
                    }`}
                  >
                    <div className="absolute -top-4 left-0 text-[8px] text-orange-500 opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">
                      {ELEMENT_LABELS[key]}
                    </div>
                    {content}
                  </div>
                );
              })}

              {/* Item rows indicator pinned to bottom */}
              <div className="absolute bottom-0 left-0 right-0 border-t border-dashed border-gray-200 bg-gray-50/90 pb-1 pt-0.5">
                <div className="text-[9px] text-gray-400 text-center">— item rows —</div>
              </div>
            </div>

            {/* Per-element: alignment + logo size */}
            <div className="mt-4 space-y-2">
              {elementOrder.map((key) => {
                const align = getAlign(key);
                return (
                  <div key={key} className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                    <span className="text-xs font-medium text-gray-700 w-28 shrink-0">{ELEMENT_LABELS[key]}</span>
                    <div className="ml-auto flex items-center gap-1">
                      {(['left', 'center', 'right'] as ReceiptAlignment[]).map((a) => {
                        const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight;
                        return (
                          <button
                            key={a}
                            type="button"
                            onClick={() => updateAlignment(key, a)}
                            className={`p-1.5 rounded-lg transition ${align === a ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-200'}`}
                          >
                            <Icon className="w-3 h-3" />
                          </button>
                        );
                      })}
                      {key === 'logo' && (
                        <div className="ml-3 flex items-center gap-1.5 border-l pl-3">
                          <span className="text-xs text-gray-500">Size</span>
                          <button type="button" onClick={() => updateField('logoSizePx', Math.max(16, logoSizePx - 8))} className="w-6 h-6 rounded border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-100">−</button>
                          <span className="text-xs text-gray-700 w-10 text-center">{logoSizePx}px</span>
                          <button type="button" onClick={() => updateField('logoSizePx', Math.min(120, logoSizePx + 8))} className="w-6 h-6 rounded border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-100">+</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
