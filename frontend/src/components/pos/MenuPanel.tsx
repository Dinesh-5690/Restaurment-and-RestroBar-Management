'use client';
import { useState, useEffect } from 'react';
import { MenuSection, MenuItem } from '@/types';
import { menuApi } from '@/lib/api';
import { Search, Tag } from 'lucide-react';
import clsx from 'clsx';
import AddonPickerModal from './AddonPickerModal';

interface Props {
  onAddItem: (item: MenuItem, addons?: any[]) => void;
}

export default function MenuPanel({ onAddItem }: Props) {
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [pendingItem, setPendingItem] = useState<MenuItem | null>(null);

  useEffect(() => {
    menuApi.fullMenu().then((r) => setSections(r.data)).catch(() => {});
  }, []);

  const allItems = sections.flatMap((s) => s.items);
  const filteredItems = allItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || item.categoryId === selectedCategory;
    return matchesSearch && matchesCategory && item.isAvailable;
  });

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          placeholder="Search menu..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
        <button
          onClick={() => setSelectedCategory('all')}
          className={clsx(
            'shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors',
            selectedCategory === 'all'
              ? 'bg-orange-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          )}
        >
          All
        </button>
        {sections.map((s) => (
          <button
            key={s.category.id}
            onClick={() => setSelectedCategory(s.category.id)}
            className={clsx(
              'shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors',
              selectedCategory === s.category.id
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {s.category.name}
          </button>
        ))}
      </div>

      {/* Items Grid */}
      <div className="flex-1 overflow-y-auto min-h-0 grid grid-cols-2 md:grid-cols-3 gap-3">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.availableAddOns && item.availableAddOns.length > 0) {
                setPendingItem(item);
              } else {
                onAddItem(item, []);
              }
            }}
            className="card p-3 text-left hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95"
          >
            <div className="font-medium text-sm text-gray-900 line-clamp-2 mb-1">{item.name}</div>
            <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
              <Tag className="w-3 h-3" /> {item.category?.name}
            </div>
            <div className="font-bold text-orange-600">₹{Number(item.price).toFixed(2)}</div>
          </button>
        ))}
        {filteredItems.length === 0 && (
          <div className="col-span-3 text-center text-gray-400 text-sm py-12">
            No items found
          </div>
        )}
      </div>

      {pendingItem && (
        <AddonPickerModal
          item={pendingItem}
          quantity={1}
          onConfirm={(selectedAddOns) => {
            onAddItem(pendingItem, selectedAddOns);
            setPendingItem(null);
          }}
          onCancel={() => {
            onAddItem(pendingItem, []);
            setPendingItem(null);
          }}
        />
      )}
    </div>
  );
}
