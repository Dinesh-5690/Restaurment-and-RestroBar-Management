'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { ExtraAddon, MenuItem, SelectedAddon } from '@/types';
import { menuApi } from '@/lib/api';

interface Props {
  item: MenuItem;
  quantity: number;
  onConfirm: (selectedAddOns: SelectedAddon[]) => void;
  onCancel: () => void;
}

export default function AddonPickerModal({ item, quantity, onConfirm, onCancel }: Props) {
  const [addons, setAddons] = useState<ExtraAddon[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    menuApi.availableItemAddons(item.id)
      .then((res) => setAddons(res.data || []))
      .catch(() => setAddons(item.availableAddOns || []))
      .finally(() => setLoading(false));
  }, [item]);

  const toggle = (addonId: string) => {
    setSelected((prev) => ({ ...prev, [addonId]: !prev[addonId] }));
  };

  const handleConfirm = () => {
    const selectedAddOns: SelectedAddon[] = addons
      .filter((addon) => selected[addon.id])
      .map((addon) => ({
        addonId: addon.id,
        addonName: addon.name,
        quantity: 1,
        unitPrice: Number(addon.price),
      }));
    onConfirm(selectedAddOns);
  };

  const addonTotal = addons
    .filter((addon) => selected[addon.id])
    .reduce((sum, addon) => sum + Number(addon.price), 0);

  const totalWithAddons = (Number(item.price) + addonTotal) * quantity;

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <div className="font-bold text-gray-900">{item.name}</div>
            <div className="text-xs text-gray-500">
              Select extra add-ons for this item
            </div>
          </div>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {loading && <div className="text-sm text-gray-400">Loading add-ons...</div>}

          {!loading && addons.length === 0 && (
            <div className="text-sm text-gray-400">No add-ons available for this item.</div>
          )}

          {!loading && addons.length > 0 && (
            <div className="space-y-2">
              {addons.map((addon) => (
                <button
                  key={addon.id}
                  onClick={() => toggle(addon.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${
                    selected[addon.id]
                      ? 'border-orange-400 bg-orange-50 ring-1 ring-orange-300'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      selected[addon.id] ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
                    }`}>
                      {selected[addon.id] && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-gray-900">{addon.name}</div>
                      {addon.description && <div className="text-xs text-gray-500">{addon.description}</div>}
                    </div>
                  </div>
                  <div className={`text-sm font-bold flex-shrink-0 ml-3 ${Number(addon.price) === 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                    {Number(addon.price) === 0 ? 'FREE' : `+₹${Number(addon.price).toFixed(2)}`}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t bg-gray-50">
          <div className="flex items-center justify-between text-sm mb-3">
            <span className="text-gray-600">
              {quantity} × {item.name}
              {Object.values(selected).filter(Boolean).length > 0 ? ` + ${Object.values(selected).filter(Boolean).length} add-on(s)` : ''}
            </span>
            <span className="font-bold text-gray-900">₹{totalWithAddons.toFixed(2)}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onCancel} className="flex-1 border border-gray-200 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100">
              Skip
            </button>
            <button onClick={handleConfirm} className="flex-1 bg-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-orange-600">
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
